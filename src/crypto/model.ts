import {OrderStatus, OrderType, OrderSide} from "binance-api-node";

export type CandlestickScale = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '8h' | '1d' | '3d' | '1w' | '1M';

export type OrderId = number;

export interface Candlestick {
    open: number;
    close: number;
    low: number;
    high: number;

    baseVolume: number;
    quoteVolume: number;

    openTime: number; // in UTC milliseconds
    closeTime: number; // in UTC milliseconds
}

export interface AskBid {
    price: number;
    amount: number;
}

export interface OrderBook {
    asks: AskBid[];
    bids: AskBid[];
}

export interface AssetBalance {
    asset: string;
    amount: number;
}

export interface TradingAssetBalance extends AssetBalance {
    free: number;
    locked: number;
}

export interface Ticker {
    symbol: Symbol;
    bidPrice: number;
    askPrice: number;
    price: number;
}

export interface Order {
    orderId: OrderId;
    orderType: OrderType;
    orderStatus: OrderStatus;
    side: OrderSide;

    symbol: Symbol;

    amount: number;
    price: number;

    executedBaseAmount: number;
    cumulativeQuoteAmount: number;

    creationTime: number; // in UTC milliseconds
    updateTime: number; // in UTC milliseconds
    refreshTime: number; // in UTC milliseconds
}

export interface Symbol {
    base: string;
    quote: string;
}

export const SCALES: CandlestickScale[] = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '8h', '1d', '3d', '1w', '1M'];

export function symbolToBinanceStr(symbol: Symbol): string {
    return `${symbol.base}${symbol.quote}`;
}

export function symbolToStr(symbol: Symbol): string {
    return symbolToBinanceStr(symbol);
}

export function symbolToBeautifulStr(symbol: Symbol): string {
    return `${symbol.base.toUpperCase()}/${symbol.quote.toUpperCase()}`;
}

export function CandlestickScaleToMinutes(scale: CandlestickScale): number {
    if (scale.slice(-1) === 'm') {
        return Number(scale.slice(0, -1));
    }
    if (scale.slice(-1) === 'h') {
        return Number(scale.slice(0, -1)) * 60;
    }
    if (scale.slice(-1) === 'd') {
        return Number(scale.slice(0, -1)) * 60 * 24;
    }
    if (scale === '1w') {
        return 60 * 24 * 7;
    }
    if (scale === '1M') {
        return 60 * 24 * 7 * 30;
    }
    return 0;
}

export function CandlestickScaleToSeconds(scale: CandlestickScale): number {
    return CandlestickScaleToMinutes(scale) * 60;
}

export class CandlestickSeries {
    start: number; // in UTC milliseconds
    end: number; // in UTC milliseconds

    constructor(public candlesticks: Candlestick[]) {
        this.start = candlesticks[0].openTime;
        this.end = candlesticks[candlesticks.length - 1].closeTime;

        /*for (let i = 1; i < this.candlesticks.length; i++) {
            console.assert(this.candlesticks[i - 1].closeTime < this.candlesticks[i].openTime);
            console.assert(this.candlesticks[i - 1].closeTime + 1 > this.candlesticks[i].openTime);
        }*/
    }

    calcMovingAverage(windowSize: number, priceGetter: (Candlestick) => number): number {
        if (windowSize < 1) {
            windowSize = 1;
        }
        const n = this.candlesticks.length;
        let accumulated = 0;
        for (let i = 0; i < windowSize && i < n; i++) {
            accumulated += priceGetter(this.candlesticks[n - i - 1]);
        }
        return accumulated / (windowSize < n ? windowSize : n);
    }

    calcExponentialMovingAverage(decay: number, priceGetter: (Candlestick) => number): number {
        decay = Math.min(Math.max(decay, 0.0), 0.999);
        const n = this.candlesticks.length;
        const windowSize = (1.0 / (1 - decay)) * 3;

        let result = priceGetter(this.candlesticks[n - Math.min(windowSize, n)]);
        for (let i = 1; i < windowSize && i < n; i++) {
            result = result * decay + (1 - decay) * priceGetter(this.candlesticks[n - i - 1]);
        }
        return result;
    }

    getAvgPriceMA(windowSize: number): number {
        return this.calcMovingAverage(windowSize, (c) => c.quoteVolume / c.baseVolume);
    }

    getHighPriceMA(windowSize: number): number {
        return this.calcMovingAverage(windowSize, (c) => c.high);
    }

    getLowPriceMA(windowSize: number): number {
        return this.calcMovingAverage(windowSize, (c) => c.low);
    }

    getAvgPriceEMA(decay: number): number {
        return this.calcExponentialMovingAverage(decay, (c) => c.baseVolume / c.quoteVolume);
    }

    getHighPriceEMA(windowSize: number): number {
        return this.calcExponentialMovingAverage(windowSize, (c) => c.high);
    }

    getLowPriceEMA(windowSize: number): number {
        return this.calcExponentialMovingAverage(windowSize, (c) => c.low);
    }
}

export interface SymbolInfo {
    amountMin: number;
    amountStep: number;
    amountPrecision: number;
    priceStep: number;
    pricePrecision: number;
}
