import {readFileSync} from "fs";
import {AccumulationBotConfig} from "./crypto/bot_accumulation";

// @ts-ignore
export const configJSON = JSON.parse(readFileSync('config.json'));

export class TelegramConfig {
    static getAdminChatId(): number {
        return Number(configJSON['telegram']['admin-chat-id']) || 0;
    }

    static getBotToken(): string {
        return configJSON['telegram']['bot-token'] || '';
    }
}

export class FirebaseConfig {
    static getCredentials() : {} {
        return configJSON['firebase']['credentials'];
    }
}

export interface BinanceCredentials {
    apiKey: string;
    apiSecret: string;
}

export class BinanceConfig {
    static getCredentials(accountName: string) : BinanceCredentials {
        if (!configJSON['binance'][accountName]) {
            return {
                apiKey: '',
                apiSecret: ''
            };
        }
        return {
            apiKey: configJSON['binance'][accountName]['api-key'],
            apiSecret: configJSON['binance'][accountName]['api-secret'],
        };
    }
}

export class CommonConfig {
    static getGMT(): number {
        return configJSON['common']['gmt'];
    }
}
