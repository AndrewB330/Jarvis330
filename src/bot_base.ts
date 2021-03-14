import {Clock} from "./clock";
import {EventsManager} from "./events";

export class Bot {
    // noinspection JSMismatchedCollectionQueryUpdate
    protected tickers: string[] = [];
    protected started = false;

    constructor(protected name: string, protected clock: Clock) {
    }

    getName(): string {
        return this.name;
    }

    getType(): string {
        return 'base';
    }

    getGroup(): string {
        return 'base';
    }

    start(): boolean {
        if (!this.started) {
            this.started = true;
            return true;
        }
        return false;
    }

    stop() {
        this.started = false;
        for (const ticker of this.tickers) {
            this.clock.removeTicker(ticker);
        }
    }

    dispatchBotEvent(name, args) {
        EventsManager.dispatch(
            `bot-${this.getGroup()}-${this.getType()}-${name}`,
            {...args, name: this.name}
        );
    }
}
