import {
    AssetBalance,
    CandlestickScale,
    CandlestickSeries, Order,
    OrderBook, OrderId,
    Symbol,
    symbolToBinanceStr, symbolToStr, Ticker,
    TradingAssetBalance
} from "./model";

import {getOrSet} from "../helpers";
import {OrderSide} from "binance-api-node";

export abstract class Market {

    protected symbolStr: string;

    protected constructor(protected symbol: Symbol, protected exchange: ExchangeAccount) {
        this.symbolStr = symbolToStr(symbol);
    }

    abstract getLastPrice(): Promise<number>;

    abstract getCandlestickSeries(scale: CandlestickScale, length: number): Promise<CandlestickSeries>;

    abstract getPricePrecision(): Promise<number>;

    abstract getPriceStep(): Promise<number>;

    abstract getLotPrecision(): Promise<number>;

    abstract getLotStep(): Promise<number>;

    abstract getOrderBook(): Promise<OrderBook>;

    async buyMarket(amount: number) : Promise<Order> {
        return this.exchange.makeMarketOrder(this.symbol, 'BUY', amount);
    }

    async sellMarket(amount: number) : Promise<Order> {
        return this.exchange.makeMarketOrder(this.symbol, 'SELL', amount);
    }

    async buyLimit(amount: number, price: number) : Promise<Order> {
        return this.exchange.makeLimitOrder(this.symbol, 'BUY', amount, price);
    }

    async sellLimit(amount: number, price: number) : Promise<Order> {
        return this.exchange.makeLimitOrder(this.symbol, 'SELL', amount, price);
    }

    async getBaseBalance(): Promise<TradingAssetBalance> {
        return this.exchange.getAssetBalance(this.symbol.base);
    }

    async getQuoteBalance(): Promise<TradingAssetBalance> {
        return this.exchange.getAssetBalance(this.symbol.quote);
    }

    getSymbol(): Symbol {
        return this.symbol;
    }
}

export abstract class ExchangeAccount {

    abstract getMarket(symbol: Symbol): Promise<Market>;

    abstract getAssetBalance(asset: string): Promise<TradingAssetBalance>;

    abstract getAllAssetBalances(): Promise<TradingAssetBalance[]>;

    abstract getAllTickers(): Promise<Ticker[]>;

    abstract getAllSymbols(): Promise<Symbol[]>;

    async getAllSymbolsSet(): Promise<Set<string>> {
        const set = new Set<string>();
        for (const symbol of await this.getAllSymbols()) {
            set.add(symbolToBinanceStr(symbol));
        }
        return set;
    }

    async getAllTickersMap(): Promise<Map<string, Ticker>> {
        const map = new Map<string, Ticker>();
        for (const ticker of await this.getAllTickers()) {
            map.set(symbolToBinanceStr(ticker.symbol), ticker);
        }
        return map;
    }

    async getSymbolsGraph(): Promise<Map<string, Symbol[]>> {
        const graph = new Map<string, Symbol[]>();
        for (const symbol of await this.getAllSymbols()) {
            getOrSet(graph, symbol.base, []).push(symbol);
            getOrSet(graph, symbol.quote, []).push(symbol);
        }
        return graph;
    }

    async convertAsset(balance: AssetBalance, targetAsset: string): Promise<AssetBalance> {
        const tickers = await this.getAllTickersMap();
        const exchangeSequence = await this.getShortestExchangeSequence(balance.asset, targetAsset);
        let amount = balance.amount;
        let asset = balance.asset;
        for (const symbol of exchangeSequence) {
            if (asset === symbol.base) {
                // Sell current asset
                amount = amount * tickers.get(symbolToBinanceStr(symbol)).bidPrice;
                asset = symbol.quote;
            } else if (asset === symbol.quote) {
                // Buy another asset
                amount = amount / tickers.get(symbolToBinanceStr(symbol)).askPrice;
                asset = symbol.base;
            }
        }
        console.assert(asset === targetAsset);
        return {asset, amount};
    }

    async getShortestExchangeSequence(fromAsset: string, toAsset: string): Promise<Symbol[]> {
        const symbols = await this.getAllSymbolsSet();
        const shortcuts = ['USDT', 'BTC', 'BUSD', 'ETH'];

        if (symbols.has(symbolToBinanceStr({base: fromAsset, quote: toAsset}))) {
            return [{base: fromAsset, quote: toAsset}];
        }

        if (symbols.has(symbolToBinanceStr({base: toAsset, quote: fromAsset}))) {
            return [{base: toAsset, quote: fromAsset}];
        }

        for (const shortcut of shortcuts) {
            if (symbols.has(symbolToBinanceStr({base: fromAsset, quote: shortcut})) &&
                symbols.has(symbolToBinanceStr({base: shortcut, quote: toAsset}))) {
                return [{base: fromAsset, quote: shortcut}, {base: shortcut, quote: toAsset}];
            }
            if (symbols.has(symbolToBinanceStr({base: fromAsset, quote: shortcut})) &&
                symbols.has(symbolToBinanceStr({base: toAsset, quote: shortcut}))) {
                return [{base: fromAsset, quote: shortcut}, {base: toAsset, quote: shortcut}];
            }
        }

        console.log('Not implemented yet :(');
        throw new Error('Not implemented yet :(');
    }

    // Orders

    abstract makeLimitOrder(symbol: Symbol, side: OrderSide, amount: number, price: number): Promise<Order>;

    abstract makeMarketOrder(symbol: Symbol, side: OrderSide, amount: number): Promise<Order>;

    abstract cancelOrder(symbol: Symbol, id: OrderId): Promise<boolean>;

    abstract getOpenOrders(symbol?: Symbol): Promise<Order[]>;

    abstract getOrders(symbol?: Symbol): Promise<Order[]>;

}
