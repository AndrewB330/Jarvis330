import {ExchangeAccount, Market} from "./exchange_base";
import {
    CandlestickScale,
    CandlestickSeries, Order,
    OrderBook,
    OrderId,
    Symbol,
    SymbolInfo, symbolToBinanceStr,
    symbolToStr, Ticker,
    TradingAssetBalance
} from "./model";
import {BinanceCredentials} from "../config";
import {
    Binance,
    CandleChartInterval,
    NewOrderRespType,
    Order as Order_,
    OrderSide,
    OrderType, SideEffectType,
    TimeInForce
} from "binance-api-node";
import {BinancePublicApi} from "./api_binance";
import {DataCache} from "../helpers";

function convertOrder(a: Order_): Order {
    return {
        orderId: a.orderId,
        orderType: a.type,
        orderStatus: a.status,
        side: a.side,

        symbol: {base: a.symbol.slice(0, 3), quote: a.symbol.slice(3)},

        amount: Number(a.origQty),
        price: Number(a.price),

        executedBaseAmount: Number(a.executedQty),
        cumulativeQuoteAmount: Number(a.cummulativeQuoteQty),

        creationTime: a.transactTime,
        updateTime: a.transactTime,
        refreshTime: a.transactTime
    };
}

export class MarketBinance extends Market {
    protected symbolInfo: Promise<SymbolInfo>;

    constructor(symbol: Symbol, private binanceExchange: BinanceExchangeAccount) {
        super(symbol, binanceExchange);
        this.symbolInfo = BinancePublicApi.getSymbolInfo(symbol);
    }

    async getCandlestickSeries(scale: CandlestickScale, length: number): Promise<CandlestickSeries> {
        const candlesticks = (await this.binanceExchange._api().candles({
            symbol: symbolToStr(this.symbol),
            interval: scale as CandleChartInterval,
            limit: length
        })).map(raw => {
            return {
                open: Number(raw.open),
                close: Number(raw.close),
                low: Number(raw.low),
                high: Number(raw.high),

                baseVolume: Number(raw.baseAssetVolume),
                quoteVolume: Number(raw.quoteAssetVolume),

                openTime: raw.openTime,
                closeTime: raw.closeTime
            };
        });
        return new CandlestickSeries(candlesticks);
    }

    async getLastPrice(): Promise<number> {
        return Number((await this.binanceExchange._api().prices({symbol: this.symbolStr}))[this.symbolStr]);
    }

    async getLotPrecision(): Promise<number> {
        return (await this.symbolInfo).amountPrecision;
    }

    async getLotStep(): Promise<number> {
        return (await this.symbolInfo).amountStep;
    }

    async getOrderBook(): Promise<OrderBook> {
        const orderBookRaw = await this.binanceExchange._api().book({
            symbol: this.symbolStr,
            limit: 100
        });
        return {
            asks: orderBookRaw.asks.map(r => {
                return {price: Number(r.price), amount: Number(r.quantity)};
            }),
            bids: orderBookRaw.bids.map(r => {
                return {price: Number(r.price), amount: Number(r.quantity)};
            }),
        };
    }

    async getPricePrecision(): Promise<number> {
        return (await this.symbolInfo).pricePrecision;
    }

    async getPriceStep(): Promise<number> {
        return (await this.symbolInfo).priceStep;
    }

}

export class BinanceExchangeAccount extends ExchangeAccount {

    private symbolsCache = new DataCache<Symbol[]>(60 * 60 * 1000);
    private marketCache = new DataCache<MarketBinance>();

    constructor(private binanceApi: Binance) {
        super();
    }

    _api(): Binance {
        return this.binanceApi;
    }

    async cancelOrder(symbol: Symbol, id: OrderId): Promise<boolean> {
        const cancelRes = await this.binanceApi.cancelOrder({symbol: symbolToStr(symbol), orderId: id});
        return cancelRes.status === 'CANCELED';
    }

    async getAllAssetBalances(): Promise<TradingAssetBalance[]> {
        const accountInfo = await this.binanceApi.accountInfo();
        return accountInfo.balances.map(raw => {
            return {
                asset: raw.asset,
                amount: Number(raw.free) + Number(raw.locked),
                free: Number(raw.free),
                locked: Number(raw.locked)
            };
        });
    }

    async getAllSymbols(): Promise<Symbol[]> {
        return this.symbolsCache.getOrUpdate('all', async () => {
            const exchangeInfo = await this.binanceApi.exchangeInfo();
            return exchangeInfo.symbols.map(raw => {
                return {base: raw.baseAsset, quote: raw.quoteAsset};
            });
        });
    }

    async getAllTickers(): Promise<Ticker[]> {
        const rawTickers = await this.binanceApi.allBookTickers();
        return (await this.getAllSymbols()).map((symbol) => {
            const symbolStr = symbolToStr(symbol);
            // tslint:disable-next-line:no-any
            const raw = rawTickers[symbolStr] as any;
            return {
                symbol,
                bidPrice: Number(raw.bidPrice),
                askPrice: Number(raw.askPrice),
                price: (Number(raw.bidPrice) + Number(raw.askPrice)) * 0.5
            };
        });
    }

    async getAssetBalance(asset: string): Promise<TradingAssetBalance> {
        return (await this.getAllAssetBalances()).filter(b => b.asset === asset)[0];
    }

    async getMarket(symbol: Symbol): Promise<Market> {
        return this.marketCache.getOrUpdate(symbolToStr(symbol), async () => {
            return new MarketBinance(symbol, this);
        });
    }

    getOpenOrders(symbol?: Symbol): Promise<Order[]> {
        // todo:
        return Promise.resolve([]);
    }

    getOrders(symbol?: Symbol): Promise<Order[]> {
        // todo:
        return Promise.resolve([]);
    }

    async makeLimitOrder(symbol: Symbol, side: OrderSide, amount: number, price: number): Promise<Order> {
        const market = await this.getMarket(symbol);
        return convertOrder(await this.binanceApi.order({
            quantity: amount.toFixed(await market.getLotPrecision()),
            side,
            symbol: symbolToBinanceStr(symbol),
            type: 'LIMIT',
            price: price.toFixed(await market.getPricePrecision())
        }));
    }

    async makeMarketOrder(symbol: Symbol, side: OrderSide, amount: number): Promise<Order> {
        const market = await this.getMarket(symbol);
        return convertOrder(await this.binanceApi.order({
            quantity: amount.toFixed(await market.getLotPrecision()),
            side,
            symbol: symbolToBinanceStr(symbol),
            type: 'MARKET'
        }));
    }
}
