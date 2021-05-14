import Mousetrap from 'mousetrap';

import { actionKeys, priorities } from './constants';

function parseCombokeys(comboKeys) {
    const keyMap = {};
    for (const comboKey of comboKeys) {
        keyMap[comboKey.toLocaleLowerCase()] = true;
    }
    return Object.keys(keyMap);
}

class CShortcutManger {
    _responders = [];

    _comboKeyCallbackMap = {};

    /**
     *
     * @param {
     *  title: string(option),
     *  priority: number,
     *  active: boolean,
     *  shortcuts:{
     *      [actionName]:function || {keys,callback:function}
     *  }
     * } responder : readonly
     */
    register(responder) {
        if (!(responder.priority in Object.values(priorities))) {
            console.warn(`ShortcutManger: responder(${responder.title || 'unNamed'}).priority not set!`);
            responder.priority = -1;
        }
        if (typeof responder.active !== 'boolean') {
            console.warn(`ShortcutManger: responder(${responder.title || 'unNamed'}).active not set!`);
        }
        this._responders.push(responder);

        for (const actionName of Reflect.ownKeys(responder.shortcuts)) {
            const shortcut = responder.shortcuts[actionName];
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
            this._bind(comboKeys, responder, actionName);
        }
    }
    // TODO: unregister
    // responder should be unregistered when parent component destroyed

    printList() {
        this._responders.sort((a, b) => a.priority - b.priority);
        const titles = [];
        for (const responder of this._responders) {
            if (titles.indexOf(responder.title) === -1) {
                titles.push(responder.title);
            } else {
                continue;
            }
            for (let actionName of Reflect.ownKeys(responder.shortcuts)) {
                const shortcut = responder.shortcuts[actionName];
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

                console.log(`${responder.title}-P${responder.priority} ${actionName} [${comboKeys.join(' , ')}]`);
            }
        }
    }

    _bind(comboKeys, responder, actionName) {
        for (const comboKey of comboKeys) {
            let mapItem = this._comboKeyCallbackMap[comboKey];
            if (!mapItem) {
                mapItem = [];
                this._comboKeyCallbackMap[comboKey] = mapItem;
            }
            mapItem.push({ responder, actionName });
            Mousetrap.bind(comboKey, (e, pressedKeys) => {
                const matched = mapItem.reduce((prev, current) => {
                    // console.log(current.title, current.active);
                    if (!current.responder.active) {
                        return prev;
                    }
                    if (!prev) {
                        return current;
                    }
                    if (prev.responder.priority <= current.responder.priority) {
                        if (prev.responder.priority === current.responder.priority) {
                            console.warn(`comboKey [${comboKey}] has multiple active responder with same priority`);
                        }
                        return current;
                    }
                    return prev;
                }, null);
                if (!matched) {
                    // console.warn(`actionName [${actionName}] ignored, no matched active responser`);
                    return true;
                }
                const matchedResponder = matched.responder;

                let callback = matchedResponder.shortcuts[matched.actionName];
                if (typeof callback !== 'function' && callback.callback) {
                    callback = callback.callback;
                }
                if (typeof callback === 'function') {
                    console.log('keyboard event trigger:', pressedKeys, matchedResponder.title, matched.actionName);
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
