import { WorkflowStatus } from '@snapmaker/luban-platform';
import { isEqual } from 'lodash';
import isInteger from 'lodash/isInteger';

import SocketEvent from '../../communication/socket-events';
import {
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_IDLE
} from '../../constants';
import controller from '../../communication/socket-communication';
import { machineStore } from '../../store/local-storage';
import { ConnectResult, MachineAgent } from './MachineAgent';
import baseActions from './actions-base';
import { ConnectionType } from './state';
import { beginConnectionAttempt } from './connectionDiagnostics';



const setConnectionType = (connectionType: ConnectionType) => {
    return (dispatch, getState) => {
        const oldConnectionType = getState().workspace.connectionType as ConnectionType;

        if (connectionType !== oldConnectionType) {
            dispatch(baseActions.updateState({
                connectionType,
                machineAgents: [], // clear previous machines
            }));

            machineStore.set('connection.type', connectionType);
        }
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

/**
 * Saved machine record, one per known machine.
 *
 * Tokens remain valid until the machine is powered off, so keep one
 * per machine instead of only the last connected one.
 */
interface SavedMachineRecord {
    name: string;
    address: string;
    token: string;
    lastConnectedAt: number;
}

const getSavedMachines = (): SavedMachineRecord[] => {
    const machines = machineStore.get('server.machines');
    if (Array.isArray(machines)) {
        return machines;
    }

    // Migrate legacy single-machine keys (server.address / server.name / server.token)
    const address = machineStore.get('server.address');
    const token = machineStore.get('server.token');
    if (address && token) {
        const migrated: SavedMachineRecord[] = [{
            name: machineStore.get('server.name') || '',
            address,
            token,
            lastConnectedAt: 0,
        }];
        machineStore.replace('server.machines', migrated);
        return migrated;
    }

    return [];
};

/**
 * Find saved token for the agent.
 *
 * Match by address first; fall back to name in case the address got re-allocated.
 * On multiple matches, prefer the most recently connected record.
 */
const findSavedToken = (agent: MachineAgent): string => {
    const machines = getSavedMachines();

    const byAddress = machines.filter(m => m.address === agent.address);
    const byName = machines.filter(m => m.name === agent.name);
    const candidates = byAddress.length > 0 ? byAddress : byName;

    if (candidates.length === 0) {
        return '';
    }

    return candidates.reduce((a, b) => (a.lastConnectedAt >= b.lastConnectedAt ? a : b)).token;
};

/**
 * Upsert machine record on successful connect, keyed by address.
 *
 * Records with the same name but a different address are kept — the machine
 * may come back on its old address; stale ones lose on lastConnectedAt.
 */
const saveMachineToken = (agent: MachineAgent) => {
    const machines = getSavedMachines().filter(m => m.address !== agent.address);

    machines.push({
        name: agent.name,
        address: agent.address,
        token: agent.getToken(),
        lastConnectedAt: Date.now(),
    });

    machineStore.replace('server.machines', machines);
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

/**
 * Connect to machine.
 */
const connect = (agent: MachineAgent, allowPairing: boolean = false) => {
    return async (dispatch, getState) => {
        // Update selected agent
        const attempt = beginConnectionAttempt(controller.connected);
        const oldAgent: MachineAgent = getState().workspace.server;
        if (!isEqual(agent, oldAgent)) {
            dispatch(setSelectedAgent(agent));
        }

        // Re-use saved token if possible
        const savedToken = findSavedToken(agent);
        if (savedToken) {
            agent.setToken(savedToken);
        }

        // update connection status
        dispatch(baseActions.updateState({
            connectionStatus: CONNECTION_STATUS_CONNECTING,
        }));

        const { code, msg }: ConnectResult = await agent.connect(allowPairing, attempt);

        const connectionStatus = getState().workspace.connectionStatus;
        if (connectionStatus !== CONNECTION_STATUS_CONNECTING) {
            // connection has been reset
            throw new Error('Connection cancelled');
        }

        // success
        if (!msg) {
            // save
            if (agent.isNetworkedMachine) {
                dispatch(baseActions.updateState({
                    isOpen: true,
                }));

                // per-machine token registry
                saveMachineToken(agent);

                // legacy last-connected keys, kept for external readers and UI auto-select
                dispatch(setServerName(agent.name));
                dispatch(setServerAddress(agent.address));
                dispatch(setServerToken(agent.getToken()));
            } else {
                // serial port
                // dispatch(resetMachineState(ConnectionType.Serial));
                machineStore.set('port', agent.port);
                dispatch(setMachineSerialPort(agent.port));
            }
        } else {
            dispatch(baseActions.updateState({
                connectionStatus: CONNECTION_STATUS_IDLE,
            }));
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
            .emitEvent(SocketEvent.ConnectionClose, { force })
            .once(SocketEvent.ConnectionClose, () => {
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

const onResetPort = (port:number = 5000) => {
    return async () => {
        return new Promise((res) => {
            controller.emitEvent(SocketEvent.OnResetPort, { port }, (e) => {
                res(e);
            });
        });
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
    onResetPort
};
