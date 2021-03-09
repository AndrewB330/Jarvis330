export function getOrSet<K, V>(map: Map<K, V>, key: K, value: V) {
    if (!map.has(key)) {
        map.set(key, value);
    }
    return map.get(key);
}

export class DataCache<T> {
    private map = new Map<string, T>();
    private updateTime = new Map<string, number>();

    constructor(private expirationTime = 0) {
    }

    async getOrUpdate(key: string, updater: (() => Promise<T>) | (() => T)): Promise<T> {
        if (this.isExpired(key)) {
            this.updateTime.set(key, Date.now());
            this.map.set(key, await updater());
        }
        return this.map.get(key);
    }

    values(): T[] {
        return [...this.map.values()];
    }

    private isExpired(key: string) {
        return !this.updateTime.has(key) ||
            (this.updateTime.get(key) + this.expirationTime > Date.now() && this.expirationTime > 0);
    }
}

export async function sleep(ms): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function numberFmt(price: number | string, precision: number, mod = '', suffix = '', prefix = '') {
    if (precision >= 0) {
        if (typeof price === "string") {
            price = Number(price).toFixed(precision);
        } else {
            price = price.toFixed(precision);
        }
    }
    if (typeof price !== "string") {
        price = price.toString();
    }
    if (precision === 0 && mod === 'u') {
        let numberTemp = price.slice(-3);
        for (let i = 3; i < price.length; i += 3) {
            numberTemp = price.slice(-i - 3, -i) + '_' + numberTemp;
        }
        price = numberTemp;
    }
    if (precision > 0) {
        price = price.replace(/0+$/, '');
        price = price.replace(/\.+$/, '');
    }
    if (suffix === undefined) {
        suffix = '';
    }
    if (mod) {
        return `<${mod}>${prefix}${price}${suffix}</${mod}>`;
    }
    return `${prefix}${price}${suffix}`;
}

export function roundToPrecision(value: number, precision: number): number {
    console.assert(precision >= 0);
    // @ts-ignore
    return Number(Math.round(value + 'e' + precision) + 'e-' + precision);
}

export function floorToPrecision(value: number, precision: number): number {
    console.assert(precision >= 0);
    // @ts-ignore
    return Number(Math.floor(value + 'e' + precision) + 'e-' + precision);
}

export function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
