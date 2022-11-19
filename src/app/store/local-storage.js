import isElectron from 'is-electron';
import path from 'path';
import semver from 'semver';
import _ from 'lodash';
import settings from '../config/settings';
import log from '../lib/log';
import ImmutableStore from '../lib/immutable-store';

let userData = null;
const stores = {};

// Check if code is running in Electron renderer process
if (isElectron()) {
    const { app } = window.require('@electron/remote');
    userData = {
        path: {
            'widget': path.join(app.getPath('userData'), 'widget.json'),
            'machine': path.join(app.getPath('userData'), 'machine.json'),
            'printing': path.join(app.getPath('userData'), 'printing.json'),
            'editor': path.join(app.getPath('userData'), 'editor.json')
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
export const printingStore = getLocalStore('printing');
export const editorStore = getLocalStore('editor');


if (semver.gte(settings.version, '4.2.2')) {
    const printingCustomConfigs = machineStore.get('printingCustomConfigs');
    if (printingCustomConfigs && Object.prototype.toString.call(printingCustomConfigs) === '[object String]') {
        const customConfigsArray = printingCustomConfigs.split('-');
        const excludeConfigs = ['retraction_enable', 'retract_at_layer_change', 'retraction_amount', 'retraction_speed', 'retraction_hop_enabled', 'retraction_hop'];
        const modifiedCustomConfigs = customConfigsArray.filter((str) => excludeConfigs.indexOf(str) === -1);
        machineStore.set('printingCustomConfigs', modifiedCustomConfigs.join('-'));
    }
}

const storeManager = {
    widgetStore,
    machineStore,
    printingStore,
    editorStore,
    clear: () => {
        machineStore.clear();
        widgetStore.clear();
        printingStore.clear();
        editorStore.clear();
    },
    get: () => {
        return _.merge(machineStore.get(), widgetStore.get(), printingStore.get(), editorStore.get());
    }
};
export default storeManager;
