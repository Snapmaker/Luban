import { controller } from '../../lib/controller';

import { Server } from './Server';
import baseActions from './action-base';


const init = () => (dispatch, getState) => {
    const controllerEvents = {
        // Receive when new servers discovered
        'http:discover': (objects) => {
            // Note that we may receive this event many times.
            const { servers } = getState().machine;

            for (const object of objects) {
                const find = servers.find(v => v.address === object.address && v.name === object.name);
                if (!find) {
                    const server = new Server(object.name, object.address, object.model);
                    servers.unshift(server);
                }
            }

            dispatch(baseActions.updateState({ servers: [...servers] }));
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
