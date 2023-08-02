import { WorkflowStatus } from '@snapmaker/luban-platform';
import { isEqual } from 'lodash';
import isInteger from 'lodash/isInteger';

import ControllerEvent from '../../connection/controller-events';
import {
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_IDLE,
} from '../../constants';
import controller from '../../lib/controller';
import { machineStore } from '../../store/local-storage';
import { MachineAgent } from './MachineAgent';
import baseActions from './actions-base';
import { ConnectionType } from './state';



const setConnectionType = (connectionType: ConnectionType) => {
    return (dispatch) => {
        dispatch(baseActions.updateState({ connectionType }));

        machineStore.set('connection.type', connectionType);
    };
};

const setConnectionTimeout = (connectionTimeout) => (dispatch) => {
    connectionTimeout = isInteger(connectionTimeout) && connectionTimeout > 0 ? connectionTimeout : 3000;

    dispatch(baseActions.updateState({ connectionTimeout }));

    machineStore.set('connection.timeout', connectionTimeout);
};

/**
 * Set selected machine agent.
 *
 * Update state only, we will save the agent when connection established.
 */
const setSelectedAgent = (agent: MachineAgent) => {
    return (dispatch, getState) => {
        const machineAgents = getState().workspace.machineAgents as MachineAgent[];
        const { server: oldAgent } = getState().workspace;

        // We can assume that server must be found on server list
        let find: MachineAgent = null;
        if (agent.address) {
            find = machineAgents.find(a => a.address === agent.address);
        } else if (agent.port) {
            find = machineAgents.find(a => a.port === agent.port);
        }

        if (find && !isEqual(agent, oldAgent)) {
            dispatch(baseActions.updateState({ server: find }));
        }
    };
};

const setServerAddress = (serverAddress) => (dispatch) => {
    dispatch(baseActions.updateState({ savedServerAddress: serverAddress }));
    machineStore.set('server.address', serverAddress);
};

const setServerName = (name) => (dispatch) => {
    dispatch(baseActions.updateState({ savedServerName: name }));

    machineStore.set('server.name', name);
};

const setServerToken = (token) => (dispatch) => {
    dispatch(baseActions.updateState({ savedServerToken: token }));

    machineStore.set('server.token', token);
};

const setManualIP = (manualIp) => (dispatch) => {
    dispatch(baseActions.updateState({ manualIp }));

    machineStore.set('manualIp', manualIp);
};

/**
 * Set serial port.
 */
const setMachineSerialPort = (port) => (dispatch) => {
    dispatch(baseActions.updateState({ port }));

    // TODO: rename key `port`
    machineStore.set('port', port);
};


/**
 * Machine State
 */
const resetMachineState = (connectionType = ConnectionType.WiFi) => {
    return (dispatch) => {
        dispatch(baseActions.updateState({
            isOpen: false,
            isConnected: false,
            connectionStatus: CONNECTION_STATUS_IDLE,
            isHomed: null,
            connectLoading: false,
            // TODO: unify?
            workflowStatus: connectionType === ConnectionType.WiFi ? WorkflowStatus.Unknown : WorkflowStatus.Idle,
            laserFocalLength: null,
            workPosition: { // work position
                x: '0.000',
                y: '0.000',
                z: '0.000',
                a: '0.000',
                b: '0.000',
                isFourAxis: false,
            },

            originOffset: {
                x: 0,
                y: 0,
                z: 0
            },
        }));
    };
};

const connect = (agent: MachineAgent) => {
    return async (dispatch, getState) => {
        // Update selected
        dispatch(setSelectedAgent(agent));

        // Re-use saved token if possible
        const savedServerName = getState().workspace.savedServerName;
        const savedServerAddress = getState().workspace.savedServerAddress;
        const savedServerToken = getState().workspace.savedServerToken;

        if (agent.address === savedServerAddress) {
            agent.setToken(savedServerToken);
        } else if (agent.name === savedServerName) {
            // In case server address is re-allocated, check for saved server name
            agent.setToken(savedServerToken);
        }

        const { code, msg } = await agent.connect();

        // success
        if (!msg) {
            if (agent.isNetworkedMachine) {
                dispatch(baseActions.updateState({
                    isOpen: true,
                    connectionStatus: CONNECTION_STATUS_CONNECTING,
                }));

                dispatch(setServerName(agent.name));
                dispatch(setServerAddress(agent.address));
                dispatch(setServerToken(agent.getToken()));
            } else {
                // serial port
                dispatch(resetMachineState(ConnectionType.Serial));
                machineStore.set('port', agent.port);
                dispatch(setMachineSerialPort(agent.port));
            }
        }

        return { code, msg };
    };
};

interface DisconnectOptions {
    force?: boolean;
}

const disconnect = (agent: MachineAgent, options: DisconnectOptions = {}) => {
    return async (dispatch) => {
        await agent.disconnect(options?.force || false);

        // reset machine state
        dispatch(resetMachineState());

        // FIXME: why it's not in resetMachineState
        dispatch(baseActions.updateState({
            headType: '',
            toolHead: ''
        }));
    };
};

/**
 * Reset all connections & redux state.
 */
const resetConnections = ({ force = false }) => {
    return (dispatch) => {
        // disconnect all connections when reload
        controller
            .emitEvent(ControllerEvent.ConnectionClose, { force })
            .once(ControllerEvent.ConnectionClose, () => {
                // reset machine state
                dispatch(resetMachineState());

                // FIXME: why it's not in resetMachineState
                dispatch(baseActions.updateState({
                    headType: '',
                    toolHead: ''
                }));
            });
    };
};

const init = () => {
    return (dispatch) => {
        // const connectionType = machineStore.get('connection.type') || CONNECTION_TYPE_SERIAL;
        const connectionType = machineStore.get('connection.type') || ConnectionType.WiFi;
        const connectionTimeout = machineStore.get('connection.timeout') || 3000;

        dispatch(baseActions.updateState({
            connectionType,
            connectionTimeout,
        }));

        // Reset all possible connections on initialization.
        dispatch(resetConnections({ force: true }));
    };
};

export default {
    setConnectionType,
    setConnectionTimeout,

    /**
     * networked machine agent
     */
    setSelectedAgent,

    /**
     * serial port
     */
    setMachineSerialPort,

    /**
     * machine state
     */
    resetMachineState,

    // TODO: refactor methods below
    setServerAddress,
    setServerName,
    setServerToken,
    setManualIP,

    /**
     * Manage of connections
     */
    connect,
    disconnect,
    resetConnections,

    /**
     * Initialization
     */
    init,
};
