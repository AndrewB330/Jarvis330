import {BinanceExchangeAccount} from "./crypto/exchange_binance";
import {getBinanceApi} from "./crypto/api_binance";
import {AccumulationBot} from "./crypto/bot_accumulation";
import {RealtimeClock} from "./crypto/clock";
import {startTelegramBot, Telegram} from "./telegram/api_telegram";
import {BotConfig, BotName} from "./config";

const realtimeClock = new RealtimeClock();

function startAccumulationBot(botName: BotName) {
    const exchangeAccount = new BinanceExchangeAccount(getBinanceApi('Accumulation'));
    const accumulationBot = new AccumulationBot(
        botName,
        exchangeAccount,
        realtimeClock,
        BotConfig.getAccumulationBotConfig(botName)
    );
    accumulationBot.start();
    accumulationBot.enableNotifications();
}

(async function main() {

    startTelegramBot();
    startAccumulationBot('accumulation');

    await Telegram.sendMsgToAdmin('<b>Bot started.</b>');

})();
