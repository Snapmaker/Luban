import {
    Box3,
    BufferGeometry,
    Float32BufferAttribute,
    Uint8BufferAttribute,
    Vector3
} from 'three';
import { v4 as uuid } from 'uuid';

import api from '../../api';
import {
    EPSILON,
    CONNECTION_STATUS_CONNECTED,
    PROTOCOL_TEXT,
} from '../../constants';
import { logGcodeExport } from '../../lib/gaEvent';
import log from '../../lib/log';
import workerManager from '../../lib/manager/workerManager';
import ThreeUtils from '../../scene/three-extensions/ThreeUtils';
import gcodeBufferGeometryToObj3d from '../../workers/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d';
import { MachineAgent } from './MachineAgent';
import baseActions from './actions-base';
import { ConnectionType, WORKSPACE_STAGE } from './state';
import { GCodeFileMetadata } from './types';


/**
 * Upload G-code File.
 *
 * Upload only, not add it to list or render it afterwards.
 *
 * In replacement for index.ts:actions.uploadGcodeFile()
 */
const uploadGcodeFile = (file: File) => {
    return async () => {
        const formData = new FormData();

        if (file instanceof File) {
            formData.append('file', file);
        } else {
            return null;
        }

        const res = await api.uploadGcodeFile(formData);

        const response = res.body;
        const header = response.gcodeHeader;

        const gcodeFile: GCodeFileMetadata = {
            name: file.name,
            uploadName: response.uploadName,
            size: file.size,
            lastModified: +file.lastModified,
            thumbnail: header[';thumbnail'] || '',
            renderGcodeFileName: file.renderGcodeFileName || file.name,
            boundingBox: new Box3(
                new Vector3(
                    header[';min_x(mm)'],
                    header[';min_y(mm)'],
                    header[';min_z(mm)'],
                    // b: header[';min_b(mm)']
                ),
                new Vector3(
                    header[';max_x(mm)'],
                    header[';max_y(mm)'],
                    header[';max_z(mm)'],
                    // b: header[';max_b(mm)'],
                ),
            ),

            type: header[';header_type'],
            tool_head: header[';tool_head'],
            nozzle_temperature: header[';nozzle_temperature(°C)'],
            build_plate_temperature: header[';build_plate_temperature(°C)'],
            work_speed: header[';work_speed(mm/minute)'],
            estimated_time: header[';estimated_time(s)'],
            matierial_weight: header[';matierial_weight'],
            nozzle_1_temperature: header[';nozzle_1_temperature(°C)'],
            jog_speed: header[';jog_speed(mm/minute)'],
            power: header[';power(%)'],
            is_rotate: header[';is_rotate'] === 'true',
            gcodeAxisWorkRange: {
                max: {
                    x: header[';max_x(mm)'],
                    y: header[';max_y(mm)'],
                    z: header[';max_z(mm)'],
                    b: header[';max_b(mm)']
                },
                min: {
                    x: header[';min_x(mm)'],
                    y: header[';min_y(mm)'],
                    z: header[';min_z(mm)'],
                    b: header[';min_b(mm)']
                }
            }
        };

        return gcodeFile;
    };
};

/**
 * 1. Add G-code info to G-code list.
 * 2. Update state (boundingBox)
 */
const addGCodeFile = (fileInfo: GCodeFileMetadata) => (dispatch, getState) => {
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

    dispatch(
        baseActions.updateState({
            gcodeFiles: files,
        })
    );

    // TODO: Remove this?
    if (fileInfo.boundingBox) {
        dispatch(
            baseActions.updateState({
                boundingBox: new Box3(
                    new Vector3().copy(fileInfo.boundingBox.min),
                    new Vector3().copy(fileInfo.boundingBox.max),
                ),
            })
        );
    }
};


const render = () => {
    return (dispatch) => {
        dispatch(
            baseActions.updateState({
                renderingTimestamp: +new Date(),
            })
        );
    };
};

