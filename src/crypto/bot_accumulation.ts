import {TradingBot} from "./bot_trading";
import {ExchangeAccount} from "./exchange_base";
import {Clock} from "../clock";
import {Firebase} from "../firebase/firebase";
import {getOrSet, sleep} from "../helpers";

const UPDATE_INTERVAL_SEC = 60;
const DAILY_UPDATE_HOUR = 8 + 30 / 60;

interface AccumulationOrder {
    time: number;
    asset: string;
    amount: number;
    price: number;
    quoteAsset: string;
}

export interface AccumulationBotConfig {
    quoteAsset: string;

    mainAsset: string;
    mainAssetBuyAmount: number;

    otherAssets: string[];
    otherAssetsBuyAmount: number;

    minOrderAmount: number;
}

export class AccumulationBot extends TradingBot {

    constructor(name: string, exchangeAccount: ExchangeAccount, clock: Clock, private config: AccumulationBotConfig) {
        super(name, exchangeAccount, clock);
    }

    start(): boolean {
        if (super.start()) {
            this.dispatchBotEvent('start', {});
            this.dispatchResults(false).catch(console.error);
            this.tickers.push(this.clock.addTicker(UPDATE_INTERVAL_SEC, async () => {
                await this.update();
            }));
            this.tickers.push(this.clock.addDailyTicker(DAILY_UPDATE_HOUR, async () => {
                await this.dispatchResults(false);
            }));
            return true;
        }
        return false;
    }

    getType(): string {
        return 'accumulation';
    }

    async update() {
        const curQuoteBalance = await this.exchangeAccount.getAssetBalance(this.config.quoteAsset);
        const minQuoteAmount = this.config.minOrderAmount * 2;
        if (curQuoteBalance.free < minQuoteAmount) {
            this.dispatchBotEvent('insufficient', {
                min_amount: minQuoteAmount,
                quote_asset: this.config.quoteAsset
            });
            return;
        }

        const currentDay = Math.floor(this.clock.getTime() / Clock.DAY);
        const bought = new Set<string>();

        for (const order of await this.getAllOrders()) {
            const day = Math.floor(order.time / Clock.DAY);
            if (day === currentDay && order.quoteAsset === this.config.quoteAsset) {
                bought.add(order.asset);
            }
        }


        if (!bought.has('BTC') && await this.shouldBuy('BTC')) {
            await this.buy(this.config.mainAssetBuyAmount, 'BTC');
            return;
        }

        const alt = this.getAltOfTheDay();
        await this.shouldBuy(alt);
        if (!bought.has(alt) && await this.shouldBuy(alt)) {
            await this.buy(this.config.otherAssetsBuyAmount, alt);
            return;
        }
    }

    async shouldBuy(asset: string): Promise<boolean> {
        const timeOfTheDay = (this.clock.getTime() % (Clock.DAY)) / Clock.DAY;
        const market = await this.exchangeAccount.getMarket({base: asset, quote: this.config.quoteAsset});
        const series = await market.getCandlestickSeries('1h', 10);

        return await market.getLastPrice() < series.getAvgPriceMA(8) * 0.98 || timeOfTheDay > 0.8;
    }

    async buy(quoteAssetValue: number, baseAsset: string): Promise<void> {
        const market = await this.exchangeAccount.getMarket({base: baseAsset, quote: this.config.quoteAsset});
        const price = await market.getLastPrice();
        const sellAmount = this.config.minOrderAmount / price;
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
            quoteAsset: this.config.quoteAsset
        });
    }

    async dispatchResults(details = false) {
        const orders = new Map<string, AccumulationOrder[]>();
        for (const order of await this.getAllOrders()) {
            getOrSet(orders, order.asset, []).push(order);
        }
        const positions = [];
        for (const asset of orders.keys()) {
            let quoteSpent = 0;
            let baseAmount = 0;
            for (const order of orders.get(asset)) {
                quoteSpent += order.price * order.amount;
                baseAmount += order.amount;
            }
            const market = await this.exchangeAccount.getMarket({base: asset, quote: this.config.quoteAsset});
            const quoteValue = (await this.exchangeAccount.convertAsset(
                {asset, amount: baseAmount},
                this.config.quoteAsset
            )).amount;

            positions.push({
                asset,
                quoteAsset: this.config.quoteAsset,
                quoteSpent,
                quoteValue,
                baseAmount,
                pricePrecision: await market.getPricePrecision(),
                lotPrecision: await market.getLotPrecision()
            });
        }

        this.dispatchBotEvent('results', {positions, details});
    }

    private getAltOfTheDay(): string {
        const currentDay = Math.floor(this.clock.getTime() / Clock.DAY);
        return this.config.otherAssets[currentDay % this.config.otherAssets.length];
    }

    private async getAllOrders(): Promise<AccumulationOrder[]> {
        const ordersRaw = await Firebase.getArray(`bots/${this.name}/orders`);
        return ordersRaw as AccumulationOrder[];
    }

    private async addNewOrder(order: AccumulationOrder): Promise<void> {
        const market = await this.exchangeAccount.getMarket({base: order.asset, quote: order.quoteAsset});

        this.dispatchBotEvent('buy', {
            pricePrecision: await market.getLotPrecision(),
            asset: order.asset,
            amount: order.amount,
            price: order.price
        });

        const orders = await this.getAllOrders();
        await Firebase.setValue(`bots/${this.name}/orders/${orders.length}`, order);
    }
}
