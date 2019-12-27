// Reducer for Workspace
import path from 'path';
import * as THREE from 'three';
import GcodeInfo from '../models/GcodeInfo';

import api from '../../api';
import log from '../../lib/log';

// Actions
const ACTION_SET_STATE = 'WORKSPACE/ACTION_SET_STATE';
const ACTION_ADD_GCODE = 'WORKSPACE/ACTION_ADD_GCODE';

const INITIAL_STATE = {
    gcodeList: [],
    uploadState: 'idle', // uploading, uploaded
    gcodeFiles: [],


    background: {
        enabled: false,
        group: new THREE.Group()
    }
};


export function getGcodeName(gcodeList) {
    if (gcodeList.length === 0) {
        return null;
    }

    const gcodeBean = gcodeList[0];
    const filename = path.basename(gcodeBean.name);

    if (filename.endsWith('.gcode')
        || filename.endsWith('.nc')
        || filename.endsWith('.cnc')) {
        return filename;
    }

    return `${filename}.gcode`;
}

export function getGcodeType(gcodeList) {
    if (gcodeList.length === 0) {
        return null;
    }

    const gcodeBean = gcodeList[0];
    const filename = path.basename(gcodeBean.name);

    if (filename.endsWith('.nc')) {
        return 'Laser';
    }
    if (filename.endsWith('.cnc')) {
        return 'CNC';
    }

    return '3DP';
}

export const actions = {
    updateState: (state) => {
        return {
            type: ACTION_SET_STATE,
            state
        };
    },

    // Add G-code
    addGcode: (name, gcode, renderMethod = 'line') => {
        return {
            type: ACTION_ADD_GCODE,
            name,
            gcode,
            renderMethod
        };
    },

    uploadGcodeFile: (file) => (dispatch) => {
        const formData = new FormData();
        formData.append('file', file);
        api.uploadFile(formData)
            .then((res) => {
                const response = res.body;
                dispatch(actions.addGcodeFile({
                    name: file.name,
                    uploadName: response.uploadName,
                    size: file.size,
                    lastModifiedDate: file.lastModifiedDate,
                    img: ''
                }));
            })
            .catch(() => {
                // Ignore error
            });
    },

    addGcodeFile: (fileInfo) => (dispatch, getState) => {
        const { gcodeFiles } = getState().workspace;
        const files = [];
        files.push(fileInfo);
        const len = Math.min(gcodeFiles.length, 4);
        for (let i = 0; i < len; i++) {
            files.push(gcodeFiles[i]);
        }
        dispatch(actions.updateState({
            gcodeFiles: files
        }));
    },

    // Clear G-code list
    clearGcode: () => {
        return actions.updateState({ gcodeList: [] });
    },

    loadGcode: (port, dataSource, name, gcode) => async (dispatch) => {
        dispatch(actions.updateState({ uploadState: 'uploading' }));
        try {
            await api.loadGCode({ port, dataSource, name, gcode });

            dispatch(actions.updateState({ uploadState: 'uploaded' }));
        } catch (e) {
            dispatch(actions.updateState({ uploadState: 'idle' }));

            log.error('Failed to upload G-code to controller');
        }
    },

    unloadGcode: () => (dispatch) => {
        // TODO: unload G-code in controller
        dispatch(actions.updateState({ uploadState: 'idle' }));
    },

    removeBackgroundImage: () => (dispatch, getState) => {
        const state = getState().workspace;
        const { group } = state.background;
        group.remove(...group.children);
        dispatch(actions.updateState({
            background: {
                enabled: false,
                group: group
            }
        }));
    },

    loadBackgroundToWorkspace: (background) => (dispatch, getState) => {
        const workspaceBackgroundGroup = getState().workspace.background.group;
        const backgroundGroup = background.group;

        workspaceBackgroundGroup.remove(...workspaceBackgroundGroup.children);
        if (backgroundGroup.children.length > 0) {
            for (const child of backgroundGroup.children) {
                workspaceBackgroundGroup.add(child.clone());
            }
            dispatch(actions.updateState({
                background: {
                    enabled: true,
                    group: workspaceBackgroundGroup
                }
            }));
        }
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_SET_STATE: {
            return Object.assign({}, state, { ...action.state });
        }

        case ACTION_ADD_GCODE: {
            const { name, gcode, renderMethod } = action;

            // New list
            const list = [];
            for (const gcodeInfo of state.gcodeList) {
                list.push(gcodeInfo);
            }
            list.push(new GcodeInfo(name, gcode, renderMethod));

            return Object.assign({}, state, { gcodeList: list });
        }

        default:
            return state;
    }
}
