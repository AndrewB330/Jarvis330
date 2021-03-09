import {ExchangeAccount} from "./exchange_base";
import {Clock} from "./clock";
import {Telegram} from "../telegram/api_telegram";
import {capitalize} from "../helpers";

export class Bot {
    // noinspection JSMismatchedCollectionQueryUpdate
    protected tickers: string[] = [];
    protected started = false;
    protected notifications = false;

    constructor(protected name: string, protected exchangeAccount: ExchangeAccount, protected clock: Clock) {
    }

    getName(): string {
        return this.name;
    }

    start() {
        this.started = true;
    }

    stop() {
        this.started = false;
        for (const ticker of this.tickers) {
            this.clock.removeTicker(ticker);
        }
    }

    enableNotifications() {
        this.notifications = true;
    }

    async sendNotification(message: string, photo = '') {
        if (this.notifications) {
            if (photo) {
                await Telegram.sendMsgWithPhotoToAdmin(`🤖 <b>${capitalize(this.name)}</b>\n\n` + message, photo);
            } else {
                await Telegram.sendMsgToAdmin(`🤖 <b>${capitalize(this.name)}</b>\n\n` + message);
            }
        }
    }
}
