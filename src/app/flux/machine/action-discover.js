/* eslint-disable import/no-cycle */
import { isEqualWith, cloneDeep } from 'lodash';
import { controller } from '../../lib/controller';
import { Server } from './Server';
import baseActions from './action-base';

const checkIfEqual = (objArray, othArray) => {
    if (objArray.length !== othArray.length) {
        return false;
    }
    return objArray.every((server) => {
        const l = othArray.find(v => {
            return v.address === server.address && v.name === server.name;
        });
        console.log(l?.address, othArray, objArray);
        return !!l;
    });
};

const init = () => (dispatch, getState) => {
    const controllerEvents = {
        // Receive when new servers discovered
        'machine:discover': ({ devices, type }) => {
            // Note that we may receive this event many times.
            const { servers, connectionType } = getState().machine;
            console.log('isEqualWith(resultServers, servers, checkIfEqual)');
            if (connectionType === type) {
                const resultServers = cloneDeep(servers.filter(v => v.address));
                // resultServers.forEach((item) => {
                //     const index = devices.findIndex(v => {
                //         return v.address === item.address && v.name === item.name;
                //     });
                //     if (index < 0) {
                //         resultServers.splice(index, 1);
                //     }
                // });

                for (const object of devices) {
                    const find = servers.find(v => {
                        return v.address === object.address && v.name === object.name;
                    });
                    if (!find) {
                        const server = new Server({ name: object.name, address: object.address });
                        resultServers.unshift(server);
                    }
                }
                const rest = isEqualWith(resultServers, servers, checkIfEqual);
                console.log('isEqualWith(resultServers, servers, checkIfEqual)', devices, resultServers, servers, rest);
                if (!rest) {
                    dispatch(baseActions.updateState({ servers: resultServers }));
                }
            }
        },
        'machine:serial-discover': ({ devices, type }) => {
            // Note that we may receive this event many times.
            const { servers, connectionType } = getState().machine;
            if (connectionType === type) {
                const resultServers = [];
                for (const object of devices) {
                    const find = resultServers.find(v => {
                        return v.port === object.port;
                    });
                    if (!find) {
                        const server = new Server({ port: object.port });
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
