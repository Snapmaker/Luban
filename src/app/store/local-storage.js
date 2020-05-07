import semver from 'semver';
import isElectron from 'is-electron';
import path from 'path';

import _, { set, get, includes, difference, intersection, uniq } from 'lodash';
import ensureArray from '../lib/ensure-array';
import { PROTOCOL_TEXT, PROTOCOL_SCREEN, MACHINE_SERIES } from '../constants';
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

function customizer(objValue, srcValue) {
    if (_.isArray(srcValue)) {
        return srcValue;
    }
    if (typeof srcValue === 'object') {
        return _.mergeWith(objValue, srcValue, customizer);
    }
    return srcValue;
}

function merge(...args) {
    let data = args[0];
    for (let i = 1; i < args.length; i++) {
        data = _.mergeWith(data, args[i], customizer);
    }
    return data;
}


const defaultState = {
    machine: {
        series: MACHINE_SERIES.ORIGINAL.value
    },
    workspace: {
        default: {
            widgets: ['visualizer']
        },
        primary: {
            show: true,
            widgets: [
                'connection', 'console', 'marlin', 'laser-test-focus'
            ]
        },
        secondary: {
            show: true,
            widgets: [
                'wifi-transport', 'enclosure', 'control', 'macro', 'gcode'
            ]
        }
    },
    '3dp': {
        default: {
            widgets: ['3dp-material', '3dp-configurations', '3dp-output']
        }
    },
    laser: {
        default: {
            widgets: ['laser-set-background', 'laser-params', 'laser-output']
        }
    },
    cnc: {
        default: {
            widgets: ['cnc-tool', 'cnc-path', 'cnc-output']
        }
    },
    developerPanel: {
        primary: {
            widgets: [
                /* 'connectionPanel',*/
                'axesPanel', 'macroPanel'
            ]
        },
        default: {
            widgets: []
        }
    },
    widgets: {
        control: {
            minimized: false,
            headInfoExpanded: true,
            axes: ['x', 'y', 'z'],
            jog: {
                keypad: false,
                selectedDistance: '1',
                customDistance: 10
            },
            shuttle: {
                feedrateMin: 500,
                feedrateMax: 2000,
                hertz: 10,
                overshoot: 1
            },
            dataSource: PROTOCOL_TEXT
        },
        axesPanel: {
            minimized: false,
            axes: ['x', 'y', 'z'],
            jog: {
                keypad: false,
                selectedDistance: '1',
                customDistance: 10
            },
            shuttle: {
                feedrateMin: 500,
                feedrateMax: 2000,
                hertz: 10,
                overshoot: 1
            },
            dataSource: PROTOCOL_SCREEN
        },
        connection: {
            minimized: false,
            controller: {
                type: 'Marlin' // Grbl|Marlin|Smoothie|TinyG
            },
            port: '',
            baudrate: 115200,
            autoReconnect: false,
            dataSource: PROTOCOL_TEXT
        },
        connectionPanel: {
            minimized: false,
            controller: {
                type: 'Marlin' // Grbl|Marlin|Smoothie|TinyG
            },
            port: '',
            baudrate: 115200,
            autoReconnect: false,
            dataSource: PROTOCOL_SCREEN
        },
        gcode: {
            minimized: false,
            needRemove: true
        },
        macro: {
            minimized: false,
            dataSource: PROTOCOL_TEXT
        },
        macroPanel: {
            minimized: false,
            dataSource: PROTOCOL_SCREEN
        },
        marlin: {
            minimized: false,
            statusSection: {
                expanded: true
            },
            machineModalSection: {
                expanded: false
            },
            heaterControlSection: {
                expanded: true
            },
            powerSection: {
                expanded: true
            },
            overridesSection: {
                expanded: true
            }
        },
        spindle: {
            minimized: false,
            speed: 1000
        },
        visualizer: {
            minimized: false,

            // 3D View
            disabled: false,
            projection: 'orthographic', // 'perspective' or 'orthographic'
            cameraMode: 'pan', // 'pan' or 'rotate'
            gcode: {
                displayName: true
            },
            objects: {
                coordinateSystem: {
                    visible: true
                },
                toolhead: {
                    visible: true
                }
            }
        },
        webcam: {
            disabled: true,
            minimized: false,

            // local - Use a built-in camera or a connected webcam
            // mjpeg - M-JPEG stream over HTTP
            mediaSource: 'local',

            // The device id
            deviceId: '',

            // The URL field is required for the M-JPEG stream
            url: '',

            geometry: {
                scale: 1.0,
                rotation: 0, // 0: 0, 1: 90, 2: 180, 3: 270
                flipHorizontally: false,
                flipVertically: false
            },
            crosshair: false,
            muted: false
        },
        console: {
            minimized: false,
            fullscreen: false
        },
        'laser-output': {
            autoPreview: true
        },
        'cnc-output': {
            autoPreview: true
        }
    }
};
const seriesStates = {
    original: {},
    A150: {
        laser: {
            default: {
                widgets: ['laser-params', 'laser-output']
            }
        }
    },
    A250: {
        laser: {
            default: {
                widgets: ['laser-params', 'laser-output']
            }
        }
    },
    A350: {
        laser: {
            default: {
                widgets: ['laser-params', 'laser-output']
            }
        }
    }
};

