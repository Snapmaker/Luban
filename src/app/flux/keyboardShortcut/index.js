import combokeys from '../../lib/combokeys';
import { actions as printingActions } from '../printing';
import { actions as editorActions } from '../editor';
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
            'DELETE': () => {
                const from = window.location.hash.split('/')[1];
                if (['laser', 'cnc'].includes(from)) {
                    dispatch(editorActions.removeSelectedModel(from));
                } else if (from === '3dp') {
                    const { displayedType } = getState().printing;
                    displayedType === 'model' && (dispatch(printingActions.removeSelectedModel()));
                }
            },
            'DUPLICATE': () => {
                const from = window.location.hash.split('/')[1];
                if (from === '3dp') {
                    const { displayedType } = getState().printing;
                    displayedType === 'model' && (dispatch(printingActions.duplicateSelectedModel()));
                } else {
                    dispatch(editorActions.duplicateSelectedModel(from));
                }
            },
            'SELECTALL': () => {
                const from = window.location.hash.split('/')[1];
                if (from === '3dp') {
                    const { displayedType } = getState().printing;
                    displayedType === 'model' && (dispatch(printingActions.selectAllModels()));
                }
            },
            'COPY': () => {
                const from = window.location.hash.split('/')[1];
                if (from === '3dp') {
                    const { displayedType } = getState().printing;
                    displayedType === 'model' && (dispatch(printingActions.copy()));
                }
            },
            'UNDO': () => {
                const from = window.location.hash.split('/')[1];
                if (from === '3dp') {
                    const { displayedType } = getState().printing;
                    displayedType === 'model' && (dispatch(printingActions.undo()));
                }
            },
            'PASTE': () => {
                const from = window.location.hash.split('/')[1];
                if (from === '3dp') {
                    const { displayedType } = getState().printing;
                    displayedType === 'model' && (dispatch(printingActions.paste()));
                }
            },
            'JOG': (event, { direction }) => {
                const from = window.location.hash.split('/')[1];
                if (from === '3dp') {
                    const { layerCountDisplayed } = getState().printing;
                    dispatch(printingActions.showGcodeLayers(layerCountDisplayed + direction));
                }
            },
            'Arrow': (e, { direction }) => {
                const from = window.location.hash.split('/')[1];
                if (['laser', 'cnc'].includes(from)) {
                    let dx = 0, dy = 0;
                    const step = 0.1;
                    switch (e.key) {
                        case 'ArrowUp':
                            dy += step;
                            break;
                        case 'ArrowDown':
                            dy += -step;
                            break;
                        case 'ArrowLeft':
                            dx += -step;
                            break;
                        case 'ArrowRight':
                            dx += step;
                            break;
                        default:
                            break;
                    }
                    dispatch(editorActions.updateSelectedModelDeviation(from, { dx, dy }));
                }
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
