import isElectron from 'is-electron';
import path from 'path';
import get from 'lodash/get';
import set from 'lodash/set';
import includes from 'lodash/includes';
import uniq from 'lodash/uniq';
import difference from 'lodash/difference';
import merge from 'lodash/merge';
import semver from 'semver';
import ensureArray from '../lib/ensure-array';
import settings from '../config/settings';
import ImmutableStore from '../lib/immutable-store';
import log from '../lib/log';

let userData = null;

// Check if code is running in Electron renderer process
if (isElectron()) {
    const electron = window.require('electron');
    const app = electron.remote.app;
    userData = {
        path: path.join(app.getPath('userData'), 'cnc.json')
    };
}

// Also see "containers/Workspace/WidgetManager/index.jsx"
export const defaultState = {
    session: {
        name: '',
        token: ''
    },
    // recently used machine
    machine: {
        size: {
            x: 125,
            y: 125,
            z: 125
        }
    },
    workspace: {
        container: {
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
                    'axes', 'gcode'
                ]
            }
        }
    },
    widgets: {
        axes: {
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
            }
        },
        connection: {
            minimized: false,
            controller: {
                type: 'Marlin' // Grbl|Marlin|Smoothie|TinyG
            },
            port: '',
            baudrate: 115200,
            autoReconnect: false
        },
        console: {
            minimized: false
        },
        gcode: {
            minimized: false
        },
        laser: {
            minimized: false,
            panel: {
                laserTest: {
                    expanded: true
                }
            },
            test: {
                power: 40,
                duration: 1000,
                maxS: 255
            }
        },
        marlin: {
            minimized: false
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
        }
    }
};

const normalizeState = (state) => {
    // Keep default widgets unchanged
    const defaultList = get(defaultState, 'workspace.container.default.widgets');
    set(state, 'workspace.container.default.widgets', defaultList);

    // Update primary widgets
    let primaryList = get(cnc.state, 'workspace.container.primary.widgets');
    if (primaryList) {
        set(state, 'workspace.container.primary.widgets', primaryList);
    } else {
        primaryList = get(state, 'workspace.container.primary.widgets');
    }

    // Update secondary widgets
    let secondaryList = get(cnc.state, 'workspace.container.secondary.widgets');
    if (secondaryList) {
        set(state, 'workspace.container.secondary.widgets', secondaryList);
    } else {
        secondaryList = get(state, 'workspace.container.secondary.widgets');
    }

    primaryList = uniq(ensureArray(primaryList)); // keep the order of primaryList
    primaryList = difference(primaryList, defaultList); // exclude defaultList

    secondaryList = uniq(ensureArray(secondaryList)); // keep the order of secondaryList
    secondaryList = difference(secondaryList, primaryList); // exclude primaryList
    secondaryList = difference(secondaryList, defaultList); // exclude defaultList

    set(state, 'workspace.container.primary.widgets', primaryList);
    set(state, 'workspace.container.secondary.widgets', secondaryList);

    return state;
};

const getUserConfig = () => {
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
            data = JSON.parse(localStorage.getItem('Snapmaker') || '{}');
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

const cnc = getUserConfig() || {};
const state = normalizeState(merge({}, defaultState, cnc.state || {}));
const store = new ImmutableStore(state);

store.on('change', (state) => {
    try {
        const value = JSON.stringify({
            version: settings.version,
            state: state
        }, null, 4);

        if (userData) {
            const fs = window.require('fs'); // Use window.require to require fs module in Electron
            fs.writeFileSync(userData.path, value);
        }
        localStorage.setItem('Snapmaker', value);
    } catch (e) {
        log.error(e);
    }
});

//
// Migration
//
const migrateStore = () => {
    if (!cnc.version) {
        return;
    }

    // 1.9.0
    // * Renamed "widgets.probe.tlo" to "widgets.probe.touchPlateHeight"
    // * Removed "widgets.webcam.scale"
    if (semver.lt(cnc.version, '1.9.0')) {
        // Probe widget
        const tlo = store.get('widgets.probe.tlo');
        if (tlo !== undefined) {
            store.set('widgets.probe.touchPlateHeight', Number(tlo));
            store.unset('widgets.probe.tlo');
        }

        // Webcam widget
        store.unset('widgets.webcam.scale');
    }

    // 2.4.2
    // add widget "laser-test-focus"
    if (semver.lt(cnc.version, '2.4.2')) {
        const primaryWidgets = store.get('workspace.container.primary.widgets');

        if (!includes(primaryWidgets, 'laser-test-focus')) {
            primaryWidgets.push('laser-test-focus');
            store.set('workspace.container.primary.widgets', primaryWidgets);
        }
    }

    // 2.4.4
    // remove widget 'macro' (maybe add back later)
    if (semver.lt(cnc.version, '2.4.4')) {
        const widgets = store.get('workspace.container.secondary.widgets');

        let needUpdate = false;

        if (includes(widgets, 'macro')) {
            needUpdate = true;
            widgets.splice(widgets.indexOf('macro'), 1);
        }

        if (includes(widgets, 'probe')) {
            needUpdate = true;
            widgets.splice(widgets.indexOf('probe'), 1);
        }

        needUpdate && store.set('workspace.container.secondary.widgets', widgets);
    }

    // 2.5.3
    // Add machine setting
    if (semver.lt(cnc.version, '2.5.3')) {
        const machine = store.get('machine');

        if (!machine) {
            store.set('machine', defaultState.machine);
        }
    }
};

try {
    migrateStore();
} catch (err) {
    log.error(err);
}

export default store;
