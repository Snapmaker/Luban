import controller from '../../lib/controller';
import { NetworkDevice } from './NetworkDevice';
import store from '../../store';


const INITIAL_STATE = {
    // network devices
    devices: [],

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

        // Register event listeners
        const controllerEvents = {
            'Marlin:settings': (settings) => {
                const state = getState().machine;

                // enclosure is changed
                if (state.enclosure !== settings.enclosure) {
                    dispatch(actions.updateState({ enclosure: settings.enclosure }));
                }
            },
            'discoverSnapmaker:devices': (devices) => {
                const deviceObjects = [];
                for (const device of devices) {
                    deviceObjects.push(new NetworkDevice(device.name, device.address, device.model));
                }
                // FIXME: For KS Shooting
                deviceObjects.push(new NetworkDevice('My Snapmaker Model Plus', '172.18.1.99', 'Snapmaker 2 Model Plus'));
                deviceObjects.push(new NetworkDevice('My Snapmaker Model Plus2', '172.18.1.100', 'Snapmaker 2 Model Plus'));
                dispatch(actions.updateState({ devices: deviceObjects }));
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
    discoverSnapmaker: () => () => {
        controller.discoverSnapmaker();
    },
    updateMachineSize: (size) => {
        return {
            type: ACTION_UPDATE_STATE,
            state: { size }
        };
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
