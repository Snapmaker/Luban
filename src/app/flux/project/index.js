import { HEAD_CNC, HEAD_LASER, HEAD_3DP, HEAD_TYPE_ENV_NAME } from '../../constants';
import api from '../../api';
import { actions as printingActions } from '../printing';
import { actions as editorActions } from '../editor';
import { actions as workspaceActions } from '../workspace';

import i18n from '../../lib/i18n';
import UniApi from '../../lib/uni-api';

const INITIAL_STATE = {
    [HEAD_3DP]: {
        findLastEnvironment: false,
        openedFile: null,
        unSaved: false,
        content: null,
        initState: true
    },
    [HEAD_CNC]: {
        findLastEnvironment: false,
        openedFile: null,
        unSaved: false,
        content: null,
        initState: true
    },
    [HEAD_LASER]: {
        findLastEnvironment: false,
        openedFile: null,
        unSaved: false,
        content: null,
        initState: true
    }
};
const ACTION_UPDATE_STATE = 'EDITOR_ACTION_UPDATE_STATE';

const headType2FluxMod = (headType) => {
    return headType === '3dp' ? 'printing' : headType;
};

export const actions = {
    updateState: (headType, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            headType,
            state
        };
    },

    initRecoverService: () => (dispatch) => {
        const startService = (envHeadType) => {
            dispatch(actions.getLastEnvironment(envHeadType));
            const action = actions.autoSaveEnvironment(envHeadType);
            setInterval(() => dispatch(action), 1000);
        };

        startService(HEAD_LASER);
        startService(HEAD_CNC);
        startService(HEAD_3DP);
    },


    autoSaveEnvironment: (headType, force = false) => async (dispatch, getState) => {
        const fluxMod = headType2FluxMod(headType);
        const editorState = getState()[fluxMod];
        const { initState, content: lastString } = getState().project[headType];

        const models = editorState.modelGroup.getModels();
        // dispatch(actions.updateState(headType, { hasModel: !!models.length }));
        if (!models.length && initState) return;

        const { defaultMaterialId, defaultQualityId, isAdvised } = editorState;
        const envObj = { headType, defaultMaterialId, defaultQualityId, isAdvised, models: [] };
        for (let key = 0; key < models.length; key++) {
            const model = models[key];
            envObj.models.push(model.getSerializableConfig());
        }
        const content = JSON.stringify(envObj);

        if (force || content !== lastString) {
            dispatch(actions.updateState(headType, { content, unSaved: true, initState: false }));
            await api.saveEnv({ content });
        }
    },

    getLastEnvironment: (headType) => async (dispatch) => {
        const { body: { content } } = await api.getEnv({ headType });
        content && dispatch(actions.updateState(headType, { findLastEnvironment: true, content }));
    },

    clearSavedEnvironment: (headType) => async (dispatch) => {
        try {
            await api.removeEnv({ headType });
        } catch (e) {
            console.log(e);
        }

        dispatch(actions.updateState(headType, { findLastEnvironment: false, unSaved: false }));
    },

    onRecovery: (envHeadType, backendRecover = true) => async (dispatch, getState) => {
        const { content } = getState().project[envHeadType];

        // backup project if needed
        if (backendRecover) {
            await api.recoverEnv({ content });
        }

        const envObj = JSON.parse(content);
        let modActions = null;
        let modState = null;
        if (envHeadType === HEAD_CNC || envHeadType === HEAD_LASER) {
            modActions = editorActions;
            modState = getState()[envHeadType];
        }
        if (envHeadType === HEAD_3DP) {
            modActions = printingActions;
            modState = getState().printing;
        }

        await dispatch(modActions.init(envHeadType));
        modState.modelGroup.removeAllModels();

        modState.toolPathModelGroup && modState.toolPathModelGroup.removeAllModels();
        modState.svgModelGroup && modState.svgModelGroup.svgContentGroup.removeAllElements();
        const { models, ...restState } = envObj;
        for (let k = 0; k < models.length; k++) {
            const { headType, originalName, uploadName, config, sourceType, gcodeConfig, sourceWidth, sourceHeight, mode, transformation } = models[k];
            dispatch(modActions.generateModel(headType, originalName, uploadName, sourceWidth, sourceHeight, mode,
                sourceType, config, gcodeConfig, transformation));
        }
        dispatch(modActions.updateState(restState));

        dispatch(actions.clearSavedEnvironment(envHeadType));
    },

    quitRecovery: (headType) => async (dispatch) => {
        dispatch(actions.clearSavedEnvironment(headType));
    },

    saveAsFile: (headType) => async (dispatch) => {
        const { body: { targetFile } } = await api.packageEnv({ headType });
        const tmpFile = `/Tmp/${targetFile}`;
        const openedFile = UniApi.File.saveAs(targetFile, tmpFile);
        if (openedFile) {
            openedFile && UniApi.Window.setOpenedFile(openedFile.name);
            dispatch(actions.updateState(headType, { findLastEnvironment: false, openedFile }));
            UniApi.Menu.setItemEnabled('save', !!openedFile);
        }
        await dispatch(actions.clearSavedEnvironment(headType));
    },
    save: (headType, dialogOptions = false) => async (dispatch, getState) => {
        // ? save should return when no model in editor
        const state = getState().project[headType];
        const { openedFile, unSaved } = state;
        if (!unSaved) return;
        // https://github.com/electron/electron/pull/4029 Should revers change after the electron version is upgraded
        if (dialogOptions) {
            const idxClicked = UniApi.Dialog.showMessageBox({
                ...dialogOptions,
                type: 'warning',
                defaultId: 2,
                buttons: [
                    i18n._('Save'),
                    i18n._('Cancel'),
                    i18n._('Don\'t Save')
                ]
            });

            if (idxClicked === 1) throw new Error('Cancel');
            if (idxClicked === 2) {
                return;
            }
        }
        if (!openedFile) {
            await dispatch(actions.saveAsFile(headType));
            return;
        }

        const { body: { targetFile } } = await api.packageEnv({ headType });
        const tmpFile = `/Tmp/${targetFile}`;
        UniApi.File.save(openedFile.path, tmpFile);
    },

    open: (file, history) => async (dispatch) => {
        const [, tail] = file.name.split('.');

        if (tail.substring(0, 4) === 'snap') {
            const formData = new FormData();
            let openedFile = null;
            if (!(file instanceof File)) {
                openedFile = file;
                UniApi.Window.setOpenedFile(file.name);
                file = JSON.stringify(file);
            }
            formData.append('file', file);
            const { body: { content } } = await api.recoverProjectFile(formData);
            const envObj = JSON.parse(content);
            const headType = envObj.headType;


            await dispatch(actions.save(headType, {
                message: i18n._('Do you want to save the changes in the {{headType}} editor?', { headType: HEAD_TYPE_ENV_NAME[headType] })
            }));

            content && dispatch(actions.updateState(headType, { findLastEnvironment: false, content, openedFile, unSaved: false }));
            history.push(`/${headType}`);
            dispatch(actions.onRecovery(headType, false));
            setTimeout(() => {
                dispatch(actions.updateState(headType, { unSaved: false }));
            }, 2000);
        } else {
            dispatch(workspaceActions.uploadGcodeFile(file));
            history.push('/workspace');
        }
    }

};


export default function reducer(state = INITIAL_STATE, action) {
    const { type, headType } = action;
    if (!headType || type !== ACTION_UPDATE_STATE) return state;
    const editorState = Object.assign({}, state[headType], action.state);

    if (type === ACTION_UPDATE_STATE) {
        return Object.assign({}, state, { [headType]: editorState });
    }
    return state;
}
