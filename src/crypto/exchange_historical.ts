/*



const PREV_SCALE: Record<CandlestickScale, CandlestickScale> = {
    '1m': '1m',
    '3m': '1m',
    '5m': '1m',
    '15m': '5m',
    '30m': '15m',
    '1h': '30m',
    '4h': '1h',
    '8h': '4h',
    '1d': '8h',
    '3d': '1d',
    '1w': '1d',
    '1M': '1d',
};


export class HistoricalMarket implements Market {

    private readonly initialScale = '1m';
    private candlesticks = new Map<CandlestickScale, Candlestick[]>();
    private candlesticks1m: Candlestick[] = [];
    private lastCandlestickIndex = 0;
    private symbolInfo: SymbolInfo;

    constructor(public symbol: Symbol, public clock: HistoricalClock) {
    }

    private static compressCandlesticks(candlesticks: Candlestick[], targetScale: CandlestickScale): Candlestick[] {
        console.assert(candlesticks.length > 2);
        const res: Candlestick[] = [];
        const targetScaleToMilliseconds = CandlestickScaleToSeconds(targetScale) * 1000;
        const ratio = Math.round(targetScaleToMilliseconds / (candlesticks[1].closeTime - candlesticks[1].openTime));
        let start = 0;
        while (start < candlesticks.length && candlesticks[start].openTime % targetScaleToMilliseconds !== 0) {
            start++;
        }
        let prevBucket = -2;
        for (let i = 0; i < candlesticks.length; i++) {
            const curBucket = Math.floor((i - start) / ratio + 1e-6);
            if (curBucket !== prevBucket) {
                res.push({...candlesticks[i]});
                prevBucket = curBucket;
            } else {
                const last = res[res.length - 1];
                last.closeTime = candlesticks[i].closeTime;
                last.close = candlesticks[i].close;
                last.high = Math.max(last.high, candlesticks[i].high);
                last.low = Math.min(last.low, candlesticks[i].low);
                last.quoteVolume += candlesticks[i].quoteVolume;
                last.baseVolume += candlesticks[i].baseVolume;
            }
        }
        return res;
    }

    getSymbol() {
        return this.symbol;
    }

    async getOrderBook(): Promise<OrderBook> {
        // pretending that there is something... :)
        return {
            asks: [{price: await this.getLastPrice() + await this.getPriceStep(), amount: this.symbolInfo.amountMin * 100}],
            bids: [{price: await this.getLastPrice() - await this.getPriceStep(), amount: this.symbolInfo.amountMin * 100}]
        };
    }

    async getPricePrecision(): Promise<number> {
        return this.symbolInfo.pricePrecision;
    }

    async getPriceStep(): Promise<number> {
        return this.symbolInfo.priceStep;
    }

    async getLotPrecision(): Promise<number> {
        return this.symbolInfo.amountPrecision;
    }

    async getLotStep() {
        return this.symbolInfo.amountStep;
    }

    async initialize() {
        this.symbolInfo = await getSymbolInfo(this.symbol);
        this.candlesticks1m = await getCachedCandles(this.symbol, this.initialScale);
        this.candlesticks.set(this.initialScale, this.candlesticks1m);
        if (this.clock.getTime() < this.candlesticks1m[0].closeTime) {
            this.clock.reset(this.candlesticks1m[0].closeTime);
        }

        for (const target of SCALES.slice(1)) {
            const source = PREV_SCALE[target];
            this.candlesticks.set(target, HistoricalMarket.compressCandlesticks(this.candlesticks.get(source), target));
        }
    }

    async getCandlestickSeries(scale: CandlestickScale, length: number): Promise<CandlestickSeries> {
        this.updateLastCandlestickIndex();
        const ratio = CandlestickScaleToMinutes(scale);
        let index = Math.round(this.lastCandlestickIndex / ratio);
        const candlesticks = this.candlesticks.get(scale);
        while (index + 1 < candlesticks.length && candlesticks[index].closeTime < this.clock.getTime()) {
            index++;
        }
        while (index > 0 && candlesticks[index].openTime > this.clock.getTime()) {
            index--;
        }
        const left = Math.max(index - length + 1, 0);
        return new CandlestickSeries(candlesticks.slice(left, index + 1));
    }

    async e() {
        this.updateLastCandlestickIndex();
        return this.candlesticks1m[this.lastCandlestickIndex].close; // todo: close? open? average? or add interpolation?
    }

    getAggregatedCandle(start: number): Candlestick {
        this.updateLastCandlestickIndex();
        const startIdx = this.getCandlestickIndex(start) + 1;
        const res = this.candlesticks1m[startIdx];
        for (let i = startIdx + 1; i <= this.lastCandlestickIndex; i++) {
            res.closeTime = this.candlesticks1m[i].closeTime;
            res.close = this.candlesticks1m[i].close;
            res.high = Math.max(res.high, this.candlesticks1m[i].high);
            res.low = Math.min(res.low, this.candlesticks1m[i].low);
            res.quoteVolume += this.candlesticks1m[i].quoteVolume;
            res.baseVolume += this.candlesticks1m[i].baseVolume;
        }
        return res;
    }

    private updateLastCandlestickIndex() {
        if (this.candlesticks1m[this.lastCandlestickIndex].openTime <= this.clock.getTime() &&
            this.candlesticks1m[this.lastCandlestickIndex].closeTime >= this.clock.getTime()) {
            return;
        }
        while (this.candlesticks1m[this.lastCandlestickIndex].closeTime < this.clock.getTime() &&
        this.lastCandlestickIndex + 1 < this.candlesticks1m.length) {
            this.lastCandlestickIndex++;
        }
        while (this.candlesticks1m[this.lastCandlestickIndex].openTime > this.clock.getTime() &&
        this.lastCandlestickIndex - 1 >= 0) {
            this.lastCandlestickIndex--;
        }
    }

    private getCandlestickIndex(time: number): number {
        let l = -1;
        let r = this.candlesticks1m.length - 1;
        while (l < r - 1) {
            const m = Math.floor((l + r) / 2);
            if (this.candlesticks1m[m].closeTime >= time) {
                r = m;
            } else {
                l = m;
            }
        }
        return r;
    }

    async getMinLotSize(): Promise<number> {
        return this.symbolInfo.amountMin;
    }

    async getLastPrice(): Promise<number> {
        this.updateLastCandlestickIndex();
        return this.candlesticks1m[this.lastCandlestickIndex].close;
    }
}


export class HistoricalTradingAccount extends TradingAccount {
    private marketCache = new DataCache<HistoricalMarket>();
    private assets = new Map<string, TradingAssetBalance>();
    private symbols: Symbol[] = [];
    private openOrders = new Map<string, Order[]>();
    private executedOrders = new Map<string, Order[]>();
    private orderIdCounter = 0;

    constructor(private clock: HistoricalClock) {
        super();
    }

    async cancelOrder(id: OrderId): Promise<boolean> {
        for (const orders of this.openOrders.values()) {
            for (let i = 0; i < orders.length; i++) {
                if (orders[i].orderId === id) {
                    orders.splice(i, 1);
                    i--;
                    return true;
                }
            }
        }
        return false;
    }

    async getOpenOrders(symbol?: Symbol): Promise<Order[]> {
        if (symbol) {
            return this.openOrders.get(symbolToBinanceStr(symbol)) || [];
        }
        const orders: Order[] = [];
        for (const o of this.openOrders.values()) {
            orders.push(...o);
        }
        return orders;
    }

    async getOrders(symbol?: Symbol): Promise<Order[]> {
        if (symbol) {
            return (await this.getOpenOrders(symbol)).concat(this.executedOrders.get(symbolToBinanceStr(symbol)) || []);
        }
        const orders: Order[] = await this.getOpenOrders();
        for (const o of this.executedOrders.values()) {
            orders.push(...o);
        }
        return orders;
    }

    async checkIfOrderPossible(symbol: Symbol, side: Side, amount: number): Promise<boolean> {
        const usdtValue = await this.convertAsset({asset: symbol.base, amount}, 'USDT');
        if (usdtValue.amount < 11) {
            return false;
        }

        if (side === 'BUY') {
            if (!this.assets.has(symbol.quote)) {
                return false;
            }
            getOrSet(this.assets, symbol.base, {
                asset: symbol.base,
                free: 0,
                amount: 0,
                locked: 0
            });
        } else {
            if (!this.assets.has(symbol.base)) {
                return false;
            }
            getOrSet(this.assets, symbol.quote, {
                asset: symbol.quote,
                free: 0,
                amount: 0,
                locked: 0
            });
        }
        return true;
    }

    async makeLimitOrder(symbol: Symbol, side: Side, amount: number, price: number): Promise<OrderId> {
        const symbolStr = symbolToBinanceStr(symbol);

        if (!await this.checkIfOrderPossible(symbol, side, amount)) {
            return '';
        }

        if (side === 'BUY') {
            const balance = this.assets.get(symbol.quote);
            if (amount * price > balance.free) {
                return '';
            }
            balance.locked += amount * price;
            balance.free = balance.amount - balance.locked;
        } else {
            const balance = this.assets.get(symbol.base);
            if (amount > balance.free) {
                return '';
            }
            balance.locked += amount;
            balance.free = balance.amount - balance.locked;
        }

        const orderId = `limit${this.orderIdCounter++}`;

        getOrSet(this.openOrders, symbolStr, []).push({
            orderId,
            orderType: 'Limit',
            orderStatus: 'NEW',
            side,
            symbol,
            amount,
            price,
            executedBaseAmount: 0,
            cumulativeQuoteAmount: 0,
            creationTime: this.clock.getTime(),
            updateTime: this.clock.getTime(),
            refreshTime: this.clock.getTime()
        });

        return orderId;
    }

    addAsset(asset: string, amount: number) {
        const balance = getOrSet(this.assets, asset, {
            asset,
            amount: 0,
            free: 0,
            locked: 0
        });
        balance.amount += amount;
        balance.free += amount;
    }

    async makeMarketOrder(symbol: Symbol, side: Side, amount: number): Promise<OrderId> {
        const market = await this.getMarket(symbol);
        // TODO: some dirty hacks....
        if (side === 'BUY') {
            return this.makeLimitOrder(symbol, side, amount, await market.getLastPrice() * 1.001);
        } else {
            return this.makeLimitOrder(symbol, side, amount, await market.getLastPrice() * 0.999);
        }
    }

    async initialize() {
        this.symbols = await getAllSymbols();

        this.clock.onTick(async () => {
            for (const order of await this.getOpenOrders()) {
                const market = await this.getMarket(order.symbol);
                const aggregated = (market as HistoricalMarket).getAggregatedCandle(order.refreshTime);
                const baseBalance = this.assets.get(order.symbol.base);
                const quoteBalance = this.assets.get(order.symbol.quote);
                let executed = false;
                if (order.orderType === 'Limit') {
                    if (order.side === 'BUY' && aggregated.low < order.price) {
                        order.cumulativeQuoteAmount = order.amount * Math.min(order.price, aggregated.high);
                        executed = true;
                    } else if (order.side === 'SELL' && aggregated.high > order.price) {
                        order.cumulativeQuoteAmount = order.amount * Math.max(order.price, aggregated.low);
                        executed = true;
                    }
                    if (executed) {
                        order.orderStatus = 'FILLED';
                        order.executedBaseAmount = order.amount;
                        order.updateTime = this.clock.getTime();
                        if (order.side === 'BUY') {
                            baseBalance.amount += order.amount;
                            baseBalance.free = baseBalance.amount - baseBalance.locked;
                            quoteBalance.amount -= order.cumulativeQuoteAmount;
                            quoteBalance.locked = quoteBalance.amount - quoteBalance.free;
                        } else {
                            quoteBalance.amount += order.cumulativeQuoteAmount;
                            quoteBalance.free = baseBalance.amount - baseBalance.locked;
                            baseBalance.amount -= order.amount;
                            baseBalance.locked = quoteBalance.amount - quoteBalance.free;
                        }
                    }
                } else {
                    // todo: stop order
                }

                order.refreshTime = this.clock.getTime();
            }

            for (const symbolStr of this.openOrders.keys()) {
                const ordersTmp = this.openOrders.get(symbolStr);
                this.openOrders.set(symbolStr, []);
                const openOrders = this.openOrders.get(symbolStr);
                const executedOrders = getOrSet(this.executedOrders, symbolStr, []);
                for (const order of ordersTmp) {
                    if (order.orderStatus === 'FILLED' || order.orderStatus === 'CANCELED') {
                        executedOrders.push(order);
                    } else {
                        openOrders.push(order);
                    }
                }
            }
        });
    }

    async getMarket(symbol: Symbol): Promise<Market> {
        return this.marketCache.getOrUpdate(symbolToBinanceStr(symbol), async () => {
            const market = new HistoricalMarket(symbol, this.clock);
            await market.initialize();
            return market;
        });
    }

    async getAllSymbols(): Promise<Symbol[]> {
        return this.symbols;
    }

    async getAssetBalance(asset: string): Promise<TradingAssetBalance> {
        if (!this.assets.has(asset)) {
            this.assets.set(asset, {
                asset,
                amount: 0,
                free: 0,
                locked: 0
            });
        }
        return this.assets.get(asset);
    }

    async getAllAssetBalances(): Promise<TradingAssetBalance[]> {
        return [...this.assets.values()];
    }

    async getAllTickers(): Promise<Ticker[]> {
        const tickers: Ticker[] = [];
        for (const market of this.marketCache.values()) {
            const orderBook = await market.getOrderBook();
            tickers.push({
                symbol: market.getSymbol(),
                bidPrice: orderBook.bids[0].price,
                askPrice: orderBook.asks[0].price,
                price: await market.getLastPrice()
            });
        }
        return tickers;
    }
}

*/
