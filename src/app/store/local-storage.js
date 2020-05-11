import isElectron from 'is-electron';
import path from 'path';
import _ from 'lodash';
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
        path: {
            'widget': path.join(app.getPath('userData'), 'widget.json'),
            'machine': path.join(app.getPath('userData'), 'machine.json')
        }
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
            if (fs.existsSync(userData.path[name])) {
                data = JSON.parse(fs.readFileSync(userData.path[name], 'utf8') || '{}');
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

        localStore.version && (store.version = localStore.version);
        store.on('change', (s) => {
            try {
                const value = JSON.stringify({
                    version: settings.version,
                    state: s
                }, null, 4);

                if (userData) {
                    const fs = window.require('fs'); // Use window.require to require fs module in Electron
                    fs.writeFileSync(userData.path[name], value);
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

const storeManager = {
    widgetStore,
    machineStore,
    clear: () => {
        machineStore.clear();
        widgetStore.clear();
    },
    get: () => {
        return _.merge(machineStore.get(), widgetStore.get());
    }
};
export default storeManager;
