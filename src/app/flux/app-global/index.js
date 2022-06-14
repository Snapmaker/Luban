import { EPSILON, HEAD_PRINTING } from '../../constants';
import { controller } from '../../lib/controller';
import { PROCESS_STAGE, STEP_STAGE } from '../../lib/manager/ProgressManager';

import { baseActions as editorActions } from '../editor/actions-base';
// eslint-disable-next-line import/no-cycle
import { actions as printingActions } from '../printing/index';

const ACTION_UPDATE_STATE = 'app-global/ACTION_UPDATE_STATE';
const DEFAULT_MODAL_ZINDEX = 9999;
const DEFAULT_STATE = {
    showSavedModal: false,
    savedModalType: '', // 'web', 'electron'
    savedModalFilePath: '',
    savedModalZIndex: DEFAULT_MODAL_ZINDEX,

    showArrangeModelsError: false,
    arrangeModelZIndex: DEFAULT_MODAL_ZINDEX
};
const SHOW_MODAL_TIME = 15000;
let clearSavedModalTimer = null;
let clearArrangeModelsModalTimer = null;

export const actions = {
    updateState: (state, headType) => {
        if (headType) {
            if (headType === HEAD_PRINTING) {
                return printingActions.updateState(state);
            } else {
                return editorActions.updateState(headType, state);
            }
        } else {
            return {
                type: ACTION_UPDATE_STATE,
                state
            };
        }
    },

    // TODO: need to add an close function
    // options: { showSavedModal, savedModalType, savedModalFilePath }
    updateSavedModal: (options) => (dispatch, getState) => {
        const newState = {
            showSavedModal: options.showSavedModal,
            savedModalType: options.savedModalType,
            savedModalFilePath: options.savedModalFilePath,
            savedModalZIndex: DEFAULT_MODAL_ZINDEX,
            arrangeModelZIndex: getState().appGlobal.arrangeModelZIndex - 1
        };
        if (options.showSavedModal) {
            clearTimeout(clearSavedModalTimer);
            clearSavedModalTimer = setTimeout(() => {
                dispatch(actions.updateSavedModal({
                    showSavedModal: false
                }));
            }, SHOW_MODAL_TIME);
        } else {
            clearTimeout(clearSavedModalTimer);
        }
        dispatch(actions.updateState(newState));
    },

    updateShowArrangeModelsError: (options) => (dispatch, getState) => {
        const newState = {
            showArrangeModelsError: options.showArrangeModelsError,
            arrangeModelZIndex: DEFAULT_MODAL_ZINDEX,
            savedModalZIndex: getState().appGlobal.savedModalZIndex - 1
        };
        if (options.showArrangeModelsError) {
            clearTimeout(clearArrangeModelsModalTimer);
            clearArrangeModelsModalTimer = setTimeout(() => {
                dispatch(actions.updateShowArrangeModelsError({
                    showArrangeModelsError: false
                }));
            }, SHOW_MODAL_TIME);
        } else {
            clearTimeout(clearArrangeModelsModalTimer);
        }
        dispatch(actions.updateState(newState));
    },

    repairSelectedModels: (headType) => async (dispatch, getState) => {
        const { modelGroup, progressStatesManager } = getState()[headType];
        const { size } = getState().machine;
        const allModels = modelGroup.getModels();
        if (allModels.length === 0) {
            return {
                allPepaired: true,
                results: []
            };
        }
        const selectedModels = modelGroup.getSelectedModelArray();
        const models = selectedModels.length > 0 ? selectedModels : allModels;

        progressStatesManager.startProgress(
            PROCESS_STAGE.PRINTING_REPAIRING_MODEL
        );
        dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_REPAIRING_MODEL,
                progress: progressStatesManager.updateProgress(
                    STEP_STAGE.PRINTING_REPAIRING_MODEL,
                    0.01
                )
            }, headType)
        );
        const minimumTime = (() => {
            return new Promise((reolve) => {
                setTimeout(() => {
                    reolve();
                }, 1000);
            });
        })();
        const promptTasks = [];
        const results = [];
        let completedNum = 0;
        const promises = models.map(async (model) => {
            return controller.repairModel({
                uploadName: model.sourcePly || model.uploadName,
                modelID: model.modelID,
                size
            }, (data) => {
                const { type } = data;
                switch (type) {
                    case 'progress':
                        if (data.progress && models.length === 1) {
                            const { progress } = getState().printing;
                            if (
                                data.progress - progress > 0.01
                                || data.progress > 1 - EPSILON
                            ) {
                                dispatch(
                                    actions.updateState({
                                        progress: progressStatesManager.updateProgress(
                                            STEP_STAGE.PRINTING_REPAIRING_MODEL,
                                            data.progress
                                        )
                                    }, headType)
                                );
                            }
                        }
                        break;
                    case 'error':
                        // TODO: Whether to set the identification of repair failure
                        promptTasks.push({
                            status: 'repair-model-fail',
                            originalName: model.originalName
                        });
                        break;
                    case 'success':
                        if (models.length > 1) {
                            completedNum++;
                            dispatch(
                                actions.updateState({
                                    progress: progressStatesManager.updateProgress(
                                        STEP_STAGE.PRINTING_REPAIRING_MODEL,
                                        1 * (completedNum / models.length) - 0.01
                                    )
                                }, headType)
                            );
                        }
                        results.push(data);
                        model.setSourcePly(data.sourcePly);
                        break;
                    default:
                        break;
                }
            });
        });

        await Promise.all([minimumTime, ...promises]);

        dispatch(
            actions.updateState({
                promptTasks,
                stage: STEP_STAGE.PRINTING_REPAIRING_MODEL,
                progress: progressStatesManager.updateProgress(
                    STEP_STAGE.PRINTING_REPAIRING_MODEL,
                    1
                )
            }, headType)
        );

        return {
            allPepaired: promptTasks.length === 0,
            results
        };
    }
};
export default function reducer(state = DEFAULT_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        default: {
            return state;
        }
    }
}
