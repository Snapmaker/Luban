import path from 'path';
import * as THREE from 'three';

import { DATA_PREFIX } from '../../constants';
import { HEAD_PRINTING } from '../../constants/machines';
import workerManager from '../../lib/manager/workerManager';
import { TSize, ModelTransformation, ExtruderConfig } from '../../models/ThreeBaseModel';
import { controller } from '../../lib/controller';
import { STEP_STAGE } from '../../lib/manager/ProgressManager';
import ModelGroup from '../../models/ModelGroup';


export declare interface MeshFileInfo {
    originalName: string; // file original name
    uploadName: string; // file upload name
    modelName: string;

    isGroup: boolean;

    modelID?: string;
    parentUploadName?: string;
    children?: object[];
}

/**
 * Check integrity of meshes.
 *
 * Note that this function is not an action actually.
 */
export const checkMeshes = async (meshInfos: MeshFileInfo[]) => {
    const checkResultMap = new Map();

    for (const meshInfo of meshInfos) {
        // Ignore group
        if (meshInfo.isGroup) {
            continue;
        }

        // Ignore other extensions
        const ext = path.extname(meshInfo.uploadName);
        if (!['.obj', '.stl'].includes(ext)) {
            continue;
        }

        // Ignore prime tower (it's virtual mesh)
        if (meshInfo.uploadName.indexOf('prime_tower_') === 0) {
            continue;
        }

        await new Promise((resolve) => {
            return controller.checkModel({
                uploadName: meshInfo.uploadName
            }, (data) => {
                if (data.type === 'error') {
                    checkResultMap.set(meshInfo.uploadName, {
                        isDamage: true,
                    });
                    resolve(true);
                } else if (data.type === 'success') {
                    checkResultMap.set(meshInfo.uploadName, {
                        isDamage: false,
                    });
                    resolve(true);
                }
            });
        });
    }

    return checkResultMap;
};

const createLoadModelWorker = (uploadPath, onMessage) => {
    const task = {
        worker: workerManager.loadModel(uploadPath, data => {
            for (const fn of task.cbOnMessage) {
                if (typeof fn === 'function') {
                    fn(data);
                }
            }
        }),
        cbOnMessage: []
    };

    task.cbOnMessage.push(onMessage);
};

type LoadMeshFileOptions = {
    onProgress?: (stage: number, progress: number) => void;

    headType: typeof HEAD_PRINTING;

    loadFrom: 0 | 1;
    size: TSize;
    mode?: string;

    sourceType?: '3d',
    sourceWidth?: number;
    sourceHeight?: number;

    transformation?: ModelTransformation;

    parentModelID?: string;
    primeTowerTag?: boolean;
    extruderConfig?: ExtruderConfig;
};

