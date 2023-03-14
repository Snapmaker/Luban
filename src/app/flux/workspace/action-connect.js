import includes from 'lodash/includes';
import isInteger from 'lodash/isInteger';
import { isEqual } from 'lodash';
// import { Server } from './Server';
import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI } from '../../constants';
import { machineStore } from '../../store/local-storage';

import baseActions from './action-base';

const init = () => (dispatch) => {
    // const connectionType = machineStore.get('connection.type') || CONNECTION_TYPE_SERIAL;
    const connectionType = machineStore.get('connection.type') || CONNECTION_TYPE_WIFI;
    const connectionTimeout = machineStore.get('connection.timeout') || 3000;

    dispatch(baseActions.updateState({
        connectionType,
        connectionTimeout,
    }));
};

const setConnectionType = (connectionType) => (dispatch) => {
    if (!includes([CONNECTION_TYPE_WIFI, CONNECTION_TYPE_SERIAL], connectionType)) return;
    if (connectionType === CONNECTION_TYPE_WIFI) {
        dispatch(baseActions.updateState({ servers: [] }));
    }
    dispatch(baseActions.updateState({ connectionType }));

    machineStore.set('connection.type', connectionType);
};

const setConnectionTimeout = (connectionTimeout) => (dispatch) => {
    connectionTimeout = isInteger(connectionTimeout) && connectionTimeout > 0 ? connectionTimeout : 3000;

    dispatch(baseActions.updateState({ connectionTimeout }));

    machineStore.set('connection.timeout', connectionTimeout);
};

/**
 * Set selected server.
 *
 * Update state only, we will save the server when connection established.
 * If 'server' is not found in 'servers' list, add it and update state
 */
const setSelectedServer = (server) => (dispatch, getState) => {
    const { servers, server: oldServer } = getState().workspace;

    // We can assume that server must be found on server list
    let find;
    if (server.address) {
        find = servers.find(s => s.address === server.address);
    } else if (server.port) {
        find = servers.find(s => s.port === server.port);
    }

    if (find && !isEqual(server, oldServer)) {
        dispatch(baseActions.updateState({ server: find }));
    }
};

/**
 * Add new server.
 *
 * @param server - server to be added.
 * @returns The new added server or an old server if it already exists.
 *
 * TODO: Move to workspace
 */
const addServer = (server) => (dispatch, getState) => {
    const { servers } = getState().workspace;

    const find = servers.find(s => s.address === server.address);

    if (find) {
        return find;
    } else {
        const newServers = servers.slice(0);
        newServers.push(server);

        dispatch(baseActions.updateState({
            servers: newServers,
        }));

        return server;
    }
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

const setMachineSerialPort = (port) => (dispatch) => {
    dispatch(baseActions.updateState({ port }));

    // TODO: rename key `port`
    machineStore.set('port', port);
};

export default {
    init,

    setConnectionType,
    setConnectionTimeout,

    addServer,
    setSelectedServer,

    setMachineSerialPort,

    // TODO: refactor methods below
    setServerAddress,
    setServerName,
    setServerToken,
    setManualIP
};
