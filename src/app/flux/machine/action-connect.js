import includes from 'lodash/includes';
import isInteger from 'lodash/isInteger';

import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI } from '../../constants';
import { machineStore } from '../../store/local-storage';

import baseActions from './action-base';

const init = () => (dispatch) => {
    const connectionType = machineStore.get('connection.type') || CONNECTION_TYPE_SERIAL;
    const connectionTimeout = machineStore.get('connection.timeout') || 3000;

    dispatch(baseActions.updateState({
        connectionType,
        connectionTimeout
    }));
};

const setConnectionType = (connectionType) => (dispatch) => {
    if (!includes([CONNECTION_TYPE_WIFI, CONNECTION_TYPE_SERIAL], connectionType)) return;

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
 */
const setSelectedServer = (server) => (dispatch) => {
    dispatch(baseActions.updateState({ server }));
};

const setServerAddress = (serverAddress) => (dispatch) => {
    dispatch(baseActions.updateState({ serverAddress: serverAddress }));

    machineStore.set('server.address', serverAddress);
};

const setServerToken = (token) => (dispatch) => {
    dispatch(baseActions.updateState({ serverToken: token }));

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

    setSelectedServer,

    setMachineSerialPort,

    // TODO: refactor methods below
    setServerAddress,
    setServerToken,
    setManualIP
};