// TODO: Refactor this
const clearGcode = (isPreview = false) => {
    return (dispatch, getState) => {
        const { modelGroup, previewModelGroup } = getState().workspace;
        if (isPreview) {
            previewModelGroup.remove(...previewModelGroup.children);
        } else {
            modelGroup.remove(...modelGroup.children);
        }
        dispatch(
            baseActions.updateState({
                renderState: 'idle',
                gcodeFile: null,
                boundingBox: new Box3(),
                stage: WORKSPACE_STAGE.EMPTY,
                progress: 0,
            })
        );
        dispatch(render());
    };
};

/**
 * Tell controller to load G-code.
 *
 * @param gcodeFile An object that contains information of G-code file.
 * @returns {Promise}
 */
const loadGcode = (gcodeFile: GCodeFileMetadata | null = null) => {
    return async (dispatch, getState) => {
        const { connectionStatus } = getState().workspace;
        const connectionType: ConnectionType = getState().workspace.connectionType;

        gcodeFile = gcodeFile || getState().workspace.gcodeFile;

        if (connectionType === ConnectionType.WiFi) {
            // Actually only with serial port plaintext protocol need to load G-code
            return;
        }

        if (connectionStatus !== CONNECTION_STATUS_CONNECTED || gcodeFile === null) {
            return;
        }

        const machineAgent: MachineAgent = getState().workspace.server;

        dispatch(baseActions.updateState({ uploadState: 'uploading' }));
        try {
            await api.loadGCode({
                port: machineAgent?.port,
                dataSource: PROTOCOL_TEXT,
                uploadName: gcodeFile.uploadName,
            });

            dispatch(baseActions.updateState({ uploadState: 'uploaded' }));
        } catch (e) {
            dispatch(baseActions.updateState({ uploadState: 'idle' }));

            log.error('Failed to upload G-code to controller');
        }
    };
};

const gcodeToArraybufferGeometryCallback = (data) => {
    return (dispatch, getState) => {
        const {
            status,
            gcodeFilename,
            value,
            renderMethod,
            isPreview = false,
            isDone,
            axisWorkRange,
        } = data;

        switch (status) {
            case 'succeed': {
                const { modelGroup, previewModelGroup } = getState().workspace;
                const boundingBox: Box3 = getState().workspace.boundingBox;
                const { positions, colors, index, indexColors } = value;

                const bufferGeometry = new BufferGeometry();
                const positionAttribute = new Float32BufferAttribute(positions.send, 3);
                const indexAttribute = new Float32BufferAttribute(index.send, 1);
                const colorAttribute = new Uint8BufferAttribute(colors.send, 3);
                const indexColorAttribute = new Uint8BufferAttribute(indexColors.send, 3);

                // this will map the buffer values to 0.0f - +1.0f in the shader
                colorAttribute.normalized = true;
                indexColorAttribute.normalized = true;

                bufferGeometry.setAttribute('position', positionAttribute);
                bufferGeometry.setAttribute('a_color', colorAttribute);
                bufferGeometry.setAttribute('a_index', indexAttribute);
                bufferGeometry.setAttribute('a_index_color', indexColorAttribute);

                const object3D = gcodeBufferGeometryToObj3d(
                    'WORKSPACE',
                    bufferGeometry,
                    renderMethod
                );
                // object3D.material.uniforms.u_visible_index_count.value = 20000;
                object3D.name = `${gcodeFilename}-${uuid()}`;

                // Add object3D to one of group
                if (isPreview) {
                    previewModelGroup.add(object3D);
                } else {
                    modelGroup.add(object3D);
                }
                object3D.position.copy(new Vector3());

                // calculate bounding box of G-code objects
                const objectBBox = ThreeUtils.computeBoundingBox(object3D);

                const newBoundingBox = new Box3();
                if (boundingBox) {
                    newBoundingBox.copy(boundingBox);
                }
                newBoundingBox.expandByPoint(objectBBox.min);
                newBoundingBox.expandByPoint(objectBBox.max);

                if (isPreview) {
                    dispatch(
                        baseActions.updateState({
                            previewBoundingBox: newBoundingBox,
                        })
                    );
                } else {
                    dispatch(
                        baseActions.updateState({
                            boundingBox: newBoundingBox,
                        })
                    );
                }

                if (isDone) {
                    if (isPreview) {
                        dispatch(
                            baseActions.updateState({
                                previewRenderState: 'rendered',
                                previewStage: WORKSPACE_STAGE.LOAD_GCODE_SUCCEED,
                                gcodeAxisWorkRange: axisWorkRange,
                            })
                        );
                    } else {
                        dispatch(
                            baseActions.updateState({
                                renderState: 'rendered',
                                stage: WORKSPACE_STAGE.LOAD_GCODE_SUCCEED,
                                gcodeAxisWorkRange: axisWorkRange,
                            })
                        );
                    }
                }

                dispatch(render());
                break;
            }
            case 'progress': {
                const state = getState().printing;
                if (value - state.progress > 0.01 || value > 1 - EPSILON) {
                    !isPreview
                        && dispatch(baseActions.updateState({ progress: value }));
                }
                break;
            }
            case 'err': {
                dispatch(
                    baseActions.updateState({
                        renderState: 'idle',
                        stage: WORKSPACE_STAGE.LOAD_GCODE_FAILED,
                        progress: 1,
                    })
                );
                break;
            }
            default:
                break;
        }
    };
};


