import controller from '../../lib/controller';
import { Server } from '../models/Server';
import store from '../../store';
import { actions as printingActions } from '../printing';
import { ABSENT_OBJECT } from '../../constants';

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
    // workflowState: idle, running, paused
    workState: 'idle',

    // current connected device
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
        // MachineSettings
        const machine = store.get('machine');
        dispatch(actions.updateState({ size: machine.size }));

        // FIXME: this is a temporary solution, please solve the init dependency issue
        // setTimeout(() => dispatch(actions.updateMachineSize(machine.size)), 1000);

        // Register event listeners
        const controllerEvents = {
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
            'workflow:state': (workflowState) => {
                dispatch(actions.updateState({ workState: workflowState }));
            }
        };

        Object.keys(controllerEvents).forEach(event => {
            controller.on(event, controllerEvents[event]);
        });
    },
    getEnclosureState: () => () => {
        controller.writeln('M1010', { source: 'query' });
    },
    setEnclosureState: (doorDetection) => () => {
        controller.writeln('M1010 S' + (doorDetection ? '1' : '0'), { source: 'query' });
    },
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

        // Cancel previous status polling
        if (statusTimer) {
            clearTimeout(statusTimer);
            statusTimer = null;
        }

        // Get status of server frequently
        const getStatus = () => {
            server.requestStatus((err, res) => {
                if (!err) {
                    dispatch(actions.updateState({ serverStatus: res.body.status }));
                } else {
                    dispatch(actions.updateState({ serverStatus: STATUS_UNKNOWN }));
                }

                statusTimer = setTimeout(getStatus, 1000 * 15);
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
    },
    updateMachineSize: (size) => (dispatch) => {
        store.set('machine.size', size);

        dispatch(actions.updateState({ size }));

        dispatch(printingActions.updateActiveDefinitionMachineSize(size));
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
