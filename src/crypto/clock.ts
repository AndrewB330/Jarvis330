import Timeout = NodeJS.Timeout;
import {CommonConfig} from "../config";

export type ClockTicker = () => Promise<void>;

export abstract class Clock {

    static readonly SECOND = 1000;
    static readonly MINUTE = 60 * Clock.SECOND;
    static readonly HOUR = 60 * Clock.MINUTE;
    static readonly DAY = 24 * Clock.HOUR;

    abstract getTime(): number; // in UTC milliseconds

    abstract addTicker(interval: number, ticker: ClockTicker): string;

    abstract addDailyTicker(hour: number, ticker: ClockTicker): string;

    abstract removeTicker(tickerId: string): void;
}

export class RealtimeClock extends Clock {
    private tickerIdCounter = 0;
    private timeouts = new Map<string, Timeout>();

    constructor() {
        super();
    }

    getTime(): number {
        return Date.now();
    }

    addTicker(interval: number, ticker: ClockTicker): string {
        const id = `ticker${this.tickerIdCounter++}`;
        this.timeouts.set(id, setInterval(ticker, interval * 1000));
        return id;
    }

    addDailyTicker(hour: number, ticker: ClockTicker): string {
        const id = `tickerDaily${this.tickerIdCounter++}`;
        let prevHour = 0;
        this.timeouts.set(id, setInterval(async () => {
            const curHour = ((this.getTime() + CommonConfig.getGMT() * Clock.HOUR) % Clock.DAY) / Clock.HOUR;
            if (prevHour <= hour && curHour > hour) {
                await ticker();
            }
            prevHour = curHour;
        }, 10000));
        return id;
    }

    removeTicker(tickerId: string) {
        clearInterval(this.timeouts.get(tickerId));
        this.timeouts.delete(tickerId);
    }

}

/*
export class HistoricalClock implements Clock {
    private currentTime: number;
    private callback: () => Promise<void>;

    constructor(public startTime: number) {
        this.currentTime = startTime;
    }

    getTime(): number {
        return this.currentTime;
    }

    async makeStep(milliseconds: number) {
        this.currentTime += milliseconds;
        if (this.callback) {
            await this.callback();
        }
    }

    onTick(callback(): Promise<void>) {
        this.callback = callback;
    }

    reset(timestamp: number) {
        this.currentTime = this.startTime = timestamp;
    }
}
*/
