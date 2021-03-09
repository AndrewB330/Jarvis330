import {Candlestick, CandlestickScale, Symbol, SymbolInfo, symbolToBinanceStr} from "./model";
import {appendFileSync, existsSync, readFileSync} from "fs";
import {sleep} from "../helpers";
import {BinanceAccount, BinanceConfig, BinanceCredentials} from "../config";
import {Binance} from "binance-api-node";

// tslint:disable-next-line:no-require-imports
const BinanceApiNode = require('binance-api-node').default;
const DEFAULT_CLIENT = new BinanceApiNode();
const EXCHANGE_INFO = DEFAULT_CLIENT.exchangeInfo();

const truncateRegex = /(\.\d\d*?)(0*)$/;
const truncateReplace = '$1';

function compressCandle(candle) {
    return [
        candle.openTime,
        candle.closeTime,
        candle.open.replace(truncateRegex, truncateReplace),
        candle.close.replace(truncateRegex, truncateReplace),
        candle.low.replace(truncateRegex, truncateReplace),
        candle.high.replace(truncateRegex, truncateReplace),
        candle.volume.replace(truncateRegex, truncateReplace),
        candle.quoteVolume.replace(truncateRegex, truncateReplace),
        candle.baseAssetVolume.replace(truncateRegex, truncateReplace),
        candle.quoteAssetVolume.replace(truncateRegex, truncateReplace),
        candle.trades,
    ];
}

// tslint:disable-next-line:no-any
async function getCachedCandlesRaw(symbol: Symbol, scale: CandlestickScale): Promise<any[]> {
    const symbolStr = symbolToBinanceStr(symbol);
    const filename = `cache/${symbolStr}_${scale}.json`;

    if (existsSync(filename)) {
        const data = readFileSync(filename);
        return JSON.parse(data.toString());
    }

    const weekCandles = (await DEFAULT_CLIENT.candles({symbol: symbolStr, limit: 1000, interval: '1w'}));
    const startTime = weekCandles[0].openTime;
    const endTime = weekCandles[weekCandles.length - 1].closeTime;

    const res = [];
    let time = startTime;
    while (time < endTime) {
        try {
            const candles = (await DEFAULT_CLIENT.candles({
                symbol: symbolStr,
                limit: 1000,
                interval: scale,
                startTime: time
            }));

            time = candles[candles.length - 1].closeTime;

            res.push(...candles.map(compressCandle));

            console.log(`Downloading ${symbol}: ${((time - startTime) * 100 / (endTime - startTime)).toFixed(1)}%`);

            if (candles.length < 1000) {
                break;
            }

            await sleep(500);
        } catch (e) {
            await sleep(20000);
        }
    }
    appendFileSync(filename, JSON.stringify(res, null, 4));
    return res;
}

export class BinancePublicApi {

    static async getCachedCandles(symbol: Symbol, scale: CandlestickScale): Promise<Candlestick[]> {
        return (await getCachedCandlesRaw(symbol, scale)).map((raw) => {
            return {
                openTime: raw[0],
                closeTime: raw[1],

                open: Number(raw[2]),
                close: Number(raw[3]),
                low: Number(raw[4]),
                high: Number(raw[5]),

                baseVolume: Number(raw[6]),
                quoteVolume: Number(raw[7]),
            };
        });
    }

    static async getSymbolInfo(symbol: Symbol): Promise<SymbolInfo> {
        const exchangeInfo = await EXCHANGE_INFO;
        const symbolInfo = {
            amountStep: 0,
            amountPrecision: 0,
            priceStep: 0,
            pricePrecision: 0,
            amountMin: 0
        };

        for (const s of exchangeInfo['symbols']) {
            if (s['symbol'] !== symbolToBinanceStr(symbol)) {
                continue;
            }
            for (const filter of s['filters']) {
                if (filter['filterType'] === 'PRICE_FILTER') {
                    symbolInfo.priceStep = Number(filter['tickSize']);
                }
                if (filter['filterType'] === 'LOT_SIZE') {
                    symbolInfo.amountMin = Number(filter['minQty']);
                    symbolInfo.amountStep = Number(filter['stepSize']);
                }
            }
        }

        symbolInfo.pricePrecision = Math.round(-Math.log10(symbolInfo.priceStep));
        symbolInfo.amountPrecision = Math.round(-Math.log10(symbolInfo.amountStep));

        return symbolInfo;
    }

    static async getAllSymbols(): Promise<Symbol[]> {
        const exchangeInfo = await EXCHANGE_INFO;
        const res: Symbol[] = [];
        for (const s of exchangeInfo['symbols']) {
            res.push({base: s['baseAsset'], quote: s['quoteAsset']});
        }
        return res;
    }

}

export function getBinanceApi(account: BinanceAccount) : Binance {
    return new BinanceApiNode(BinanceConfig.getCredentials(account));
}