function normalizeState(state) {
    // Keep default widgets unchanged
    const defaultList = get(defaultState, 'workspace.default.widgets');
    set(state, 'defaultState.workspace.default.widgets', defaultList);

    const defaultWorkspacePrimary = get(defaultState, 'workspace.primary.widgets');
    const defaultWorkspaceSecondary = get(defaultState, 'workspace.secondary.widgets');
    // Update primary widgets
    let primaryList = get(state, 'defaultState.workspace.primary.widgets');
    // Update secondary widgets
    let secondaryList = get(state, 'defaultState.workspace.secondary.widgets');
    primaryList = uniq(ensureArray(primaryList)); // keep the order of primaryList
    primaryList = intersection(primaryList, defaultWorkspacePrimary); // exclude defaultList
    secondaryList = uniq(ensureArray(secondaryList)); // keep the order of secondaryList
    secondaryList = difference(secondaryList, primaryList); // exclude primaryList
    secondaryList = intersection(secondaryList, defaultWorkspaceSecondary); // exclude defaultList
    set(state, 'defaultState.workspace.primary.widgets', primaryList);
    set(state, 'defaultState.workspace.secondary.widgets', secondaryList);

    const default3DPWidgets = get(defaultState, '3dp.default.widgets');
    const defaultLaserWidgets = get(defaultState, 'laser.default.widgets');
    const defaultCncWidgets = get(defaultState, 'cnc.default.widgets');
    let threedpWidgets = get(state, 'defaultState.3dp.default.widgets');
    let laserWidgets = get(state, 'defaultState.laser.default.widgets');
    let cncWidgets = get(state, 'defaultState.cnc.default.widgets');

    threedpWidgets = uniq(ensureArray(threedpWidgets));
    threedpWidgets = intersection(threedpWidgets, default3DPWidgets);

    laserWidgets = uniq(ensureArray(laserWidgets));
    laserWidgets = intersection(laserWidgets, defaultLaserWidgets);

    cncWidgets = uniq(ensureArray(cncWidgets));
    cncWidgets = intersection(cncWidgets, defaultCncWidgets);

    set(state, 'defaultState.3dp.default.widgets', threedpWidgets);
    set(state, 'defaultState.laser.default.widgets', laserWidgets);
    set(state, 'defaultState.cnc.default.widgets', cncWidgets);

    return state;
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
        let state;
        if (name === 'widget') {
            state = normalizeState(merge(
                {},
                {
                    defaultState,
                    seriesStates
                },
                {
                    defaultState: localStore.state.defaultState,
                    seriesStates: localStore.state.seriesStates
                }
            ));
        } else {
            state = localStore.state;
        }

        const store = new ImmutableStore(state);

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

        const migrateStore = () => {
            if (!settings.version) {
                return;
            }

            if (semver.gte(settings.version, '3.5.0') && name === 'widget') {
                const widgets = store.get('defaultState.workspace.secondary.widgets');
                let needUpdate = false;
                if (!includes(widgets, 'enclosure')) {
                    needUpdate = true;
                    widgets.splice(1, 0, 'enclosure');
                }
                needUpdate && store.set('defaultState.workspace.secondary.widgets', widgets);
            }
        };

        try {
            migrateStore();
        } catch (e) {
            log.error(e);
        }
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
