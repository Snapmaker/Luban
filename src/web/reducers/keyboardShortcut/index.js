import combokeys from '../../lib/combokeys';
import {
    ACTION_UPDATE_STATE
} from '../actionType';

export const actions = {
    updateState: (from, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            from,
            state
        };
    },
    init: () => (dispatch, getState) => {
        const keyEventHandlers = {
            'DELETE': (event) => {
                const hash = window.location.hash;
                const from = hash.split('/')[1];
                // todo: 3dp
                if (['laser', 'cnc'].includes(from)) {
                    const { modelGroup } = getState()[from];
                    modelGroup.removeSelectedModel();
                    const hasModel = (modelGroup.getModels().length > 0);
                    dispatch(actions.updateState(
                        from,
                        {
                            model: null,
                            mode: '',
                            transformation: {},
                            printOrder: 0,
                            gcodeConfig: {},
                            config: {},
                            hasModel
                        }
                    ));
                }
            }
        };
        Object.keys(keyEventHandlers).forEach(eventName => {
            const callback = keyEventHandlers[eventName];
            combokeys.on(eventName, callback);
        });
    }
};

export default function reducer() {
    return {};
}
