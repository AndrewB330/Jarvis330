import {readFileSync} from "fs";
import {AccumulationBot} from "./crypto/bot_accumulation";
import {BinanceExchangeAccount} from "./crypto/exchange_binance";
import {getBinanceApi} from "./crypto/api_binance";
import {ExchangeAccount} from "./crypto/exchange_base";
import {RealtimeClock} from "./clock";
import {Bot} from "./bot_base";

// @ts-ignore
export const modulesJSON = JSON.parse(readFileSync('modules.json'));

const CLOCK = new RealtimeClock();
const BOTS: Bot[] = [];

function getExchangeAccount(exchange: string, account: string): ExchangeAccount {
    return new BinanceExchangeAccount(getBinanceApi(account));
}

export function startAllBots() {
    for (const bot of BOTS) bot.stop();
    BOTS.length = 0;

    for (const botJson of modulesJSON['bots']) {
        const type = botJson['type'] as string;
        const name = botJson['name'] as string;
        const exchangeAccount = getExchangeAccount(botJson['exchange'] as string, botJson['account'] as string);
        if (type === 'accumulation') {
            BOTS.push(new AccumulationBot(name, exchangeAccount, CLOCK, {
                quoteAsset: botJson['quote-asset'] || 'USDT',
                mainAsset: botJson['main-asset'] || 'BTC',
                mainAssetBuyAmount: botJson['main-asset-buy-amount'] || 1,
                otherAssets: botJson['other-assets'] || [],
                otherAssetsBuyAmount: botJson['other-assets-buy-amount'] || 0,
                minOrderAmount: botJson['min-order-amount'] || 12
            }));
        } else {

        }
    }

    for (const bot of BOTS) bot.start();
}
