import Timeout = NodeJS.Timeout;
import {CommonConfig} from "./config";

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
        this.timeouts.set(id, setInterval(() => {
            ticker().catch(console.error);
        }, interval * 1000));
        return id;
    }

    addDailyTicker(hour: number, ticker: ClockTicker): string {
        const id = `tickerDaily${this.tickerIdCounter++}`;
        let prevHour = 0;
        this.timeouts.set(id, setInterval(() => {
            const curHour = ((this.getTime() + CommonConfig.getGMT() * Clock.HOUR) % Clock.DAY) / Clock.HOUR;
            if (prevHour <= hour && curHour > hour) {
                ticker().catch(console.error);
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

export class HistoricalClock extends Clock {
    private tickerIdCounter = 0;
    private tickers = new Map<string, ClockTicker>();
    private tickersDelay = new Map<string, number>();
    private tickersCur = new Map<string, number>();
    private curTime: number;

    constructor(private startTime: number) {
        super();
        this.curTime = startTime;
    }

    async step(deltaTime: number) {
        this.curTime += deltaTime;
        for (const ticker of this.tickers.keys()) {
            const delay = this.tickersDelay.get(ticker);
            let cur = this.tickersCur.get(ticker) + deltaTime;
            while (cur > delay) {
                await this.tickers.get(ticker)();
                cur -= delay;
            }
            this.tickersCur.set(ticker, cur);
        }
    }

    getTime(): number {
        return Date.now();
    }

    addTicker(interval: number, ticker: ClockTicker): string {
        const id = `ticker${this.tickerIdCounter++}`;
        this.tickers.set(id, ticker);
        this.tickersCur.set(id, 0);
        this.tickersDelay.set(id, interval * 1000);
        return id;
    }

    addDailyTicker(hour: number, ticker: ClockTicker): string {
        return '';
    }

    removeTicker(tickerId: string) {
        this.tickers.delete(tickerId);
        this.tickersCur.delete(tickerId);
        this.tickersDelay.delete(tickerId);
    }
}