const renderPreviewGcodeFile = (gcodeFile) => {
    return async (dispatch) => {
        // Fix me? why clearGcode?
        await dispatch(clearGcode(true));
        dispatch(
            baseActions.updateState({
                previewStage: WORKSPACE_STAGE.LOADING_GCODE,
                previewRenderState: 'rendering',
                progress: 0,
            })
        );
        workerManager.gcodeToArraybufferGeometry(
            {
                func: 'WORKSPACE',
                gcodeFilename: gcodeFile.uploadName,
                isPreview: true,
            },
            (data) => {
                dispatch(gcodeToArraybufferGeometryCallback(data));
            },
            // Fix me?
            () => {
                dispatch(baseActions.updateState({ gcodeFile: gcodeFile, boundingBox: gcodeFile.boundingBox }));
            }
        );
    };
};

const renderGcodeFile = (
    gcodeFile: GCodeFileMetadata,
    needToList = true,
    shouldRenderGcode = false
) => {
    return async (dispatch, getState) => {
        const { shouldAutoPreviewGcode } = getState().machine;
        const { headType, isRotate } = getState().workspace;

        if (needToList) {
            dispatch(addGCodeFile(gcodeFile));
        }

        if (shouldRenderGcode) {
            await dispatch(clearGcode());
            await dispatch(
                baseActions.updateState({
                    gcodeFile,
                    stage: WORKSPACE_STAGE.LOADING_GCODE,
                    renderState: 'rendering',
                    progress: 0,
                })
            );
            // TODO: used for serialport
            await dispatch(loadGcode(gcodeFile));
            logGcodeExport(headType, 'workspace', isRotate);

            workerManager.gcodeToArraybufferGeometry(
                {
                    func: 'WORKSPACE',
                    gcodeFilename: gcodeFile.uploadName
                },
                (data) => {
                    // Note this callback can be called multiple times.
                    dispatch(gcodeToArraybufferGeometryCallback(data));
                }
            );
        } else {
            if (shouldAutoPreviewGcode) {
                dispatch(renderPreviewGcodeFile(gcodeFile));
            }

            if (gcodeFile.boundingBox) {
                await dispatch(
                    baseActions.updateState({
                        boundingBox: new Box3(
                            new Vector3().copy(gcodeFile.boundingBox.min),
                            new Vector3().copy(gcodeFile.boundingBox.max),
                        ),
                    })
                );
            }
        }
    };
};

export default {
    uploadGcodeFile,
    addGCodeFile,

    // G-code render
    render,
    clearGcode,
    loadGcode,

    renderPreviewGcodeFile,
    renderGcodeFile,
};
