import isEmpty from 'lodash/isEmpty';
import {
    ABSENT_OBJECT,
    WORKFLOW_STATE_IDLE,
    MACHINE_SERIES,
    CONNECTION_TYPE_SERIAL,
    WORKFLOW_STATUS_UNKNOWN,
    WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    CONNECTION_STATUS_IDLE,
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_CONNECTED
} from '../../constants';

import { valueOf } from '../../lib/contants-utils';
import { machineStore } from '../../store/local-storage';
import { Server } from './Server';
import { actions as printingActions } from '../printing';
import { actions as widgetActions } from '../widget';
import History from './History';
import FixedArray from './FixedArray';
import { controller } from '../../lib/controller';
import { actions as workspaceActions, getGcodeName, getGcodeType } from '../workspace';

const INITIAL_STATE = {

    // Machine Info
    series: MACHINE_SERIES.ORIGINAL.value,
    headType: null,

    isCustom: false,
    size: {
        x: 125,
        y: 125,
        z: 125
    },

    // Serial port
    port: controller.port || '',
    ports: [],

    // Connection state
    connectionStatus: CONNECTION_STATUS_IDLE,
    isOpen: false,
    isConnected: false,
    connectionType: '',

    // Servers
    server: ABSENT_OBJECT,
    serverToken: '',
    servers: [],
    workflowStatus: WORKFLOW_STATUS_UNKNOWN,
    discovering: false,

    // Console
    terminalHistory: new FixedArray(1000),
    history: new History(1000),
    // Serial port

    // from workflowState: idle, running, paused
    workflowState: WORKFLOW_STATE_IDLE,

    isHomed: null,
    enclosure: false,
    enclosureDoor: false,
    laserFocalLength: null,
    laserPower: null,
    headStatus: null,
    nozzleTemperature: 0,
    nozzleTargetTemperature: 0,
    heatedBedTemperature: 0,
    heatedBedTargetTemperature: 0,
    laserCamera: true,
    isFilamentOut: false,

    workPosition: { // work position
        x: '0.000',
        y: '0.000',
        z: '0.000',
        a: '0.000'
    },

    originOffset: {
        x: 0,
        y: 0,
        z: 0
    },

    // laser print mode
    isLaserPrintAutoMode: true,
    materialThickness: 2.5,

    gcodePrintingInfo: {
        sent: 0,
        received: 0,
        total: 0,
        startTime: 0,
        finishTime: 0,
        elapsedTime: 0,
        remainingTime: 0
    }
};

const ACTION_UPDATE_STATE = 'machine/ACTION_UPDATE_STATE';

