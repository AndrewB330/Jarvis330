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

export type BinanceAccount = 'Accumulation' | 'Main';
export type BotName = 'accumulation';

export interface BinanceCredentials {
    apiKey: string;
    apiSecret: string;
}

export class BinanceConfig {
    static getCredentials(account: BinanceAccount) : BinanceCredentials {
        return {
            apiKey: configJSON['binance'][account.toLowerCase()]['api-key'],
            apiSecret: configJSON['binance'][account.toLowerCase()]['api-secret'],
        };
    }
}

export class CommonConfig {
    static getGMT(): number {
        return configJSON['common']['gmt'];
    }
}

export class BotConfig {
    static getAccumulationBotConfig(botName: BotName): AccumulationBotConfig {
        return {
            quoteAsset: configJSON['bots'][botName]['quote-asset'],

            mainAsset: configJSON['bots'][botName]['main-asset'],
            mainAssetBuyAmount: configJSON['bots'][botName]['main-asset-buy-amount'],

            otherAssets: configJSON['bots'][botName]['other-assets'],
            otherAssetsBuyAmount: configJSON['bots'][botName]['other-assets-buy-amount'],

            minOrderAmount: configJSON['bots'][botName]['min-order-amount']
        };
    }
}
