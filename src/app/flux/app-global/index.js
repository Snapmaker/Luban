import path from 'path';
import { EPSILON, HEAD_PRINTING, DATA_PREFIX, } from '../../constants';
import { controller } from '../../lib/controller';
import { PROCESS_STAGE, STEP_STAGE } from '../../lib/manager/ProgressManager';

import { baseActions as editorActions } from '../editor/actions-base';
// eslint-disable-next-line import/no-cycle
import { actions as projectActions } from '../project';
// eslint-disable-next-line import/no-cycle
import { actions as printingActions, uploadMesh } from '../printing/index';
import ThreeGroup from '../../models/ThreeGroup';
import workerManager from '../../lib/manager/workerManager';
import ThreeUtils from '../../three-extensions/ThreeUtils';

const ACTION_UPDATE_STATE = 'app-global/ACTION_UPDATE_STATE';
const DEFAULT_MODAL_ZINDEX = 9999;
const DEFAULT_STATE = {
    showSavedModal: false,
    savedModalType: '', // 'web', 'electron'
    savedModalFilePath: '',
    savedModalZIndex: DEFAULT_MODAL_ZINDEX,

    showOnlineCase: false,
    showDownloadPopup: false,

    showArrangeModelsError: false,
    arrangeModelZIndex: DEFAULT_MODAL_ZINDEX,
    downloadFiles: [],
    currentSavedPath: '',
    progress: 0
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
        let models = selectedModels.length > 0 ? selectedModels : allModels;

        models = models.filter((model) => {
            return model.visible && model !== modelGroup.primeTower;
        });
        if (models.length === 0) {
            return {
                allPepaired: true,
                results: []
            };
        }
        workerManager.stopClipper();
        const { recovery } = modelGroup.unselectAllModels();

        progressStatesManager.startProgress(
            PROCESS_STAGE.PRINTING_REPAIRING_MODEL
        );
        dispatch(
            actions.updateState({
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
        const promises = [];
        modelGroup.traverseModels(models, async (model) => {
            if (!(model instanceof ThreeGroup)) {
                const promise = new Promise(async (resolve, reject) => {
                    let uploadName = model.uploadName;
                    if (headType === HEAD_PRINTING) {
                        workerManager.stopCalculateSectionPoints(model.modelID);
                        const mesh = model.meshObject.clone(false);
                        mesh.clear();
                        const basenameWithoutExt = path.basename(
                            `${DATA_PREFIX}/${model.originalName}`,
                            path.extname(`${DATA_PREFIX}/${model.originalName}`)
                        );
                        const sourceRepairName = `${basenameWithoutExt}.stl`;

                        const uploadResult = await uploadMesh(mesh, sourceRepairName);
                        uploadName = uploadResult?.body?.uploadName;

                        ThreeUtils.dispose(mesh);
                    }
                    const task = await controller.repairModel({
                        uploadName: uploadName,
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
                                if (models.length === 1) {
                                    progressStatesManager.finishProgress(false);
                                }
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
                                workerManager.continueClipper();
                                break;
                            default:
                                break;
                        }
                    }).catch((err) => {
                        reject(err);
                    });
                    resolve(task);
                });

                promises.push(promise);
            }
        });

        await Promise.allSettled([minimumTime, ...promises]);
        if (!(promptTasks.length === 1 && models.length === 1)) {
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
        }

        progressStatesManager.finishProgress(
            !((models.length === 1 && promptTasks.length))
        );
        headType === HEAD_PRINTING && recovery();
        dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
        return {
            allPepaired: promptTasks.length === 0,
            results
        };
    },
    updateShowOnlineCase: (showOnlineCase) => (dispatch) => {
        dispatch(actions.updateState({ showOnlineCase }));
    },
    updateShowDownloadPopup: (showDownloadPopup) => (dispatch) => {
        dispatch(actions.updateState({ showDownloadPopup }));
    },
    updateDownloadedFiles: (downloadFiles) => (dispatch) => {
        console.log('downloadFiles', downloadFiles);
        dispatch(actions.updateState({ downloadFiles }));
    },
    updateCurrentDownload: (currentSavedPath) => (dispatch) => {
        dispatch(actions.updateState({ currentSavedPath }));
    },
    updateGlobalProgress: ({ progress, savedPath, allBytes, receivedBytes, state }) => (dispatch, getState) => {
        const { downloadFiles, currentSavedPath } = getState().appGlobal;
        if (currentSavedPath === savedPath) {
            dispatch(actions.updateState({ progress }));
        }
        const currentItem = downloadFiles.find(d => d.savedPath === savedPath);
        if (currentItem && progress) {
            console.log('currentSavedPath === savedPath', currentSavedPath, savedPath, state);
            currentItem.progress = progress;
            currentItem.state = state;
            currentItem.allBytes = allBytes;
            currentItem.receivedBytes = receivedBytes;
            dispatch(actions.updateState({ downloadFiles: [...downloadFiles] }));
        }
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
