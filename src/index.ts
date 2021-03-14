import {startTelegramBot, Telegram} from "./telegram/api_telegram";
import {TelegramNotifier} from "./telegram/notifier";
import {startAllBots} from "./modules";
import {EventsManager} from './events';

(async function main() {

    EventsManager.addConsumer(new TelegramNotifier());

    startTelegramBot();
    startAllBots();

    //await Telegram.sendMsgToAdmin('<b>Bot started.</b>');

})();
