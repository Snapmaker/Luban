import Mousetrap from 'mousetrap';

import { getLogger } from '../log';
import { PREDEFINED_SHORTCUT_KEYS } from './constants';


const log = getLogger('ShortcutManager');

type ShortcutActionName = string | symbol;

type ShortcutActionKeys = string | string[];

type ShortcutCallback = () => void;

type ShortcutAction = {
    keys?: ShortcutActionKeys;
    callback?: ShortcutCallback;
    keyupCallback?: ShortcutCallback;
};

/**
 * Priority for a handler.
 */
export enum ShortcutHandlerPriority {
    App = 0,
    Page = 1,
    View = 2,
}

export interface ShortcutHandler {
    // handler name
    title?: string;

    // priority of handler
    priority: ShortcutHandlerPriority;

    // function to check if shortcut is active
    isActive: () => boolean;

    // shortcuts
    shortcuts: { [name: ShortcutActionName]: ShortcutCallback | ShortcutAction };

    // callbacks
    eventCallbacks?: { [key: string]: ShortcutCallback }
}

/**
 * Unify action keys by convert them to lower case.
 */
function unifyActionKeys(keys: ShortcutActionKeys): ShortcutActionKeys {
    if (typeof keys === 'string') {
        keys = [keys];
    }

    const keyMap = {};
    for (const key of keys) {
        keyMap[key.toLocaleLowerCase()] = true;
    }
    return Object.keys(keyMap);
}


export class ShortcutManger {
    // All handlers registered
    private handlers: ShortcutHandler[] = [];

    private checkShortcutKeys(actionName: ShortcutActionName, shortcutAction: ShortcutAction): void {
        if (!shortcutAction.keys && actionName in PREDEFINED_SHORTCUT_KEYS) {
            // Use pre-defined keys
            shortcutAction.keys = PREDEFINED_SHORTCUT_KEYS[actionName];
        }

        shortcutAction.keys = unifyActionKeys(shortcutAction.keys);
    }

    private preprocess(handler: ShortcutHandler): void {
        // Unify shortcut callback functions to ShortcutAction
        for (const actionName of Reflect.ownKeys(handler.shortcuts)) {
            const maybeShortcut = handler.shortcuts[actionName];

            let shortcutAction: ShortcutAction;
            if (typeof maybeShortcut === 'function') {
                shortcutAction = {
                    keys: '',
                    callback: maybeShortcut,
                };
            } else {
                shortcutAction = maybeShortcut;
            }

            this.checkShortcutKeys(actionName, shortcutAction);

            if (!shortcutAction.keys) {
                log.error(`Shortcut ignored, can't find shortcut keys for ${actionName.toString()}`);
                delete handler.shortcuts[actionName];
                continue;
            }

            // replace shortcut action
            handler.shortcuts[actionName] = shortcutAction;
        }

        // convert ShortcutAction to [key:event -> callback] mappings
        handler.eventCallbacks = {};
        for (const actionName of Reflect.ownKeys(handler.shortcuts)) {
            const shortcutAction = handler.shortcuts[actionName] as ShortcutAction;

            for (const key of shortcutAction.keys) {
                if (shortcutAction.callback) {
                    handler.eventCallbacks[`${key}:keydown`] = shortcutAction.callback;
                }
                if (shortcutAction.keyupCallback) {
                    handler.eventCallbacks[`${key}:keyup`] = shortcutAction.keyupCallback;
                }
            }
        }
    }

    /**
     * Register shortcut handler.
     */
    public register(handler: ShortcutHandler) {
        this.preprocess(handler);

        this.handlers.push(handler);

        for (const eventKey of Object.keys(handler.eventCallbacks)) {
            const [key, action] = eventKey.split(':');
            this.bind(key, action);
        }
    }

    /**
     * Unregister shortcut handler.
     */
    public unregister(handler: ShortcutHandler) {
        this.preprocess(handler);

        const index = this.handlers.indexOf(handler);
        if (index === -1) {
            return;
        }

        this.handlers.splice(index, 1);

        for (const eventKey of Object.keys(handler.eventCallbacks)) {
            const [key, action] = eventKey.split(':');
            this.bind(key, action);
        }
    }

    /**
     * Bind or re-bind mousetrap callback for key + action.
     */
    private bind(key: string, action: string) {
        // re-create avaiable handlers whenever bind or unbind
        const eventKey = `${key}:${action}`;
        const avaiableHandlers = this.handlers
            .filter((handler) => (handler.eventCallbacks[eventKey] !== undefined));

        if (avaiableHandlers.length > 0) {
            const mousetrapCallback = () => {
                const targetHandler = avaiableHandlers.reduce((bestHandler, currentHandler) => {
                    if (!currentHandler.isActive()) {
                        return bestHandler;
                    }

                    if (!bestHandler) {
                        return currentHandler;
                    }

                    if (currentHandler.priority === bestHandler.priority) {
                        log.warn(`mousetrap [${key}:${action}] has multiple handlers with same priority`);
                    }

                    if (currentHandler.priority > bestHandler.priority) {
                        return currentHandler;
                    }

                    return bestHandler;
                }, null);

                if (!targetHandler) {
                    log.warn(`mousetrap [${key}:${action}] ignored, no active handler available.`);

                    return true; // no prevent default
                }

                const callback = targetHandler.eventCallbacks[eventKey];
                // execute the callback
                callback();

                return false; // prevent default
            };

            Mousetrap.bind(key, mousetrapCallback, action);
        } else {
            Mousetrap.unbind(key, action);
        }
    }

    // TODO: class name changed after building
    public printList() {
        this.handlers.sort((a, b) => a.priority - b.priority);

        for (const handler of this.handlers) {
            log.info(`${handler.title}-P${handler.priority}:`);
            for (const actionName of Reflect.ownKeys(handler.shortcuts)) {
                const shortcutAction = handler.shortcuts[actionName] as ShortcutAction;

                const keys = shortcutAction.keys as string[];
                log.info(`* ${actionName.toString()}: [${keys.join(' , ')}]`);
            }
        }
    }
}

// default is a singleton of ShortcutManager
const shortcutManager = new ShortcutManger();

export default shortcutManager;
