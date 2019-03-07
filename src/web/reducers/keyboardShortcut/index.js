import combokeys from '../../lib/combokeys';
import { actions as cncLaserSharedActions } from '../cncLaserShared';

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
                    dispatch(cncLaserSharedActions.removeSelectedModel(from));
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
