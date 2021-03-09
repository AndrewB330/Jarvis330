import {Bot} from "./bot_base";
import {ExchangeAccount} from "./exchange_base";
import {Clock} from "./clock";
import {Firebase} from "../firebase/firebase";
import {getOrSet, numberFmt, sleep} from "../helpers";
import {Telegram} from "../telegram/api_telegram";
import {Charts} from "../charts/charts";

const UPDATE_INTERVAL_SEC = 60;
const DAILY_UPDATE_HOUR = 8 + 30/60;

interface AccumulationOrder {
    time: number;
    asset: string;
    amount: number;
    price: number;
    quoteAsset: string;
}

export class AccumulationBot extends Bot {
    static readonly BALANCE_PER_DAY = 3;
    static readonly MIN_ORDER_SIZE = 12;
    static readonly QUOTE_ASSET = 'USDT';

    static readonly ALTS = ['BNB', 'ADA', 'ETH'];

    constructor(name: string, exchangeAccount: ExchangeAccount, clock: Clock) {
        super(name, exchangeAccount, clock);
    }

    start() {
        if (!this.started) {
            super.start();

            this.tickers.push(this.clock.addTicker(UPDATE_INTERVAL_SEC, async () => {
                try {
                    await this.update();
                } catch (e) {
                    console.error(e);
                }
            }));

            this.tickers.push(this.clock.addDailyTicker(DAILY_UPDATE_HOUR, async () => {
                await this.sendResults(false);
            }));
        }
    }

    async update() {
        const currentDay = Math.floor(this.clock.getTime() / Clock.DAY);
        const bought = new Set<string>();

        let remainingBalance = AccumulationBot.BALANCE_PER_DAY;

        for (const order of await this.getAllOrders()) {
            const day = Math.floor(order.time / Clock.DAY);
            if (day === currentDay && order.quoteAsset === AccumulationBot.QUOTE_ASSET) {
                remainingBalance -= order.price * order.amount;
                bought.add(order.asset);
            }
        }

        if (remainingBalance < 0.1) {
            return;
        }


        if (!bought.has('BTC') && await this.shouldBuy('BTC')) {
            await this.buy(Math.min(remainingBalance, 2.0), 'BTC');
            return;
        }

        const alt = this.getAltOfTheDay();
        await this.shouldBuy(alt);
        if (!bought.has(alt) && await this.shouldBuy(alt)) {
            await this.buy(Math.min(remainingBalance, 1.0), alt);
            return;
        }
    }

    async shouldBuy(asset: string): Promise<boolean> {
        const timeOfTheDay = (this.clock.getTime() % (Clock.DAY)) / Clock.DAY;
        const market = await this.exchangeAccount.getMarket({base: asset, quote: AccumulationBot.QUOTE_ASSET});
        const series = await market.getCandlestickSeries('1h', 10);

        return await market.getLastPrice() < series.getAvgPriceMA(8) * 0.98 || timeOfTheDay > 0.8;
    }

    async buy(quoteAssetValue: number, baseAsset: string): Promise<void> {
        const market = await this.exchangeAccount.getMarket({base: baseAsset, quote: AccumulationBot.QUOTE_ASSET});
        const price = await market.getLastPrice();
        const sellAmount = AccumulationBot.MIN_ORDER_SIZE / price;
        const buyAmount = sellAmount + quoteAssetValue / price;
        const buyOrder = await market.buyMarket(buyAmount);
        await sleep(1500);
        const sellOrder = await market.sellMarket(sellAmount);
        const totalAmount = buyOrder.executedBaseAmount - sellOrder.executedBaseAmount;
        await this.addNewOrder({
            time: this.clock.getTime(),
            asset: baseAsset,
            amount: totalAmount,
            price,
            quoteAsset: AccumulationBot.QUOTE_ASSET
        });
    }

    async sendResults(details = false) {
        let results = '';
        const orders = new Map<string, AccumulationOrder[]>();
        for (const order of await this.getAllOrders()) {
            getOrSet(orders, order.asset, []).push(order);
        }
        const chartData = [];
        const chartLabels = [];
        for (const asset of orders.keys()) {
            let quoteSpent = 0;
            let baseAmount = 0;
            for (const order of orders.get(asset)) {
                quoteSpent += order.price * order.amount;
                baseAmount += order.amount;
            }
            const market = await this.exchangeAccount.getMarket({base: asset, quote: AccumulationBot.QUOTE_ASSET});
            const quoteValue = (await this.exchangeAccount.convertAsset(
                {asset, amount: baseAmount},
                AccumulationBot.QUOTE_ASSET
            )).amount;
            const profit = quoteValue - quoteSpent;
            results += `<b>${asset.toUpperCase()}</b> (${numberFmt(profit, 2, 'u', '$', (profit < 0 ? '' : '+'))})\n`;
            results += `<i>Spent: ${numberFmt(quoteSpent, 2, 'u', '$')}</i>\n`;
            if (details) {
                results += `Amount: ${numberFmt(baseAmount, await market.getLotPrecision(), 'u')} ${asset.toUpperCase()}\n`;
                results += `Avg. price: ${numberFmt(quoteSpent / baseAmount, await market.getPricePrecision(), 'u', '$')}\n`;
            }
            results += '\n';
            chartData.push(quoteValue);
            chartLabels.push(asset);
        }

        let photo = '';
        if (this.notifications) {
            photo = await Charts.generateDistributionChart(chartData, chartLabels);
        }

        await this.sendNotification(results, photo);
    }

    private getAltOfTheDay(): string {
        const currentDay = Math.floor(this.clock.getTime() / Clock.DAY);
        return AccumulationBot.ALTS[currentDay % AccumulationBot.ALTS.length];
    }

    private async getAllOrders(): Promise<AccumulationOrder[]> {
        const ordersRaw = await Firebase.getArray(`bots/${this.name}/orders`);
        return ordersRaw as AccumulationOrder[];
    }

    private async addNewOrder(order: AccumulationOrder): Promise<void> {
        const market = await this.exchangeAccount.getMarket({base: order.asset, quote: order.quoteAsset});

        await this.sendNotification(
            `Bought ${numberFmt(order.amount, await market.getLotPrecision(), 'u')} <b>${order.asset}</b> ~` +
            `${numberFmt(order.amount * order.price, 2, 'u', '$')}`
        );

        const orders = await this.getAllOrders();
        await Firebase.setValue(`bots/${this.name}/orders/${orders.length}`, order);
    }
}
