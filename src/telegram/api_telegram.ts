import {Context, Telegraf} from "telegraf";
import {TelegramConfig} from "../config";
import {readFileSync} from "fs";

const TELEGRAM_API = new Telegraf(TelegramConfig.getBotToken());
const ADMIN_CHAT_ID = TelegramConfig.getAdminChatId();

interface KeyboardButton {
    text: string;
    handler: () => Promise<void>;
}

/*,
            reply_markup: {
                keyboard:
                    [[{
                        text: 'Hello!'
                    }]]
            }*/

const KEYBOARD = [];

export class Telegram {
    static async sendMsgToChat(msg: string, chat: number) {
        await TELEGRAM_API.telegram.sendMessage(chat, msg, {parse_mode: 'HTML'});
    }

    static async sendMsgWithPhotoToChat(msg: string, photo: string, chat: number) {
        // @ts-ignore
        await TELEGRAM_API.telegram.sendPhoto(chat, {source: photo}, {caption: msg, parse_mode: 'HTML'});
    }

    static addKeyboardButton(button: KeyboardButton) {
        KEYBOARD.push(button);
    }

    static async sendMsgToAdmin(msg) {
        await Telegram.sendMsgToChat(msg, ADMIN_CHAT_ID);
    }

    static async sendMsgWithPhotoToAdmin(msg, photo) {
        await Telegram.sendMsgWithPhotoToChat(msg, photo, ADMIN_CHAT_ID);
    }
}

async function checkIfNotAdminAndReply(ctx: Context): Promise<boolean> {
    if (ctx.chat.id !== ADMIN_CHAT_ID) {
        await ctx.replyWithHTML('Sorry, I serve only to my <b>Master</b>. 🧐');
        return true;
    }
    return false;
}

TELEGRAM_API.start(async (ctx) => {
    if (await checkIfNotAdminAndReply(ctx)) {
        return;
    }
    await ctx.replyWithHTML('Hello, my <b>Master</b>! 😎');
});

export function startTelegramBot() {
    TELEGRAM_API.launch().then(() => console.log('Polling started.')).catch(console.log);
}



