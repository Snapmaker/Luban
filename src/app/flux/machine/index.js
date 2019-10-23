import isEmpty from 'lodash/isEmpty';
import { ABSENT_OBJECT, WORKFLOW_STATE_IDLE,
    MACHINE_SERIES,
    MACHINE_PATTERN
} from '../../constants';
import controller from '../../lib/controller';
import { machineStore } from '../../store/local-storage';
import { Server } from '../models/Server';
import { actions as printingActions } from '../printing';
import { actions as widgetActions } from '../widget';


const STATUS_UNKNOWN = 'UNKNOWN';
// const STATUS_IDLE = 'IDLE';
// const STATUS_RUNNING = 'RUNNING';
// const STATUS_PAUSED = 'PAUSED';

let statusTimer = null;

const INITIAL_STATE = {
    // Servers
    servers: [],
    server: ABSENT_OBJECT,
    serverStatus: STATUS_UNKNOWN,
    discovering: false,

    // Serial port
    port: controller.port || '',
    // Warning Don't initialize
    // ports: controller.ports || [],
    ports: [],
    dataSource: '',
    dataSources: [],
    // from workflowState: idle, running, paused
    workState: WORKFLOW_STATE_IDLE,

    workPosition: { // work position
        x: '0.000',
        y: '0.000',
        z: '0.000',
        a: '0.000',
        dataSource: ''
    },

    // current connected device
    series: MACHINE_SERIES.ORIGINAL.value,
    size: {
        x: 125,
        y: 125,
        z: 125
    },
    enclosure: false,

    // machine pattern
    pattern: MACHINE_PATTERN['3DP'].value,

    workMachineState: {
        isUpdate: false,
        series: 'unknown',
        pattern: 'unknown'
    },
    // machine connect state
    isConnected: false,
    connectionMode: ''
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
        const initialMachineState = machineStore.get('machine') || INITIAL_STATE;
        const machinePort = machineStore.get('port') || '';

        dispatch(actions.updateState({
            series: initialMachineState.series || INITIAL_STATE.series,
            size: initialMachineState.size || INITIAL_STATE.size,
            port: machinePort
        }));

        // FIXME: this is a temporary solution, please solve the init dependency issue
        // setTimeout(() => dispatch(actions.updateMachineSize(machine.size)), 1000);

        // Register event listeners
        const controllerEvents = {
            // 'Marlin:state': (state) => {
            'Marlin:state': (state, dataSource) => {
                // TODO: bring other states here
                // TODO: clear structure of state?
                const { pos } = state;

                const machineState = getState().machine;

                dispatch(actions.updateState({
                    workPosition: {
                        ...machineState.position,
                        ...pos,
                        dataSource
                    }
                }));
            },
            'Marlin:settings': (settings) => {
                const state = getState().machine;

                // enclosure is changed
                if (state.enclosure !== settings.enclosure) {
                    dispatch(actions.updateState({ enclosure: settings.enclosure }));
                }
            },
            'http:discover': (objects) => {
                const servers = [];
                for (const object of objects) {
                    servers.push(new Server(object.name, object.address, object.model));
                }
                // FIXME: For KS Shooting
                servers.push(new Server('My Snapmaker Model Plus', '172.18.1.99', 'Snapmaker 2 Model Plus'));
                servers.push(new Server('My Snapmaker Model Plus2', '172.18.1.100', 'Snapmaker 2 Model Plus'));
                dispatch(actions.updateState({ servers }));

                // TODO: refactor this behavior to Component not flux
                setTimeout(() => {
                    const state = getState().machine;
                    if (state.discovering) {
                        dispatch(actions.updateState({ discovering: false }));
                    }
                }, 600);
            },
            'serialport:open': (options) => {
                const { port, dataSource } = options;
                const state = getState().machine;
                // For Warning Don't initialize
                const ports = [...state.ports];
                const dataSources = [...state.dataSources];
                if (ports.indexOf(port) === -1) {
                    ports.push(port);
                    dataSources.push(dataSource);
                }
                dispatch(actions.updateState({
                    port,
                    ports,
                    dataSource,
                    dataSources
                }));
            },
            'serialport:close': (options) => {
                const { port } = options;
                const state = getState().machine;
                const ports = [...state.ports];
                const dataSources = [...state.dataSources];
                const portIndex = ports.indexOf(port);
                if (portIndex !== -1) {
                    ports.splice(portIndex, 1);
                    dataSources.splice(portIndex, 1);
                }
                if (!isEmpty(ports)) {
                    // this.port = ports[0];
                    dispatch(actions.updateState({
                        port: ports[0],
                        ports,
                        dataSource: dataSources[0],
                        dataSources
                    }));
                } else {
                    // this.port = '';
                    dispatch(actions.updateState({
                        port: '',
                        ports,
                        dataSource: '',
                        dataSources
                    }));
                }
            },
            'workflow:state': (workState, dataSource) => {
                dispatch(actions.updateState({ workState, dataSource }));
            }
        };

        Object.keys(controllerEvents).forEach(event => {
            controller.on(event, controllerEvents[event]);
        });
    },

    updateMachinePattern: (pattern) => (dispatch) => {
        dispatch(actions.updateState({ pattern }));
    },

    updateMachineSeries: (series) => (dispatch) => {
        machineStore.set('machine.series', series);

        dispatch(actions.updateState({ series }));
        dispatch(widgetActions.updateMachineSeries(series));
    },

    updateMachineConnectionState: (state) => (dispatch) => {
        dispatch(actions.updateState({ isConnected: state }));
    },
    updatePort: (port) => (dispatch) => {
        dispatch(actions.updateState({ port: port }));
        machineStore.set('port', port);
    },
    updateMachineSize: (size) => (dispatch) => {
        size.x = Math.min(size.x, 1000);
        size.y = Math.min(size.y, 1000);
        size.z = Math.min(size.z, 1000);

        machineStore.set('machine.size', size);

        dispatch(actions.updateState({ size }));

        dispatch(printingActions.updateActiveDefinitionMachineSize(size));
    },
    // executeGcode: (gcode, context) => (dispatch, getState) => {
    executeGcode: (dataSource, gcode, context) => (dispatch, getState) => {
        const machine = getState().machine;

        const { port, server } = machine;
        // if (port && workState === WORKFLOW_STATE_IDLE) {
        if (port) {
            // controller.command('gcode', gcode, context);
            controller.command('gcode', dataSource, gcode, context);
            // } else if (server && serverStatus === STATUS_IDLE) {
        } else if (server) {
            server.executeGcode(gcode);
        }
    },

    // Enclosure
    getEnclosureState: () => () => {
        // controller.writeln('M1010', dataSource, { source: 'query' });
        controller.writeln('M1010', 'workspace', { source: 'query' });
    },
    setEnclosureState: (doorDetection) => () => {
        // controller.writeln(`M1010 S${(doorDetection ? '1' : '0')}`, dataSource, { source: 'query' });
        controller.writeln(`M1010 S${(doorDetection ? '1' : '0')}`, 'workspace', { source: 'query' });
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
        // Update server
        dispatch(actions.updateState({
            server,
            serverStatus: STATUS_UNKNOWN
        }));

        // TODO: Fix the issue that sometimes will get multiple machines' status simultaneously
        // Cancel previous status polling
        if (statusTimer) {
            clearTimeout(statusTimer);
            statusTimer = null;
        }

        // Get status of server frequently
        const getStatus = () => {
            server.requestStatus((err, res) => {
                if (!err) {
                    dispatch(actions.updateState({
                        serverStatus: res.body.status,
                        workPosition: {
                            x: server.x.toFixed(3),
                            y: server.y.toFixed(3),
                            z: server.z.toFixed(3)
                        }
                    }));
                } else {
                    dispatch(actions.updateState({ serverStatus: STATUS_UNKNOWN }));
                }

                // If status timer is not cancelled, then re-schedule a new timeout
                if (statusTimer !== null) {
                    statusTimer = setTimeout(getStatus, 1500);
                }
            });
        };
        statusTimer = setTimeout(getStatus);
    },
    unsetServer: () => (dispatch) => {
        dispatch(actions.updateState({
            server: ABSENT_OBJECT,
            serverStatus: STATUS_UNKNOWN
        }));

        if (statusTimer) {
            clearTimeout(statusTimer);
            statusTimer = null;
        }
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
