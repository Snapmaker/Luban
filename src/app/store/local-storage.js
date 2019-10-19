import isElectron from 'is-electron';
import path from 'path';
import settings from '../config/settings';
import log from '../lib/log';
import ImmutableStore from '../lib/immutable-store';

let userData = null;
const stores = {};

// Check if code is running in Electron renderer process
if (isElectron()) {
    const electron = window.require('electron');
    const app = electron.remote.app;
    userData = {
        path: path.join(app.getPath('userData'), 'cnc.json')
    };
}

const getUserConfig = (name) => {
    const cnc = {
        version: settings.version,
        state: {}
    };

    try {
        let data;

        if (userData) {
            const fs = window.require('fs'); // Use window.require to require fs module in Electron
            if (fs.existsSync(userData.path)) {
                data = JSON.parse(fs.readFileSync(userData.path, 'utf8') || '{}');
            }
        } else {
            data = JSON.parse(localStorage.getItem(`Snapmaker-${name}`) || '{}');
        }

        if (typeof data === 'object') {
            cnc.version = data.version || cnc.version; // fallback to current version
            cnc.state = data.state || cnc.state;
        }
    } catch (e) {
        log.error(e);
    }

    return cnc;
};

const getLocalStore = (name) => {
    if (stores[name]) {
        return stores[name];
    } else {
        const localStore = getUserConfig(name) || { state: {} };
        const store = new ImmutableStore(localStore.state);

        store.on('change', (s) => {
            try {
                const value = JSON.stringify({
                    version: settings.version,
                    state: s
                }, null, 4);

                if (userData) {
                    const fs = window.require('fs'); // Use window.require to require fs module in Electron
                    fs.writeFileSync(userData.path, value);
                }
                localStorage.setItem(`Snapmaker-${name}`, value);
            } catch (e) {
                log.error(e);
            }
        });

        return store;
    }
};
export const widgetStore = getLocalStore('widget');
export const machineStore = getLocalStore('machine');

export const storeManager = {
    widgetStore,
    machineStore
};
