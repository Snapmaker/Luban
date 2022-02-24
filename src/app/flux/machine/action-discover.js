import { controller } from '../../lib/controller';

import { Server } from './Server';
import baseActions from './action-base';


const init = () => (dispatch, getState) => {
    const controllerEvents = {
        // Receive when new servers discovered
        'machine:discover': ({ devices, type }) => {
            // Note that we may receive this event many times.
            const { servers, connectionType } = getState().machine;
            const resultServers = connectionType === type ? servers : [];
            for (const object of devices) {
                const find = servers.find(v => v.address === object.address && v.port === object.port);
                if (!find) {
                    const server = new Server(object.name, object.address, object.port);
                    servers.unshift(server);
                }
            }

            dispatch(baseActions.updateState({ servers: resultServers }));
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
