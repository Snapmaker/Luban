import Mousetrap from 'mousetrap';


import { actionKeys, priorities } from './constants';

function parseCombokeys(comboKeys) {
    if (typeof comboKeys === 'string') {
        comboKeys = [comboKeys];
    }

    const keyMap = {};
    for (const comboKey of comboKeys) {
        keyMap[comboKey.toLocaleLowerCase()] = true;
    }
    return Object.keys(keyMap);
}

class CShortcutManger {
    _handlers = [];

    _comboKeyCallbackMap = {};

    /**
     *
     * @param {
     *  title: string(option),
     *  priority: number,
     *  isActive: function,
     *  shortcuts:{
     *      [actionName]:function || {keys,callback:function}
     *  }
     * } handler : readonly
     */
    register(handler) {
        if (!(handler.priority in Object.values(priorities))) {
            console.warn(`ShortcutManger: handler(${handler.title || 'unNamed'}).priority not set!`);
            handler.priority = -1;
        }
        if (typeof handler.isActive !== 'function') {
            console.warn(`ShortcutManger: handler(${handler.title || 'unNamed'}).isActive not set!`);
        }
        this._handlers.push(handler);

        for (const actionName of Reflect.ownKeys(handler.shortcuts)) {
            const shortcut = handler.shortcuts[actionName];
            let comboKeys;
            if (!shortcut) {
                console.error('ShortcutManger: shortcut ignored, can\'t find shortcut callback', actionName);
                continue;
            }
            if (shortcut.keys) {
                comboKeys = shortcut.keys;
            } else if (actionName in actionKeys) {
                comboKeys = actionKeys[actionName];
            }
            if (!comboKeys) {
                console.error("ShortcutManger: shortcut ignored, can't find shortcut combokeys", actionName);
                continue;
            }
            comboKeys = parseCombokeys(comboKeys);
            this._bind(comboKeys, handler, actionName);
        }
    }
    // TODO: unregister
    // handler should be unregistered when parent component destroyed

    printList() {
        this._handlers.sort((a, b) => a.priority - b.priority);
        const titles = [];
        for (const handler of this._handlers) {
            if (titles.indexOf(handler.title) === -1) {
                titles.push(handler.title);
            } else {
                continue;
            }
            for (let actionName of Reflect.ownKeys(handler.shortcuts)) {
                const shortcut = handler.shortcuts[actionName];
                let comboKeys;
                if (!shortcut) {
                    continue;
                }
                if (shortcut.keys) {
                    comboKeys = shortcut.keys;
                } else if (actionName in actionKeys) {
                    comboKeys = actionKeys[actionName];
                }
                if (!comboKeys) {
                    continue;
                }
                if (typeof actionName === 'symbol') actionName = actionName.toString();

                console.info(`${handler.title}-P${handler.priority} ${actionName} [${comboKeys.join(' , ')}]`);
            }
        }
    }

    _bind(comboKeys, handler, actionName) {
        for (const comboKey of comboKeys) {
            if (!this._comboKeyCallbackMap[comboKey]) {
                this._comboKeyCallbackMap[comboKey] = [];
            }
            const mapItem = this._comboKeyCallbackMap[comboKey];
            if (mapItem.length && mapItem.find((item) => item.handler.priority !== handler.priority)) {
                console.warn('ShortcutManger: same combokey exists in handlers of different priority', actionName);
            }

            mapItem.push({ handler, actionName });
            Mousetrap.bind(comboKey, (/* e, pressedKeys*/) => {
                const matched = mapItem.reduce((prev, current) => {
                    if (!current.handler.isActive()) {
                        return prev;
                    }
                    if (!prev) {
                        return current;
                    }
                    if (prev.handler.priority <= current.handler.priority) {
                        if (prev.handler.priority === current.handler.priority) {
                            console.warn(`comboKey [${comboKey}] has multiple active handler with same priority`);
                        }
                        return current;
                    }
                    return prev;
                }, null);
                if (!matched) {
                    // console.warn(`actionName [${actionName}] ignored, no matched active responser`);
                    return true;
                }
                const matchedHandler = matched.handler;

                let callback = matchedHandler.shortcuts[matched.actionName];
                if (typeof callback !== 'function' && callback.callback) {
                    callback = callback.callback;
                }
                if (typeof callback === 'function') {
                    // console.info('keyboard event trigger:', pressedKeys, matchedHandler.title, matched.actionName);
                    callback();
                    return false; // prevent default
                }
                console.warn(`actionName [${matched.actionName}] has no callback!`);
                return true;
            });
        }
    }
}

const manager = new CShortcutManger();
export default manager;
