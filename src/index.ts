import {BinanceExchangeAccount} from "./crypto/exchange_binance";
import {getBinanceApi} from "./crypto/api_binance";
import {AccumulationBot} from "./crypto/bot_accumulation";
import {RealtimeClock} from "./crypto/clock";
import {startTelegramBot} from "./telegram/api_telegram";

const realtimeClock = new RealtimeClock();

function startAccumulationBot() {
    const exchangeAccount = new BinanceExchangeAccount(getBinanceApi('Accumulation'));
    const accumulationBot = new AccumulationBot('accumulation', exchangeAccount, realtimeClock);
    accumulationBot.start();
    accumulationBot.enableNotifications();
}

(async function main() {

    startTelegramBot();
    startAccumulationBot();

})();
