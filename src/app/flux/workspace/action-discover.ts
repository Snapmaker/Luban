/* eslint-disable import/no-cycle */
import { isEqualWith, cloneDeep } from 'lodash';
import { controller } from '../../lib/controller';
import { Server } from './Server';
import { CUSTOM_SERVER_NAME } from '../../constants/index';

import baseActions from './action-base';


const checkIfEqual = (objArray, othArray) => {
    if (objArray.length !== othArray.length) {
        return false;
    }
    return objArray.every((server) => {
        const l = othArray.find(v => {
            return v.address === server.address && v.name === server.name;
        });
        return !!l;
    });
};

const init = () => (dispatch, getState) => {
    const controllerEvents = {
        // Receive when new servers discovered
        'machine:discover': ({ devices, type }) => {
            // Note that we may receive this event many times.
            const { connectionType } = getState().workspace;
            const { servers } = getState().workspace;
            if (connectionType === type) {
                const resultServers = cloneDeep(servers.filter(v => v.address));
                resultServers.forEach((item, index) => {
                    const idx = devices.findIndex(v => {
                        return v.address === item.address && v.name === item.name;
                    });
                    if (idx < 0 && item.name !== CUSTOM_SERVER_NAME) {
                        resultServers.splice(index, 1);
                    }
                });

                for (const object of devices) {
                    const find = servers.find(v => {
                        return v.address === object.address && v.name === object.name;
                    });
                    if (!find) {
                        const server = new Server({ name: object.name, address: object.address, sacp: object.sacp });
                        resultServers.unshift(server);
                    }
                }
                const rest = isEqualWith(resultServers, servers, checkIfEqual);
                if (!rest) {
                    dispatch(baseActions.updateState({ servers: resultServers }));
                }
            }
        },
        'machine:serial-discover': ({ devices, type }) => {
            // Note that we may receive this event many times.
            const { servers, connectionType } = getState().workspace;
            // const { series } = getState().workspace;
            if (connectionType === type) {
                const resultServers = [];
                for (const object of devices) {
                    const find = resultServers.find(v => {
                        return v.port === object.port;
                    });
                    if (!find) {
                        const server = new Server({ port: object.port, sacp: object.sacp });
                        resultServers.unshift(server);
                    }
                }
                if (!isEqualWith(resultServers, servers)) {
                    dispatch(baseActions.updateState({ servers: resultServers }));
                }
            }
        }
    };

    Object.keys(controllerEvents).forEach(event => {
        controller.on(event, controllerEvents[event]);
    });
};

/**
 * Discover servers on Snapmaker 2.0.
 */
const discoverSnapmakerServers = () => (dispatch, getState) => {
    dispatch(baseActions.updateState({ serverDiscovering: true }));

    // reset discover state whatever search is done or not
    setTimeout(() => {
        const state = getState().machine;
        if (state.serverDiscovering) {
            dispatch(baseActions.updateState({ serverDiscovering: false }));
        }
    }, 3000);

    controller.listHTTPServers();
};

export default {
    init,
    discoverSnapmakerServers
};
