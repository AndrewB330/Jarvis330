import {ExchangeAccount} from "./exchange_base";
import {Clock} from "../clock";
import {EventsManager} from "../events";
import {Bot} from "../bot_base";

export class TradingBot extends Bot {

    constructor(protected name: string, protected exchangeAccount: ExchangeAccount, protected clock: Clock) {
        super(name, clock);
    }

    getType(): string {
        return 'trading';
    }

    getGroup(): string {
        return 'trading';
    }
}
