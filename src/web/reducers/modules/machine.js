import controller from '../../lib/controller';

const ACTION_NO_REDUCER_SET_STATE = 'machine/ACTION_NO_REDUCER_SET_STATE';

const INITIAL_STATE = {
    enclosure: false
};

export const actions = {
    setState: (state) => {
        return {
            type: ACTION_NO_REDUCER_SET_STATE,
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
                    dispatch(actions.setState({ enclosure: settings.enclosure }));
                }
            }
        };

        Object.keys(controllerEvents).forEach(event => {
            controller.on(event, controllerEvents[event]);
        });
    },
    getEnclosureState: () => () => {
        controller.writeln('M1010');
    },
    setEnclosureState: (doorDetection) => () => {
        controller.writeln('M1010 S' + (doorDetection ? '1' : '0'));
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        // no-reducer action
        case ACTION_NO_REDUCER_SET_STATE:
            return Object.assign({}, state, action.state);

        default:
            return state;
    }
}
