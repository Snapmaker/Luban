import combokeys from '../../lib/combokeys';
import { actions as cncLaserSharedActions } from '../cncLaserShared';
import { actions as printingActions } from '../printing';
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
                const from = window.location.hash.split('/')[1];
                if (['laser', 'cnc'].includes(from)) {
                    dispatch(cncLaserSharedActions.removeSelectedModel(from));
                } else if (from === '3dp') {
                    const { modelGroup, displayedType } = getState().printing;
                    displayedType === 'model' && (modelGroup.removeSelectedModel());
                }
            },
            'JOG': (event, { axis, direction }) => {
                const from = window.location.hash.split('/')[1];
                if (from === '3dp') {
                    const { layerCountDisplayed } = getState().printing;
                    dispatch(printingActions.showGcodeLayers(layerCountDisplayed + direction));
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
