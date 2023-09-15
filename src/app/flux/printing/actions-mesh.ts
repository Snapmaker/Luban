import path from 'path';
import {
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Mesh,
    MeshPhongMaterial,
} from 'three';

import api from '../../api';
import { DATA_PREFIX } from '../../constants';
import { HEAD_PRINTING } from '../../constants/machines';
import { controller } from '../../communication/socket-communication';
import workerManager from '../../lib/manager/workerManager';
import ModelGroup from '../../models/ModelGroup';
import { ExtruderConfig, ModelTransformation, TSize } from '../../models/ThreeBaseModel';
import ThreeModel from '../../models/ThreeModel';
import ModelExporter from '../../ui/widgets/PrintingVisualizer/ModelExporter';

export declare interface MeshFileInfo {
    originalName: string; // file original name
    uploadName: string; // file upload name
    modelName?: string;

    isGroup: boolean;

    modelID?: string;
    parentUploadName?: string;
    children?: object[];
    baseName?: string;
}

interface UploadMeshOptions {
    fileType?: string;
    uploadName?: string;
}

/**
 * Upload Mesh object.
 */
const uploadMesh = async (mesh: Mesh, fileName: string, options?: UploadMeshOptions) => {
    const fileType = options?.fileType || 'stl';

    const formData = new FormData();

    // file
    const stl = new ModelExporter().parse(mesh, fileType, true);
    const blob = new Blob([stl], { type: 'text/plain' });
    const fileOfBlob = new File([blob], fileName);
    formData.append('file', fileOfBlob);

    // uploadName
    if (options?.uploadName) {
        formData.append('uploadName', options.uploadName);
    }

    const uploadResult = await api.uploadFile(formData, HEAD_PRINTING);
    return uploadResult;
};


/**
 * Check integrity of meshes.
 *
 * Note that this function is not an action actually.
 */
const checkMeshes = async (meshInfos: MeshFileInfo[]) => {
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
            controller.checkModel({
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

export const MeshHelper = {
    uploadMesh,
    checkMeshes,
};

/**
 * Synchronize mesh changes to file (Upload mesh).
 */
const synchronizeMeshFile = (model: ThreeModel) => {
    return async () => {
        // Upload mesh object with uploadName (unchanged)
        await MeshHelper.uploadMesh(
            model.meshObject,
            model.baseName,
            {
                uploadName: model.uploadName,
            }
        );

        return true;
    };
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

export type LoadMeshFileOptions = {
    headType: typeof HEAD_PRINTING;

    loadFrom: 0 | 1; // 0 or 1
    size?: TSize;
    mode?: string;

    sourceType: '3d',
    sourceWidth?: number;
    sourceHeight?: number;

    transformation?: ModelTransformation;

    parentModelID?: string;
    primeTowerTag?: boolean;
    extruderConfig?: ExtruderConfig;

    onProgress?: (progress: number) => void;
};

interface LoadMeshFilesResult {
    models: Array<ThreeModel>;
    promptTasks: Array<{
        status: string;
        originalName: string;
    }>;
}

export const loadMeshFiles = async (meshFileInfos: MeshFileInfo[], modelGroup: ModelGroup, options: LoadMeshFileOptions): Promise<LoadMeshFilesResult> => {
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

        onProgress && onProgress(_progress);

        if (meshFileInfo.isGroup) {
            return modelGroup.generateModel({
                loadFrom,
                limitSize: size,
                headType,
                sourceType,
                originalName: meshFileInfo.originalName,
                uploadName: meshFileInfo.uploadName,
                modelName: meshFileInfo.modelName,
                baseName: meshFileInfo.baseName,
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
        } else if (primeTowerTag) {
            if (modelGroup.primeTower) {
                modelGroup.primeTower.updateTowerTransformation(transformation);
            }
            return modelGroup.primeTower;
        } else {
            const uploadPath = `${DATA_PREFIX}/${meshFileInfo.uploadName}`;
            const newModel = await new Promise((resolve, reject) => {
                const onMessage = async (data) => {
                    const { type } = data;
                    switch (type) {
                        case 'LOAD_MODEL_POSITIONS': {
                            const { positions, originalPosition, byteCount } = data;
                            const bufferGeometry = new BufferGeometry();
                            const modelPositionAttribute = new BufferAttribute(positions, 3);
                            const material = new MeshPhongMaterial({
                                side: DoubleSide,
                                color: 0xa0a0a0,
                                specular: 0xb0b0b0,
                                shininess: 0
                            });

                            bufferGeometry.setAttribute('position', modelPositionAttribute);

                            if (byteCount) {
                                bufferGeometry.setAttribute('byte_count', new BufferAttribute(byteCount, 1));
                            }

                            bufferGeometry.computeVertexNormals();

                            try {
                                const model = await modelGroup.generateModel(
                                    {
                                        loadFrom,
                                        limitSize: size,
                                        headType,
                                        sourceType,
                                        originalName: meshFileInfo.originalName,
                                        uploadName: meshFileInfo.uploadName,
                                        modelName: meshFileInfo.modelName,
                                        baseName: meshFileInfo.baseName,
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

                                    onProgress && onProgress(_progress);
                                }
                                resolve(model);
                            } catch (e) {
                                console.log(e);
                                promptTasks.push({
                                    status: 'load-model-fail',
                                    originalName: meshFileInfo.originalName
                                });

                                // update progress
                                if (meshFileInfos.length > 1) {
                                    _progress += 1 / meshFileInfos.length;

                                    onProgress && onProgress(_progress);
                                }
                                reject(new Error('Failed to load mesh'));
                                // throw new Error('Failed to load mesh');
                            }
                            break;
                        }
                        case 'LOAD_MODEL_CONVEX': {
                            let { positions } = data;

                            const convexGeometry = new BufferGeometry();
                            const positionAttribute = new BufferAttribute(
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
                                onProgress && onProgress(progress);
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

                                onProgress && onProgress(_progress);
                            }
                            // reject();
                            // break;
                            reject(new Error(`Failed to load mesh: ${data.err}`));
                            break;
                        }
                        default:
                            break;
                    }
                };
                createLoadModelWorker(uploadPath, onMessage);
            });

            return newModel;
        }
    });

    const promiseResults = await Promise.allSettled(promises) as PromiseSettledResult<ThreeModel>[];
    const models = promiseResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<ThreeModel>).value);

    return {
        models,
        promptTasks,
    };
};

export {
    synchronizeMeshFile,
};

export default {
};
