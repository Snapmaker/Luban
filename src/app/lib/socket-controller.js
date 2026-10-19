import noop from 'lodash/noop';
import io from 'socket.io-client';
import { v4 as uuid } from 'uuid';

import { getBackendOrigin } from './backend-origin';

class SocketController {
    socket = null;

    token = '';

    callbacks = {};

    // Registrations made before connect(). The renderer now mounts before the
    // socket exists, so on/once/channel have to survive a null socket and be
    // replayed once there is one.
    pending = [];

    connectWaiters = [];

    get connected() {
        return !!(this.socket && this.socket.connected);
    }

    connect(token, next = noop) {
        if (typeof next !== 'function') {
            next = noop;
        }

        if (this.token !== '' && this.token === token && this.socket) {
            return;
        }

        this.socket && this.socket.destroy();

        this.socket = io.connect(getBackendOrigin(), {
            query: `token=${token}`,
        });

        this.socket.on('startup', () => {
            if (next) {
                next();
                next = null;
            }
        });

        const pending = this.pending;
        this.pending = [];
        for (const { method, args } of pending) {
            this[method](...args);
        }

        const waiters = this.connectWaiters;
        this.connectWaiters = [];
        for (const resolve of waiters) {
            resolve();
        }
    }

    /** Resolves once a socket exists. Already-connected callers resolve immediately. */
    whenSocketExists() {
        if (this.socket) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.connectWaiters.push(resolve);
        });
    }

    disconnect() {
        this.socket && this.socket.destroy();
        this.socket = null;
    }

    emit(event, ...args) {
        setTimeout(() => {
            this.socket && this.socket.emit(event, ...args);
        }, 200);
    }

    on(eventName, callback) {
        if (!this.socket) {
            this.pending.push({ method: 'on', args: [eventName, callback] });
            return;
        }
        if (!this.callbacks[eventName]) {
            this.callbacks[eventName] = [];
        }
        const callbacks = this.callbacks[eventName];
        if (callbacks) {
            callbacks.push(callback);
        }
        this.socket.on(eventName, (...args) => {
            for (const callback1 of callbacks) {
                callback1(...args);
            }
        });
    }

    once(eventName, callback) {
        if (!this.socket) {
            this.pending.push({ method: 'once', args: [eventName, callback] });
            return this;
        }
        this.socket.once(eventName, (...args) => {
            callback(...args);
        });

        return this;
    }

    channel(topic, params, onMessage) {
        if (!this.socket) {
            return this.whenSocketExists().then(() => this.channel(topic, params, onMessage));
        }
        return new Promise((resolve, reject) => {
            const actionid = uuid();
            const listener = (_actionid, _STATUS_, result) => {
                if (actionid === _actionid) {
                    if (_STATUS_ === 'next') {
                        onMessage && onMessage(result);
                    } else if (_STATUS_ === 'complete') {
                        resolve();
                        this.socket.off(topic, listener);
                    } else if (_STATUS_ === 'error') {
                        reject();
                        this.socket.off(topic, listener);
                    }
                }
            };
            this.socket.on(topic, listener);
            this.emit(topic, actionid, params);
        });
    }
}

const socketController = new SocketController();

export default socketController;
