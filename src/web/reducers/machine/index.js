import request from 'superagent';
import controller from '../../lib/controller';

const ACTION_SET_STATE = 'machine/ACTION_SET_STATE';

const INITIAL_STATE = {
    enclosure: false,
    devices: []
};

class Device {
    constructor(name, address, model) {
        this.name = name;
        this.address = address;
        this.model = model || 'Unknown Model';
        this.selected = false;
        this.status = 'UNKNOWN'; // UNKNOWN, IDLE, RUNNING, PAUSED
    }

    get host() {
        return `http://${this.address}:8080`;
    }

    uploadFile(filename, file, callback) {
        const api = `${this.host}/api/upload`;
        request
            .post(api)
            .attach(filename, file)
            .end(callback);
    }

    requestStatus(callback) {
        const api = `${this.host}/api/machine_status`;
        request.get(api).timeout(1000).end(callback);
    }
}

export const actions = {
    // Update state directly
    updateState: (state) => {
        return {
            type: ACTION_SET_STATE,
            state
        };
    },

    // Initialize machine, get machine configurations via API
    init: () => (dispatch, getState) => {
        // register event listeners
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
                    deviceObjects.push(new Device(device.name, device.address, device.model));
                }
                // FIXME: For KS Shooting
                deviceObjects.push(new Device('My Snapmaker Model Plus', '172.18.1.99', 'Snapmaker 2 Model Plus'));
                deviceObjects.push(new Device('My Snapmaker Model Plus2', '172.18.1.100', 'Snapmaker 2 Model Plus'));
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
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_SET_STATE:
            return Object.assign({}, state, action.state);

        default:
            return state;
    }
}
