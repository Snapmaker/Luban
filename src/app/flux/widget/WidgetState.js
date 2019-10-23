import _ from 'lodash';
import { PROTOCOL_TEXT, PROTOCOL_SCREEN, MACHINE_SERIES } from '../../constants';

const defaultState = {
    machine: {
        series: MACHINE_SERIES.ORIGINAL.value
    },
    tab: {
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
                        'webcam', 'axes', 'macro', 'gcode'
                    ]
                }
            }
        },
        '3dp': {
            container: {
                default: {
                    widgets: ['3dp-material', '3dp-configurations', '3dp-output']
                }
            }
        },
        laser: {
            container: {
                default: {
                    widgets: ['laser-set-background', 'laser-params', 'laser-output']
                }
            }
        },
        cnc: {
            container: {
                default: {
                    widgets: ['cnc-tool', 'cnc-path', 'cnc-output']
                }
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
        }
    }
};
const seriesStates = {
    original: {},
    A150: {
        tab: {
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
                            'axes', 'macro', 'gcode'
                        ]
                    }
                }
            },
            '3dp': {
                container: {
                    default: {
                        widgets: ['3dp-material', '3dp-configurations', '3dp-output']
                    }
                }
            },
            laser: {
                container: {
                    default: {
                        widgets: ['laser-set-background', 'laser-params', 'laser-output']
                    }
                }
            },
            cnc: {
                container: {
                    default: {
                        widgets: ['cnc-tool', 'cnc-path', 'cnc-output']
                    }
                }
            }
        }
    },
    A250: {},
    A350: {}
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

class WidgetState {
    constructor(store) {
        this.widgetState = merge(
            {},
            {
                defaultState,
                seriesStates
            },
            {
                defaultState: store.defaultState,
                seriesStates: store.seriesStates
            }
        );
        this.series = this.widgetState.defaultState.machine.series;
    }

    updateTabContainer(tab, container, value) {
        const path = `tab.${tab}.container.${container}`;
        return this.updateState(path, value);
    }

    updateTabContainerWidgets(tab, container, widgets) {
        const path = `tab.${tab}.container.${container}.widgets`;
        return this.updateState(path, widgets);
    }


    setState(path, value) {
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        if (_.has(machineSeriesState, path)) {
            const newVar = _.get(machineSeriesState, path);
            const v = typeof newVar === 'object' ? merge({}, newVar, value) : value;
            return _.set(machineSeriesState, path, v);
        }
        const newVar = _.get(dState, path);
        const v = typeof newVar === 'object' ? merge({}, newVar, value) : value;
        return _.set(dState, path, v);
    }

    setWidgetState(widgetId, key, value) {
        const path = (key && key !== '') ? `widgets[${widgetId}].${key}` : `widgets[${widgetId}]`;
        return this.setState(path, value);
    }

    updateState(path, value) {
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        if (_.has(machineSeriesState, path)) {
            const newVar = _.get(machineSeriesState, path);
            const v = typeof newVar === 'object' ? merge({}, newVar, value) : value;
            return _.set(machineSeriesState, path, v);
        }
        if (_.has(dState, path)) {
            const newVar = _.get(dState, path);
            const v = typeof newVar === 'object' ? merge({}, newVar, value) : value;
            return _.set(dState, path, v);
        }
        return null;
    }

    updateWidgetState(widgetId, key, value) {
        const path = `widgets[${widgetId}].${key}`;
        return this.updateState(path, value);
    }

    getWidgetState(widgetId, key) {
        const path = `widgets[${widgetId}}].${key}}`;
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        return _.get(machineSeriesState, path) || _.get(dState, path);
    }

    updateSeries(series) {
        this.series = series;
        const path = 'machine.series';
        return this.setState(path, series);
    }

    getDefaultState() {
        return merge({}, defaultState, seriesStates[this.series]);
    }

    getState() {
        return merge({}, this.widgetState.defaultState, this.widgetState.seriesStates[this.series]);
    }
}

export default WidgetState;