export const loadMeshFiles = async (meshFileInfos: MeshFileInfo[], modelGroup: ModelGroup, options: LoadMeshFileOptions) => {
    const {
        headType,

        loadFrom,
        size,
        mode,

        sourceType,
        sourceWidth,
        sourceHeight,

        transformation,

        extruderConfig,

        parentModelID,
        primeTowerTag,

        onProgress,
    } = options;
    let _progress = 0;
    const promptTasks = [];

    const promises = meshFileInfos.map(async (meshFileInfo) => {
        _progress = meshFileInfos.length === 1 ? 0.25 : 0.001;

        onProgress(STEP_STAGE.PRINTING_LOADING_MODEL, _progress);

        const uploadPath = `${DATA_PREFIX}/${meshFileInfo.uploadName}`;
        if (meshFileInfo.isGroup) {
            await modelGroup.generateModel({
                loadFrom,
                limitSize: size,
                headType,
                sourceType,
                originalName: meshFileInfo.originalName,
                uploadName: meshFileInfo.uploadName,
                modelName: meshFileInfo.modelName,
                mode: mode,
                sourceWidth,
                width: sourceWidth,
                sourceHeight,
                height: sourceHeight,
                geometry: null,
                material: null,
                transformation,
                modelID: meshFileInfo.modelID,
                extruderConfig,
                isGroup: meshFileInfo.isGroup,
                children: meshFileInfo.children,
            });
            return true;
        } else if (primeTowerTag) {
            if (modelGroup.primeTower) {
                modelGroup.primeTower.updateTowerTransformation(transformation);
            }
            return true;
        } else {
            return new Promise((resolve, reject) => {
                const onMessage = async (data) => {
                    const { type } = data;
                    switch (type) {
                        case 'LOAD_MODEL_POSITIONS': {
                            let { positions, originalPosition } = data;
                            const bufferGeometry = new THREE.BufferGeometry();
                            const modelPositionAttribute = new THREE.BufferAttribute(positions, 3);
                            const material = new THREE.MeshPhongMaterial({
                                side: THREE.DoubleSide,
                                color: 0xa0a0a0,
                                specular: 0xb0b0b0,
                                shininess: 0
                            });

                            bufferGeometry.setAttribute(
                                'position',
                                modelPositionAttribute
                            );

                            bufferGeometry.computeVertexNormals();

                            try {
                                await modelGroup.generateModel(
                                    {
                                        loadFrom,
                                        limitSize: size,
                                        headType,
                                        sourceType,
                                        originalName: meshFileInfo.originalName,
                                        uploadName: meshFileInfo.uploadName,
                                        modelName: meshFileInfo.modelName,
                                        mode: mode,
                                        sourceWidth,
                                        width: sourceWidth,
                                        sourceHeight,
                                        height: sourceHeight,
                                        geometry: bufferGeometry,
                                        material: material,
                                        transformation,
                                        originalPosition,
                                        modelID: meshFileInfo.modelID,
                                        extruderConfig,
                                        parentModelID,
                                        parentUploadName: meshFileInfo.parentUploadName
                                    }
                                );

                                // update progress
                                if (meshFileInfos.length > 1) {
                                    _progress += 1 / meshFileInfos.length;

                                    onProgress(
                                        STEP_STAGE.PRINTING_LOADING_MODEL,
                                        _progress,
                                    );
                                }
                                resolve(true);
                            } catch (e) {
                                promptTasks.push({
                                    status: 'load-model-fail',
                                    originalName: meshFileInfo.originalName
                                });

                                // update progress
                                if (meshFileInfos.length > 1) {
                                    _progress += 1 / meshFileInfos.length;

                                    onProgress(
                                        STEP_STAGE.PRINTING_LOADING_MODEL,
                                        _progress,
                                    );
                                }
                                reject(new Error('Failed to load mesh'));
                                // throw new Error('Failed to load mesh');
                            }
                            positions = null;
                            originalPosition = null;
                            break;
                        }
                        case 'LOAD_MODEL_CONVEX': {
                            let { positions } = data;

                            const convexGeometry = new THREE.BufferGeometry();
                            const positionAttribute = new THREE.BufferAttribute(
                                positions,
                                3
                            );
                            convexGeometry.setAttribute(
                                'position',
                                positionAttribute
                            );

                            modelGroup.setConvexGeometry(
                                meshFileInfo.uploadName,
                                convexGeometry
                            );
                            positions = null;
                            break;
                        }
                        case 'LOAD_MODEL_PROGRESS': {
                            if (meshFileInfos.length === 1) {
                                const progress = 0.25 + data.progress * 0.5;
                                onProgress(
                                    STEP_STAGE.PRINTING_LOADING_MODEL,
                                    progress,
                                );
                            }
                            break;
                        }
                        case 'LOAD_MODEL_FAILED': {
                            promptTasks.push({
                                status: 'load-model-fail',
                                originalName: meshFileInfo.originalName
                            });

                            if (meshFileInfos.length > 1) {
                                _progress += 1 / meshFileInfos.length;

                                onProgress(
                                    STEP_STAGE.PRINTING_LOADING_MODEL,
                                    _progress,
                                );
                            }
                            // reject();
                            // break;
                            reject(new Error('Failed to load mesh'));
                            break;
                        }
                        default:
                            break;
                    }
                };
                createLoadModelWorker(uploadPath, onMessage);
            });
        }
    });

    await Promise.allSettled(promises);

    return promptTasks;
};

export default {
};
