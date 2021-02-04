import combokeys from '../../lib/combokeys';
import { actions as printingActions } from '../printing';
import { actions as editorActions } from '../editor';
import {
    ACTION_UPDATE_STATE
} from '../actionType';
import { DISPLAYED_TYPE_MODEL, PAGE_PROCESS } from '../../constants';

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
            'ESC': () => {
                const from = window.location.hash.split('/')[1];

                if (from === '3dp') {
                    const { modelGroup } = getState().printing;
                    modelGroup.unselectAllModels();
                    dispatch(printingActions.render());
                }
                // TODO: canvans cannot auto refresh by unselect
                // if (['laser', 'cnc'].includes(from)) {
                //     const { modelGroup } = getState()[from];
                //     modelGroup.unselectAllModels();
                //     dispatch(editorActions.render());
                // }
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
                if (from === 'laser' || from === 'cnc') {
                    const { page, displayedType } = getState()[from];
                    page === PAGE_PROCESS && displayedType === DISPLAYED_TYPE_MODEL && (dispatch(editorActions.selectAllToolPathModels(from)));
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
                    // use arrow keys to move models
                    // on keyUp listener is in SVGCanvas
                    let dx = 0, dy = 0;
                    const step = 0.1;
                    switch (e.key) {
                        case 'ArrowUp':
                            dy += -step;
                            break;
                        case 'ArrowDown':
                            dy += step;
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
                    // elements === null means move selected elements
                    dispatch(editorActions.moveElementsOnKeyDown(from, null, { dx, dy }));
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
