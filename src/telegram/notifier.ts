import {EventConsumer, JEvent} from '../events';
import {capitalize, numberFmt} from "../helpers";
import {Telegram} from "./api_telegram";
import {Clock} from "../clock";

export class TelegramNotifier implements EventConsumer {

    private readonly aggregationWindow = 8 * 1000; // 8 seconds
    private eventsQueue: JEvent[] = [];

    constructor() {
        const refresh = async () => {
            try {
                await this.processQueue();
            } catch (e) {
                console.error(e);
            }
            setTimeout(refresh, 1000);
        };
        refresh().catch(console.error);
    }

    async process(event: JEvent) {
        this.eventsQueue.push(event);
        await this.processQueue();
    }

    async processQueue() {
        if (this.eventsQueue.length === 0 || Date.now() - this.eventsQueue[0].time < this.aggregationWindow) {
            return;
        }

        this.eventsQueue.sort((a, b) => {
            const an = a.args['name'] as string;
            const bn = b.args['name'] as string;
            return (an === bn ? a.time - b.time : an.localeCompare(bn));
        });

        let msg = '';
        let groupedMsg = '';
        let prevName = this.eventsQueue[0].args['name'];
        let prevEvent = this.eventsQueue[0];

        for (const event of this.eventsQueue) {
            if (event.args['name'] !== prevName) {
                if (groupedMsg) {
                    msg += `${this.eventToEmoji(event)} <b>${capitalize(prevName)}</b>\n\n`;
                    msg += groupedMsg;
                    msg += '\n';
                    groupedMsg = '';
                }
                prevName = event.args['name'];
            }
            const eventMsg = await this.eventToMsg(event);
            if (eventMsg) {
                groupedMsg += eventMsg + '\n';
            }
            prevEvent = event;
        }
        if (groupedMsg) {
            msg += `${this.eventToEmoji(prevEvent)} <b>${capitalize(prevName)}</b>\n\n`;
            msg += groupedMsg;
        }
        if (msg) {
            await Telegram.sendMsgToAdmin(msg);
        }
        this.eventsQueue.length = 0; // Clear the queue
    }

    eventToEmoji(event: JEvent): string {
        if (event.name.includes('-trading-')) {
            return '🤖';
        }
        return '';
    }

    async eventToMsg(event: JEvent): Promise<string> {
        if (event.name.match(/bot-(.*)-start/)) {
            return this.botStartEventToMsg(event);
        } else if (event.name === 'bot-trading-accumulation-buy') {
            return this.accumulationBuyEventToMsg(event);
        } else if (event.name === 'bot-trading-accumulation-results') {
            return this.accumulationResultsEventToMsg(event);
        } else if (event.name === 'bot-trading-accumulation-insufficient') {
            return this.accumulationInsufficientEventToMsg(event);
        }
        return '';
    }

    async accumulationBuyEventToMsg(event: JEvent): Promise<string> {
        return `<b>></b> Bought ${numberFmt(event.args['amount'], event.args['lotPrecision'], 'u')} <b>${event.args['asset']}</b> ~` +
            `${numberFmt(event.args['amount'] * event.args['price'], 2, 'u', '$')}\n`;
    }

    private insufficientLastTime = 0;
    async accumulationInsufficientEventToMsg(event: JEvent): Promise<string> {
        if (Date.now() < this.insufficientLastTime + 8 * Clock.HOUR) {
            return '';
        }
        this.insufficientLastTime = Date.now();
        return '<b>></b> <i>Insufficient funds</i> 💸' +
            `\nYou should have at least ${numberFmt(event.args['min_amount'], 2, 'u')} ${event.args['quote_asset']}.\n`;
    }

    async accumulationResultsEventToMsg(event: JEvent): Promise<string> {
        let msg = '<b>></b> <i>Results</i>\n';
        for (const position of event.args['positions']) {
            const profit = position['quoteValue'] - position['quoteSpent'];
            msg += `<b>${position['asset'].toUpperCase()}</b> (${numberFmt(profit, 2, 'u', '$', (profit < 0 ? '' : '+'))}) `;
            msg += `<i>Spent: ${numberFmt(position['quoteSpent'], 2, 'u', '$')}</i>\n`;
            /*if (position['details']) {
                msg += `Amount: ${numberFmt(position['baseAmount'], position['lotPrecision'], 'u')} ${position['asset'].toUpperCase()}\n`;
                msg += `Avg. price: ${numberFmt(position['quoteSpent'] / position['baseAmount'], position['pricePrecision'], 'u', '$')}\n`;
            }*/
        }
        return msg;
    }

    async botStartEventToMsg(event: JEvent): Promise<string> {
        return '<b>></b> <i>Bot started.</i>\n';
    }
}