export const actions = {
    // Update state directly
    updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },

    // Initialize machine, get machine configurations via API
    init: () => (dispatch, getState) => {
        // Machine

        let initialMachineState = machineStore.get('machine');
        if (!initialMachineState) {
            initialMachineState = {
                series: INITIAL_STATE.series,
                size: INITIAL_STATE.size
            };
            machineStore.set('machine', {
                series: INITIAL_STATE.series,
                size: INITIAL_STATE.size
            });
        }
        const machinePort = machineStore.get('port') || '';
        const serverToken = machineStore.get('server.token') || '';

        dispatch(actions.updateState({
            series: initialMachineState.series,
            size: initialMachineState.size,
            serverToken: serverToken,
            port: machinePort
        }));

        const connectionType = machineStore.get('connection.type') || CONNECTION_TYPE_SERIAL;
        dispatch(actions.updateState({
            connectionType: connectionType
        }));

        // FIXME: this is a temporary solution, please solve the init dependency issue
        // setTimeout(() => dispatch(actions.updateMachineSize(machine.size)), 1000);

        // Register event listeners
        const controllerEvents = {
            // 'Marlin:state': (state) => {
            'Marlin:state': (options) => {
                const { state } = options;
                const { pos, originOffset, headStatus, headPower } = state;

                const machineState = getState().machine;

                if (machineState.workPosition.x !== pos.x
                    || machineState.workPosition.y !== pos.y
                    || machineState.workPosition.z !== pos.z) {
                    dispatch(actions.updateState({
                        workPosition: {
                            ...machineState.workPosition,
                            ...pos
                        }
                    }));
                }
                if (machineState.originOffset.x !== originOffset.x
                    || machineState.originOffset.y !== originOffset.y
                    || machineState.originOffset.z !== originOffset.z) {
                    dispatch(actions.updateState({
                        originOffset: {
                            ...machineState.originOffset,
                            ...originOffset
                        }
                    }));
                }

                dispatch(actions.updateState({
                    headStatus: headStatus,
                    laserPower: headPower
                }));
            },
            // 'Marlin:settings': (settings) => {
            'Marlin:settings': (options) => {
                const { enclosure = false, enclosureDoor = false } = options.settings;

                // enclosure is changed
                dispatch(actions.updateState({
                    enclosure: enclosure,
                    enclosureDoor: enclosureDoor
                }));
            },
            'http:discover': (objects) => {
                objects.push({
                    name: 'test1',
                    address: '172.18.1.26'
                });
                const { servers } = getState().machine;
                const newServers = [];
                for (const object of objects) {
                    const find = servers.find(v => v.equal(object));
                    if (find) {
                        newServers.push(find);
                    } else {
                        const server = new Server(object.name, object.address, object.model);
                        newServers.push(server);
                    }
                }

                dispatch(actions.updateState({ servers: newServers }));

                // TODO: refactor this behavior to Component not flux
                setTimeout(() => {
                    const state = getState().machine;
                    if (state.discovering) {
                        dispatch(actions.updateState({ discovering: false }));
                    }
                }, 600);
            },
            'serialport:open': (options) => {
                const { port, err } = options;
                if (err && err !== 'inuse') {
                    return;
                }
                const state = getState().machine;
                // For Warning Don't initialize
                const ports = [...state.ports];
                if (ports.indexOf(port) === -1) {
                    ports.push(port);
                }
                dispatch(actions.updateState({
                    port,
                    ports,
                    isOpen: true,
                    connectionStatus: CONNECTION_STATUS_CONNECTING,
                    connectionType: CONNECTION_TYPE_SERIAL
                }));
            },
            'serialport:connected': (data) => {
                const { err } = data;
                if (err) {
                    return;
                }
                dispatch(actions.updateState({
                    isConnected: true,
                    connectionStatus: CONNECTION_STATUS_CONNECTED
                }));
            },
            'serialport:close': (options) => {
                const { port } = options;
                const state = getState().machine;
                const ports = [...state.ports];
                const portIndex = ports.indexOf(port);
                if (portIndex !== -1) {
                    ports.splice(portIndex, 1);
                }
                if (!isEmpty(ports)) {
                    // this.port = ports[0];
                    dispatch(actions.updateState({
                        port: ports[0],
                        ports,
                        isOpen: false,
                        isConnected: false,
                        connectionStatus: CONNECTION_STATUS_IDLE
                    }));
                } else {
                    // this.port = '';
                    dispatch(actions.updateState({
                        port: '',
                        ports,
                        isOpen: false,
                        isConnected: false,
                        connectionStatus: CONNECTION_STATUS_IDLE
                    }));
                }
            },
            'workflow:state': (options) => {
                const { workflowState } = options;
                dispatch(actions.updateState({
                    workflowState
                }));
            },
            'sender:status': (options) => {
                const { data } = options;
                const { total, sent, received, startTime, finishTime, elapsedTime, remainingTime } = data;
                dispatch(actions.updateState({
                    gcodePrintingInfo: {
                        total,
                        sent,
                        received,
                        startTime,
                        finishTime,
                        elapsedTime,
                        remainingTime
                    }
                }));
            }
        };

        Object.keys(controllerEvents)
            .forEach(event => {
                controller.on(event, controllerEvents[event]);
            });
    },

    updateMachineState: (state) => (dispatch) => {
        const { series, headType } = state;
        headType && dispatch(actions.updateState({
            headType: headType
        }));
        series && dispatch(actions.updateMachineSeries(series));
    },

    updateMachineSeries: (series) => (dispatch) => {
        machineStore.set('machine.series', series);
        dispatch(actions.updateState({ series }));
        const seriesInfo = valueOf(MACHINE_SERIES, 'value', series);
        seriesInfo && dispatch(actions.updateMachineSize(seriesInfo.setting.size));
        dispatch(widgetActions.updateMachineSeries(series));
    },

    updatePort: (port) => (dispatch) => {
        dispatch(actions.updateState({ port: port }));
        machineStore.set('port', port);
    },
    updateServerToken: (token) => (dispatch) => {
        dispatch(actions.updateState({ serverToken: token }));
        machineStore.set('server.token', token);
    },
    updateMachineSize: (size) => (dispatch) => {
        size.x = Math.min(size.x, 1000);
        size.y = Math.min(size.y, 1000);
        size.z = Math.min(size.z, 1000);

        machineStore.set('machine.size', size);

        dispatch(actions.updateState({ size }));

        dispatch(printingActions.updateActiveDefinitionMachineSize(size));
    },
    resetHomeState: () => (dispatch) => {
        dispatch(actions.updateState({ isHomed: null }));
    },

    executeGcode: (gcode, context) => (dispatch, getState) => {
        const machine = getState().machine;

        const { isConnected, connectionType, server } = machine;
        if (!isConnected) {
            return;
        }
        // if (port && workflowState === WORKFLOW_STATE_IDLE) {
        if (connectionType === CONNECTION_TYPE_SERIAL) {
            // controller.command('gcode', gcode, context);
            controller.command('gcode', gcode, context);
            // } else if (server && workflowStatus === STATUS_IDLE) {
        } else {
            server.executeGcode(gcode);
        }
    },

    executeGcodeAutoHome: () => (dispatch, getState) => {
        const { series } = getState().machine;
        dispatch(actions.executeGcode('G53'));
        dispatch(actions.executeGcode('G28'));
        if (series !== MACHINE_SERIES.ORIGINAL.value) {
            dispatch(actions.executeGcode('G54'));
        }
    },

    // Enclosure
    getEnclosureState: () => () => {
        controller.writeln('M1010', { source: 'query' });
    },
    setEnclosureState: (doorDetection) => () => {
        controller.writeln(`M1010 S${(doorDetection ? '1' : '0')}`, { source: 'query' });
    },

    // Server
    discoverServers: () => (dispatch, getState) => {
        dispatch(actions.updateState({ discovering: true }));

        setTimeout(() => {
            const state = getState().machine;
            if (state.discovering) {
                dispatch(actions.updateState({ discovering: false }));
            }
        }, 3000);

        controller.listHTTPServers();
    },

    setServer: (server) => (dispatch) => {
        dispatch(actions.updateState({
            server
        }));
    },

    updateConnectionState: (state) => (dispatch) => {
        dispatch(actions.updateState(state));
        state.connectionType && machineStore.set('connection.type', state.connectionType);
    },

    openServer: () => (dispatch, getState) => {
        const { server, serverToken, isOpen } = getState().machine;
        if (isOpen) {
            return;
        }
        server.open(serverToken, (err, data) => {
            if (err) {
                return;
            }
            const { token } = data;
            dispatch(actions.updateServerToken(token));
            dispatch(actions.updateState({
                isOpen: true,
                connectionStatus: CONNECTION_STATUS_CONNECTING
            }));
            server.removeAllListeners('http:confirm');
            server.removeAllListeners('http:status');
            server.removeAllListeners('http:close');

            server.once('http:confirm', (result) => {
                const { series, headType, status, isHomed } = result.data;
                dispatch(actions.updateState({
                    workflowStatus: status,
                    isConnected: true,
                    connectionStatus: CONNECTION_STATUS_CONNECTED,
                    isHomed: isHomed
                }));
                dispatch(actions.updateMachineState({
                    series: series,
                    headType: headType
                }));
                dispatch(actions.executeGcode('G54'));

                server.getGcodeFile((msg, gcode) => {
                    if (msg) {
                        return;
                    }
                    dispatch(workspaceActions.clearGcode());
                    dispatch(workspaceActions.addGcode('print.gcode', gcode));
                });
            });
            server.on('http:status', (result) => {
                const { workPosition, originOffset, gcodePrintingInfo } = getState().machine;
                const { status, isHomed, x, y, z, offsetX, offsetY, offsetZ,
                    laserFocalLength,
                    laserPower,
                    nozzleTemperature,
                    nozzleTargetTemperature,
                    heatedBedTemperature,
                    heatedBedTargetTemperature } = result.data;

                dispatch(actions.updateState({
                    workflowStatus: status,
                    laserFocalLength: laserFocalLength,
                    laserPower: laserPower,
                    isHomed: isHomed,
                    nozzleTemperature: nozzleTemperature,
                    nozzleTargetTemperature: nozzleTargetTemperature,
                    heatedBedTemperature: heatedBedTemperature,
                    heatedBedTargetTemperature: heatedBedTargetTemperature
                }));
                if (workPosition.x !== x
                    || workPosition.y !== y
                    || workPosition.z !== z) {
                    dispatch(actions.updateState({
                        workPosition: {
                            x: `${x.toFixed(3)}`,
                            y: `${y.toFixed(3)}`,
                            z: `${z.toFixed(3)}`,
                            a: '0.000'
                        }
                    }));
                }
                if (originOffset.x !== offsetX
                || originOffset.y !== offsetY
                || originOffset.z !== offsetZ) {
                    dispatch(actions.updateState({
                        originOffset: {
                            x: `${offsetX.toFixed(3)}`,
                            y: `${offsetY.toFixed(3)}`,
                            z: `${offsetZ.toFixed(3)}`,
                            a: '0.000'
                        }
                    }));
                }

                dispatch(actions.updateState({
                    gcodePrintingInfo: {
                        ...gcodePrintingInfo,
                        ...result.data.gcodePrintingInfo
                    }
                }));
            });
            server.once('http:close', () => {
                dispatch(actions.uploadCloseServerState());
            });
        });
    },

    closeServer: () => (dispatch, getState) => {
        const { server } = getState().machine;
        server.close(() => {
            dispatch(actions.uploadCloseServerState());
        });
    },

    uploadCloseServerState: () => (dispatch) => {
        // dispatch(actions.updateServerToken(''));
        dispatch(actions.updateState({
            isOpen: false,
            isConnected: false,
            connectionStatus: CONNECTION_STATUS_IDLE,
            isHomed: null,
            workflowStatus: WORKFLOW_STATUS_UNKNOWN,
            laserFocalLength: null,
            workPosition: { // work position
                x: '0.000',
                y: '0.000',
                z: '0.000',
                a: '0.000'
            }
        }));
    },

    startServerGcode: () => (dispatch, getState) => {
        const { server, workflowStatus, isLaserPrintAutoMode, series, laserFocalLength, materialThickness } = getState().machine;
        const { gcodeList, background } = getState().workspace;
        if (workflowStatus !== WORKFLOW_STATUS_IDLE || !gcodeList || gcodeList.length === 0) {
            return;
        }
        const gcode = gcodeList.map(gcodeBean => gcodeBean.gcode).join('\n');
        const filename = getGcodeName(gcodeList);
        const type = getGcodeType(gcodeList);

        const blob = new Blob([gcode], { type: 'text/plain' });
        const file = new File([blob], filename);
        const promises = [];
        if (series !== MACHINE_SERIES.ORIGINAL.value && type === 'Laser') {
            if (isLaserPrintAutoMode && laserFocalLength) {
                const promise = new Promise((resolve) => {
                    server.executeGcode(`G53;\nG0 Z${laserFocalLength + materialThickness} F1500;\nG54;`, () => {
                        resolve();
                    });
                });
                promises.push(promise);
            }
            if (background.enabled) {
                const promise = new Promise((resolve) => {
                    server.executeGcode('G53;\nG0 X0 Y0;\nG54;\nG92 X0 Y0;', () => {
                        resolve();
                    });
                });
                promises.push(promise);
            }
        }
        Promise.all(promises).then(() => {
            server.uploadGcodeFile(filename, file, type, (msg) => {
                if (msg) {
                    return;
                }
                server.startGcode((msg1) => {
                    if (msg1) {
                        return;
                    }
                    dispatch(actions.updateState({
                        workflowStatus: WORKFLOW_STATUS_RUNNING
                    }));
                });
            });
        });
    },

    resumeServerGcode: () => (dispatch, getState) => {
        const { server } = getState().machine;
        server.resumeGcode((msg) => {
            if (msg) {
                return;
            }
            dispatch(actions.updateState({
                workflowStatus: WORKFLOW_STATUS_RUNNING
            }));
        });
    },

    pauseServerGcode: () => (dispatch, getState) => {
        const { server, workflowStatus } = getState().machine;
        if (workflowStatus !== WORKFLOW_STATUS_RUNNING) {
            return;
        }
        server.pauseGcode((msg) => {
            if (msg) {
                return;
            }
            dispatch(actions.updateState({
                workflowStatus: WORKFLOW_STATUS_PAUSED
            }));
        });
    },

    stopServerGcode: () => (dispatch, getState) => {
        const { server, workflowStatus } = getState().machine;
        if (workflowStatus === WORKFLOW_STATUS_IDLE) {
            return;
        }
        server.stopGcode((msg) => {
            if (msg) {
                return;
            }
            dispatch(actions.updateState({
                workflowStatus: WORKFLOW_STATUS_IDLE
            }));
        });
    }


};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE:
            return Object.assign({}, state, action.state);
        default:
            return state;
    }
}
