// define observer pattern for react components.
// Usage:
// 1. import { Observer } from './observer';
// 2. const cancelfn = Observer.on('event', (event, data) => { ...  });
// 3. Observer.notify('event', {...datas});
// 4. cancelfn(); // cancel the observer

// the callback function for events.
// get called when the event is notified.
// event: the event name.
// data: the data for the event.
export type ObserverCallbackFn = (event: string, data: any) => void;
// the type of the cancel function, to cancel the registered events.
export type CancelFn = () => void;

// generate a unique id.

let next = 0;
function genId(): number {
    return next++;
}

export interface MainMessage {
    event: string;
    data: any;
}

const observerFromMainChannel = 'observer-from-main';

// the observer class.
export class Observer {
    // the evnet->handlers map, use static to make it a singleton.
    // map: event -> (id -> handler)
    // id is the unique id for the handler.
    private static _observers: Map<string, Map<number, ObserverCallbackFn>> = new Map();
    private static _lisentingMain = false;

    static listenMain() {
        main.ipc.on(observerFromMainChannel, (event: any, message: MainMessage) => {
            console.log('Observer.listenMain', message.event, message.data);
            if (!this._observers.has(message.event)) {
                return;
            }
            this._observers.get(message.event)?.forEach((fn) => {
                console.log('Observer.listenMain call');
                fn(message.event, message.data);
            });
        });
    }

    // register an event handler, return a cancel function for unregistering.
    static on(event: string, fn: ObserverCallbackFn): CancelFn {
        console.log('Observer.on register', event);

        if (!this._lisentingMain) {
            this.listenMain();
            this._lisentingMain = true;
        }

        if (!this._observers.has(event)) {
            this._observers.set(event, new Map<number, ObserverCallbackFn>());
        }

        const id = genId();
        this._observers.get(event).set(id, fn);
        console.log('Observer.on register', event, 'id', id);
        return () => {
            if (this._observers.has(event)) {
                console.log('Observer.on unregister', event, 'id', id);
                this._observers.get(event).delete(id);
            }
        };
    }

    // cancel all the handlers for the event.
    static cancel(event: string) {
        this._observers.delete(event);
    }

    // cancel all the handlers.
    static clear() {
        this._observers.clear();
    }

    // Trigger the event, call all the handlers for the event.
    // event: the event name.
    // data: the data for the event, pass to the handlers.
    // The handlers can get the event name and data from the parameters.
    static notify(event: string, data: any) {
        console.log('Observer.notify', event, data);

        this._observers.get(event)?.forEach((fn) => {
            fn(event, data);
        });
    }
}

