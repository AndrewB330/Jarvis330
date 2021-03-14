export interface JEvent {
    name: string;
    time: number;
    args: {};
}

export interface EventConsumer {
    process(event: JEvent): Promise<void>;
}

export class EventsManager {
    private static eventConsumers: EventConsumer[] = [];

    static dispatch(name: string, args: {}) {
        for (const consumer of EventsManager.eventConsumers) {
            consumer.process({name, time: Date.now(), args}).catch((e) => {
                console.error(e);
            });
        }
    }

    static addConsumer(consumer: EventConsumer) {
        EventsManager.eventConsumers.push(consumer);
    }
}
