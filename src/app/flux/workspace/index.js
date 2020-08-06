// Reducer for Workspace
import * as THREE from 'three';

import uuid from 'uuid';
import api from '../../api';
import log from '../../lib/log';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import GcodeToArraybufferGeometry from '../../workers/GcodeToArraybufferGeometry.worker';

import gcodeBufferGeometryToObj3d from '../../workers/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d';
import { CONNECTION_STATUS_CONNECTED, EPSILON, PROTOCOL_TEXT } from '../../constants';
import { controller } from '../../lib/controller';

// Actions
const ACTION_SET_STATE = 'WORKSPACE/ACTION_SET_STATE';

export const WORKSPACE_STAGE = {
    EMPTY: 0,
    LOADING_GCODE: 1,
    LOAD_GCODE_SUCCEED: 2,
    LOAD_GCODE_FAILED: 3
};

const INITIAL_STATE = {
    uploadState: 'idle', // uploading, uploaded
    renderState: 'idle',
    gcodeFile: null,
    boundingBox: null,
    gcodeFiles: [],
    modelGroup: new THREE.Group(),
    renderingTimestamp: 0,
    stage: WORKSPACE_STAGE.EMPTY,
    progress: 0
};

const gcodeRenderingWorker = new GcodeToArraybufferGeometry();

