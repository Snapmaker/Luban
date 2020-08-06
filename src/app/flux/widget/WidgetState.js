import _ from 'lodash';

import { PROTOCOL_TEXT, PROTOCOL_SCREEN, MACHINE_SERIES } from '../../constants';

const DEFAULT_STATE = {
    machine: {
        series: MACHINE_SERIES.ORIGINAL.value
    },
    workspace: {
        default: {
            widgets: ['visualizer']
        },
        left: {
            show: true,
            widgets: [
                'connection', 'console', 'marlin', 'laser-test-focus'
            ]
        },
        right: {
            show: true,
            widgets: [
                'wifi-transport', 'enclosure', 'control', 'macro', 'gcode'
            ]
        }
    },
    '3dp': {
        default: {
            widgets: ['3dp-object-list', '3dp-material', '3dp-configurations', '3dp-output']
        }
    },
    laser: {
        default: {
            widgets: ['job-type', 'cnc-laser-object-list', 'laser-set-background', 'laser-params', 'laser-output']
        }
    },
    cnc: {
        default: {
            widgets: ['job-type', 'cnc-laser-object-list', 'cnc-tool', 'cnc-path', 'cnc-output']
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
            axes: ['x', 'y', 'z', 'b'],
            jog: {
                keypad: false,
                selectedDistance: '1',
                customDistance: 10,
                selectedAngle: '1',
                customAngle: 5

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
            needRemove: false
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
const SERIES_STATES = {
    original: {},
    A150: {
        laser: {
            default: {
                widgets: ['job-type', 'cnc-laser-object-list', 'laser-params', 'laser-output']
            }
        }
    },
    A250: {
        laser: {
            default: {
                widgets: ['job-type', 'cnc-laser-object-list', 'laser-params', 'laser-output']
            }
        }
    },
    A350: {
        laser: {
            default: {
                widgets: ['job-type', 'cnc-laser-object-list', 'laser-params', 'laser-output']
            }
        }
    }
};

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

/**
 * Check elements in two arrays the same.
 */
function arrayEqual(arr1, arr2) {
    for (const elem of arr1) {
        if (!_.includes(arr2, elem)) {
            return false;
        }
    }
    for (const elem of arr2) {
        if (!_.includes(arr1, elem)) {
            return false;
        }
    }
    return true;
}

class WidgetState {
    constructor(store) {
        this.localStore = store;
        this.version = store.version;
        const state = store.state;
        this.widgetState = merge(
            {},
            {
                defaultState: DEFAULT_STATE,
                seriesStates: SERIES_STATES
            },
            {
                defaultState: state.defaultState,
                seriesStates: state.seriesStates
            }
        );

        // compatibility version
        this.versionCompatibility(this.widgetState);

        this.localStore.setState(this.widgetState);
        this.series = this.widgetState.defaultState.machine.series;
    }

    /**
     * Check compatibilities between local states when software upgrades and downgrades.
     *
     * @param widgetState
     */
    versionCompatibility(widgetState) {
        // Check workspace
        const workspace = widgetState.defaultState.workspace;
        const workspaceAllWidgets = [].concat(workspace.default.widgets)
            .concat(workspace.left.widgets)
            .concat(workspace.right.widgets);
        const defaultAllWidgets = [].concat(DEFAULT_STATE.workspace.default.widgets)
            .concat(DEFAULT_STATE.workspace.left.widgets)
            .concat(DEFAULT_STATE.workspace.right.widgets);
        if (!arrayEqual(workspaceAllWidgets, defaultAllWidgets)) {
            workspace.default.widgets = DEFAULT_STATE.workspace.default.widgets;
            workspace.left.widgets = DEFAULT_STATE.workspace.left.widgets;
            workspace.right.widgets = DEFAULT_STATE.workspace.right.widgets;
        }

        // Check 3D printing tab
        if (!arrayEqual(widgetState.defaultState['3dp'].default.widgets, DEFAULT_STATE['3dp'].default.widgets)) {
            widgetState.defaultState['3dp'].default.widgets = DEFAULT_STATE['3dp'].default.widgets;
        }
        // Check Laser tab
        if (!arrayEqual(widgetState.defaultState.laser.default.widgets, DEFAULT_STATE.laser.default.widgets)) {
            widgetState.defaultState.laser.default.widgets = DEFAULT_STATE.laser.default.widgets;
        }
        // Check CNC tab
        if (!arrayEqual(widgetState.defaultState.cnc.default.widgets, DEFAULT_STATE.cnc.default.widgets)) {
            widgetState.defaultState.cnc.default.widgets = DEFAULT_STATE.cnc.default.widgets;
        }

        // Check series widgets
        widgetState.seriesStates.original = {};
        if (!arrayEqual(widgetState.seriesStates.A150.laser.default.widgets, SERIES_STATES.A150.laser.default.widgets)) {
            widgetState.seriesStates.A150.laser.default.widgets = SERIES_STATES.A150.laser.default.widgets;
        }
        if (!arrayEqual(widgetState.seriesStates.A250.laser.default.widgets, SERIES_STATES.A250.laser.default.widgets)) {
            widgetState.seriesStates.A250.laser.default.widgets = SERIES_STATES.A250.laser.default.widgets;
        }
        if (!arrayEqual(widgetState.seriesStates.A350.laser.default.widgets, SERIES_STATES.A350.laser.default.widgets)) {
            widgetState.seriesStates.A350.laser.default.widgets = SERIES_STATES.A350.laser.default.widgets;
        }
    }

    updateTabContainer(tab, container, value) {
        const path = `${tab}.${container}`;
        return this.update(path, value);
    }

    get(path) {
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        let value = _.get(machineSeriesState, path);
        if (value === undefined) {
            value = _.get(dState, path);
        }
        return value;
    }

    set(path, value) {
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        if (_.has(machineSeriesState, path)) {
            const newVar = _.get(machineSeriesState, path);
            const v = typeof newVar === 'object' ? merge(_.isArray(newVar) ? [] : {}, newVar, value) : value;
            _.set(machineSeriesState, path, v);
            this.localStore.setState(this.widgetState);
            return this.getState();
        }
        const newVar = _.get(dState, path);
        const v = typeof newVar === 'object' ? merge(_.isArray(newVar) ? [] : {}, newVar, value) : value;
        _.set(dState, path, v);
        this.localStore.setState(this.widgetState);
        return this.getState();
    }

    unset(path) {
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        _.unset(machineSeriesState, path);
        _.unset(dState, path);
        this.localStore.setState(this.widgetState);
    }

    setWidgetState(widgetId, key, value) {
        const path = (key && key !== '') ? `widgets[${widgetId}].${key}` : `widgets[${widgetId}]`;
        return this.set(path, value);
    }

    update(path, value) {
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        if (_.has(machineSeriesState, path)) {
            const newVar = _.get(machineSeriesState, path);
            const v = typeof newVar === 'object' ? merge(_.isArray(newVar) ? [] : {}, newVar, value) : value;
            _.set(machineSeriesState, path, v);
            this.localStore.setState(this.widgetState);
            return this.getState();
        }
        if (_.has(dState, path)) {
            const newVar = _.get(dState, path);
            const v = typeof newVar === 'object' ? merge(_.isArray(newVar) ? [] : {}, newVar, value) : value;
            _.set(dState, path, v);
            this.localStore.setState(this.widgetState);
            return this.getState();
        }
        return null;
    }

    updateWidgetState(widgetId, key, value) {
        const path = `widgets[${widgetId}].${key}`;
        return this.update(path, value);
    }

    getWidgetState(widgetId, key) {
        const path = `widgets[${widgetId}}].${key}}`;
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        return _.get(machineSeriesState, path) || _.get(dState, path);
    }

    toggleWorkspaceWidgetToDefault(widgetId) {
        const defaultPath = 'workspace.default.widgets';

        const defaultWidgets = this.get(defaultPath);

        if (defaultWidgets.indexOf(widgetId) === -1) {
            const push = defaultWidgets.push(widgetId);
            return this.set(defaultPath, push);
        } else {
            defaultWidgets.splice(defaultWidgets.indexOf(widgetId), 1);
            return this.set(defaultPath, defaultWidgets);
        }
    }

    updateSeries(series) {
        this.series = series;
        const path = 'machine.series';
        return this.set(path, series);
    }

    getDefaultState() {
        return merge({}, DEFAULT_STATE, SERIES_STATES[this.series]);
    }

    getState() {
        return merge({}, this.widgetState.defaultState, this.widgetState.seriesStates[this.series]);
    }
}

export default WidgetState;
