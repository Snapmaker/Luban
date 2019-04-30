import { ABSENT_OBJECT, WORKFLOW_STATE_IDLE } from '../../constants';
import controller from '../../lib/controller';
import store from '../../store';
import { Server } from '../models/Server';
import { actions as printingActions } from '../printing';

const STATUS_UNKNOWN = 'UNKNOWN';
const STATUS_IDLE = 'IDLE';
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
    // from workflowState: idle, running, paused
    workState: WORKFLOW_STATE_IDLE,

    workPosition: { // work position
        x: '0.000',
        y: '0.000',
        z: '0.000',
        a: '0.000'
    },

    // current connected device
    series: 'original',
    size: {
        x: 125,
        y: 125,
        z: 125
    },
    enclosure: false
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
        const machine = store.get('machine');

        dispatch(actions.updateState({
            series: machine.series,
            size: machine.size
        }));

        // FIXME: this is a temporary solution, please solve the init dependency issue
        // setTimeout(() => dispatch(actions.updateMachineSize(machine.size)), 1000);

        // Register event listeners
        const controllerEvents = {
            'Marlin:state': (state) => {
                // TODO: bring other states here
                // TODO: clear structure of state?
                const { pos } = state;

                const machine = getState().machine;

                dispatch(actions.updateState({
                    workPosition: {
                        ...machine.position,
                        ...pos
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

                // TODO: refactor this behavior to Component not redux
                setTimeout(() => {
                    const state = getState().machine;
                    if (state.discovering) {
                        dispatch(actions.updateState({ discovering: false }));
                    }
                }, 600);
            },
            'serialport:open': (options) => {
                const { port } = options;
                dispatch(actions.updateState({ port }));
            },
            'serialport:close': () => {
                dispatch(actions.updateState({ port: '' }));
            },
            'workflow:state': (workflowState) => {
                dispatch(actions.updateState({ workState: workflowState }));
            }
        };

        Object.keys(controllerEvents).forEach(event => {
            controller.on(event, controllerEvents[event]);
        });
    },

    updateMachineSeries: (series) => (dispatch) => {
        store.set('machine.series', series);

        dispatch(actions.updateState({ series }));
    },
    updateMachineSize: (size) => (dispatch) => {
        size.x = Math.min(size.x, 1000);
        size.y = Math.min(size.y, 1000);
        size.z = Math.min(size.z, 1000);

        store.set('machine.size', size);

        dispatch(actions.updateState({ size }));

        dispatch(printingActions.updateActiveDefinitionMachineSize(size));
    },
    executeGcode: (gcode) => (dispatch, getState) => {
        const machine = getState().machine;

        const { port, workState, server, serverStatus } = machine;

        if (port && workState === WORKFLOW_STATE_IDLE) {
            controller.command('gcode', gcode);
        } else if (server && serverStatus === STATUS_IDLE) {
            server.executeGcode(gcode);
        }
    },

    // Enclosure
    getEnclosureState: () => () => {
        controller.writeln('M1010', { source: 'query' });
    },
    setEnclosureState: (doorDetection) => () => {
        controller.writeln('M1010 S' + (doorDetection ? '1' : '0'), { source: 'query' });
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
