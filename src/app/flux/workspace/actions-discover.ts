import { isEqualWith } from 'lodash';

import { controller } from '../../lib/controller';
import { NetworkedMachineInfo } from './NetworkedMachine';
import { Server } from './Server';
import baseActions from './actions-base';
import { ConnectionType } from './state';
import { CUSTOM_SERVER_NAME } from '../../constants';
// import { CUSTOM_SERVER_NAME } from '../../constants/index';


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
        'machine:discover': (data: { devices: NetworkedMachineInfo[] }) => {
            // Skip
            const connectionType = getState().workspace.connectionType;
            if (connectionType !== ConnectionType.WiFi) {
                return;
            }

            const devices = data.devices as NetworkedMachineInfo[];

            // Note that we may receive this event many times.
            const { servers } = getState().workspace;

            /*
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
            */

            const newServers = [];
            for (const networkedMachine of devices) {
                const find = servers.find(server => {
                    return server.address === networkedMachine.address && server.name === networkedMachine.name;
                });

                if (find) {
                    newServers.push(find);
                } else {
                    const server = new Server({
                        name: networkedMachine.name,
                        address: networkedMachine.address,
                        sacp: networkedMachine.sacp
                    });
                    newServers.push(server);
                }
            }

            // keep manual added servers
            for (const server of servers) {
                if (server.nmae === CUSTOM_SERVER_NAME) {
                    newServers.push(server);
                }
            }

            const rest = isEqualWith(newServers, servers, checkIfEqual);
            if (!rest) {
                dispatch(baseActions.updateState({ servers: newServers }));
            }
        },
        'machine:serial-discover': ({ devices }) => {
            // Note that we may receive this event many times.
            const { servers, connectionType } = getState().workspace;
            // Update serial ports only when connenctionType is active
            if (connectionType === ConnectionType.Serial) {
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
const discoverSnapmakerServers = () => {
    return (dispatch, getState) => {
        dispatch(baseActions.updateState({ serverDiscovering: true }));

        // reset discover state whatever search is done or not
        setTimeout(() => {
            const state = getState().machine;
            if (state.serverDiscovering) {
                dispatch(baseActions.updateState({ serverDiscovering: false }));
            }
        }, 3000);

        controller.discoverNetworkedMachines();
    };
};

export default {
    init,
    discoverSnapmakerServers
};