export const actions = {
    init: () => (dispatch, getState) => {
        gcodeRenderingWorker.onmessage = (e) => {
            const data = e.data;
            const { status, value, renderMethod, isDone, boundingBox } = data;
            switch (status) {
                case 'succeed': {
                    const { modelGroup, gcodeFile } = getState().workspace;
                    const { positions, colors, index, indexColors } = value;

                    const bufferGeometry = new THREE.BufferGeometry();
                    const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
                    const indexAttribute = new THREE.Float32BufferAttribute(index, 1);
                    const colorAttribute = new THREE.Uint8BufferAttribute(colors, 3);
                    const indexColorAttribute = new THREE.Uint8BufferAttribute(indexColors, 3);
                    // this will map the buffer values to 0.0f - +1.0f in the shader
                    colorAttribute.normalized = true;
                    indexColorAttribute.normalized = true;

                    bufferGeometry.addAttribute('position', positionAttribute);
                    bufferGeometry.addAttribute('a_color', colorAttribute);
                    bufferGeometry.addAttribute('a_index', indexAttribute);
                    bufferGeometry.addAttribute('a_index_color', indexColorAttribute);

                    const object3D = gcodeBufferGeometryToObj3d('WORKSPACE', bufferGeometry, renderMethod);
                    // object3D.material.uniforms.u_visible_index_count.value = 20000;
                    object3D.name = `${gcodeFile.name}-${uuid.v4()}`;

                    modelGroup.add(object3D);
                    object3D.position.copy(new THREE.Vector3());

                    if (isDone) {
                        dispatch(actions.updateState({
                            renderState: 'rendered',
                            boundingBox: boundingBox,
                            stage: WORKSPACE_STAGE.LOAD_GCODE_SUCCEED
                        }));
                    }

                    dispatch(actions.render());
                    break;
                }
                case 'progress': {
                    const state = getState().printing;
                    if (value - state.progress > 0.01 || value > 1 - EPSILON) {
                        dispatch(actions.updateState({ progress: value }));
                    }
                    break;
                }
                case 'err': {
                    dispatch(actions.updateState({
                        renderState: 'idle',
                        stage: WORKSPACE_STAGE.LOAD_GCODE_FAILED,
                        progress: 1
                    }));
                    break;
                }
                default:
                    break;
            }
        };
    },

    setGcodePrintingIndex: (index) => (dispatch, getState) => {
        const { modelGroup } = getState().workspace;
        for (const children of modelGroup.children) {
            children.material.uniforms.u_visible_index_count.value = index;
        }
    },

    updateState: (state) => {
        return {
            type: ACTION_SET_STATE,
            state
        };
    },

    render: () => (dispatch) => {
        dispatch(actions.updateState(
            {
                renderingTimestamp: +new Date()
            }
        ));
    },

    /**
     * Upload file to backend.
     * (and add to file transfer)
     *
     * @param file
     * @returns {Function}
     */
    uploadGcodeFileToList: (file) => (dispatch) => {
        const formData = new FormData();
        formData.append('file', file);

        api.uploadGcodeFile(formData)
            .then((res) => {
                const response = res.body;
                const header = response.gcodeHeader;
                const gcodeFile = {
                    name: file.name,
                    uploadName: response.uploadName,
                    size: file.size,
                    lastModified: file.lastModified,
                    thumbnail: header[';thumbnail'] || ''
                };
                dispatch(actions.addGcodeFiles(gcodeFile));
            })
            .catch(() => {
                // Ignore error
            });
    },

    /**
     * Upload file to backend.
     * (and add to file transfer)
     * (and render it)
     *
     * @param file
     * @returns {Function}
     */
    uploadGcodeFile: (file) => (dispatch) => {
        const formData = new FormData();
        formData.append('file', (file instanceof File) ? file : JSON.stringify(file));
        const uploadName = pathWithRandomSuffix(file.name);
        formData.append('uploadName', uploadName);

        api.uploadGcodeFile(formData)
            .then((res) => {
                const response = res.body;
                const header = response.gcodeHeader;
                const gcodeFile = {
                    name: file.name,
                    uploadName: response.uploadName,
                    size: file.size,
                    lastModified: +file.lastModified,
                    thumbnail: header[';thumbnail'] || ''
                };
                dispatch(actions.renderGcodeFile(gcodeFile));
            })
            .catch(() => {
                // Ignore error
            });
    },

    clearGcode: () => (dispatch, getState) => {
        const { modelGroup } = getState().workspace;
        modelGroup.remove(...modelGroup.children);
        dispatch(actions.updateState({
            renderState: 'idle',
            gcodeFile: null,
            boundingBox: null,
            stage: WORKSPACE_STAGE.EMPTY,
            progress: 0
        }));
        dispatch(actions.render());
    },

    // updateGcodeFilename: (name, x = 0, y = 0, z = 0) => (dispatch, getState) => {
    //     const { modelGroup, gcodeFilenameObject } = getState().workspace;
    //     gcodeFilenameObject && modelGroup.remove(gcodeFilenameObject);
    //     const textSize = 5;
    //     const gcodeFilenameObjectTmp = new TextSprite({
    //         x: x,
    //         y: y,
    //         z: z,
    //         size: textSize,
    //         text: `G-code: ${name}`,
    //         color: colornames('gray 44'), // grid color
    //         opacity: 0.5
    //     });
    //     modelGroup.add(gcodeFilenameObjectTmp);
    //     dispatch(actions.updateState({
    //         gcodeFilenameObject: gcodeFilenameObjectTmp
    //     }));
    // },

    renderGcode: (name, gcode) => (dispatch) => {
        dispatch(actions.clearGcode());
        const blob = new Blob([gcode], { type: 'text/plain' });
        const file = new File([blob], name);

        const formData = new FormData();
        formData.append('file', file);
        api.uploadFile(formData).then((res) => {
            const response = res.body;
            const gcodeFile = {
                name: file.name,
                uploadName: response.uploadName,
                size: file.size,
                lastModified: +file.lastModified,
                thumbnail: ''
            };
            dispatch(actions.renderGcodeFile(gcodeFile, false));
        });
    },

    renderGcodeFile: (gcodeFile, needToList = true) => (dispatch, getState) => {
        const oldGcodeFile = getState().workspace.gcodeFile;

        if (needToList) {
            dispatch(actions.addGcodeFiles(gcodeFile));
        }
        if (oldGcodeFile !== null && oldGcodeFile.uploadName === gcodeFile.uploadName) {
            return;
        }
        dispatch(actions.clearGcode());
        dispatch(actions.updateState({
            gcodeFile,
            stage: WORKSPACE_STAGE.LOADING_GCODE,
            renderState: 'rendering',
            progress: 0
        }));
        dispatch(actions.loadGcode(gcodeFile));
        gcodeRenderingWorker.postMessage({ func: 'WORKSPACE', gcodeFilename: gcodeFile.uploadName });
    },

    addGcodeFiles: (fileInfo) => (dispatch, getState) => {
        const { gcodeFiles } = getState().workspace;
        const files = [];
        fileInfo.isRenaming = false;
        fileInfo.newName = fileInfo.name;
        files.push(fileInfo);
        let added = 1, i = 0;
        while (added < 5 && i < gcodeFiles.length) {
            const gcodeFile = gcodeFiles[i];
            // G-code file with the same uploadName will be replaced with current one
            if (gcodeFile.uploadName !== fileInfo.uploadName) {
                files.push(gcodeFile);
                added++;
            }
            i++;
        }
        dispatch(actions.updateState({
            gcodeFiles: files
        }));
    },

    renameGcodeFile: (uploadName, newName = null, isRenaming = null) => (dispatch, getState) => {
        const { gcodeFiles } = getState().workspace;
        const find = gcodeFiles.find(e => e.uploadName === uploadName);
        if (!find) {
            return;
        }
        if (newName !== null) {
            find.newName = newName;
            find.name = newName;
        }
        if (isRenaming !== null) {
            find.isRenaming = isRenaming;
        }
        const files = gcodeFiles.map(e => e);

        dispatch(actions.updateState({
            gcodeFiles: files
        }));
    },

    removeGcodeFile: (fileInfo) => (dispatch, getState) => {
        const { gcodeFiles } = getState().workspace;

        const files = gcodeFiles.filter((item) => {
            return item.uploadName !== fileInfo.uploadName;
        });

        dispatch(actions.updateState({
            gcodeFiles: files
        }));
    },

    /**
     * Tell controller to load G-code.
     *
     * @param gcodeFile An object that contains information of G-code file.
     * @returns {Promise}
     */
    loadGcode: (gcodeFile) => async (dispatch, getState) => {
        const { connectionStatus, port } = getState().machine;
        gcodeFile = gcodeFile || getState().workspace.gcodeFile;
        if (connectionStatus !== CONNECTION_STATUS_CONNECTED || gcodeFile === null) {
            return;
        }
        dispatch(actions.updateState({ uploadState: 'uploading' }));
        try {
            await api.loadGCode({ port, dataSource: PROTOCOL_TEXT, uploadName: gcodeFile.uploadName });

            dispatch(actions.updateState({ uploadState: 'uploaded' }));
        } catch (e) {
            dispatch(actions.updateState({ uploadState: 'idle' }));

            log.error('Failed to upload G-code to controller');
        }
    },

    unloadGcode: () => (dispatch) => {
        controller.command('gcode:unload');
        dispatch(actions.updateState({ uploadState: 'idle' }));
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_SET_STATE: {
            return Object.assign({}, state, { ...action.state });
        }

        default:
            return state;
    }
}
