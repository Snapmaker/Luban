import uuid from 'uuid';
import _ from 'lodash';
import * as THREE from 'three';
import { controller } from '../lib/controller';
import { DATA_PREFIX } from '../constants';
import { generateToolPathObject3D } from '../flux/generator';
import { FAILED, getToolPathType, IDLE, RUNNING, SUCCESS, WARNING } from './utils';

class ToolPath {
    id;

    name;

    baseName;

    type; // image, vector, image3d

    status = IDLE; // idle, running, success, warning, failed

    check = true;

    visible = true;

    // Threejs Obj
    object = new THREE.Group();

    modelIDs = [];

    // { modelID, meshObj, toolPathFile, status}
    modelMap = new Map();

    gcodeConfig;

    toolParams;

    lastConfigJson = '';

    modelGroup;

    constructor(options) {
        const { id, name, baseName, headType, type, modelIDs, gcodeConfig, toolParams = {}, modelGroup } = options;

        this.id = id || uuid.v4();
        this.name = name;
        this.baseName = baseName;
        this.headType = headType;
        this.type = type;
        this.status = IDLE;
        this.modelIDs = modelIDs.map(v => v);

        for (const modelID of this.modelIDs) {
            this.modelMap.set(modelID, { meshObj: null, status: IDLE, toolPathFile: null });
        }

        this.gcodeConfig = { ...gcodeConfig };
        this.toolParams = { ...toolParams };
        this.modelGroup = modelGroup;

        this.checkoutToolPathStatus();
    }

    getState() {
        return {
            id: this.id,
            headType: this.headType,
            name: this.name,
            baseName: this.baseName,
            type: this.type,
            status: this.status,
            check: this.check,
            visible: this.visible,
            modelIDs: this.modelIDs.map(v => v),
            toolPathFiles: this._getToolPathFiles(),
            gcodeConfig: {
                ...this.gcodeConfig
            },
            toolParams: {
                ...this.toolParams
            }
        };
    }

    updateStatus(status) {
        this.status = status;
    }

    updateState(toolPath) {
        const { name = this.name, check = this.check, visible = this.visible, gcodeConfig = this.gcodeConfig, toolParams = this.toolParams } = toolPath;

        this.name = name;
        this.check = check;
        this.visible = visible;
        this.object.visible = visible;

        this.gcodeConfig = {
            ...gcodeConfig
        };
        this.toolParams = {
            ...toolParams
        };

        this.checkoutToolPathStatus();
    }

    _getToolPathFiles() {
        return this.modelIDs.map(v => this.modelMap.get(v).toolPathFile);
    }

    _getModels() {
        const models = this.modelGroup.getModels();
        return models.filter(model => _.includes(this.modelIDs, model.modelID));
    }

    /**
     * Commit generate tool path task to server
     */
    commitGenerateToolPath(options) {
        if (this.status === FAILED) {
            this.clearModelObjects();
            return;
        }

        const { materials } = options;

        const taskInfos = this.getSelectModelsAndToolPathInfo();
        for (let i = 0; i < taskInfos.length; i++) {
            const taskInfo = taskInfos[i];

            taskInfo.materials = materials;

            const task = {
                taskId: this.id,
                modelId: taskInfo.modelID,
                headType: this.headType,
                data: taskInfo
            };

            controller.commitToolPathTask(task);

            this.modelMap.get(taskInfo.modelID).status = RUNNING;
        }
        this.checkoutStatus();
    }

    _getModelTaskInfos() {
        const selectModels = this._getModels();
        const modelInfos = selectModels
            .map(v => v.getTaskInfo())
            .map(v => {
                return {
                    modelID: v.modelID,
                    headType: v.headType,
                    sourceType: v.sourceType,
                    mode: v.mode,
                    sourceHeight: v.sourceHeight,
                    sourceWidth: v.sourceWidth,
                    originalName: v.originalName,
                    uploadName: v.uploadName,
                    processImageName: v.processImageName,
                    transformation: v.transformation,
                    config: v.config
                };
            });
        return modelInfos;
    }

    getSelectModelsAndToolPathInfo() {
        const modelInfos = this._getModelTaskInfos();

        for (let i = 0; i < modelInfos.length; i++) {
            modelInfos[i] = {
                ...modelInfos[i],
                gcodeConfig: this.gcodeConfig,
                toolParams: this.toolParams
            };
        }

        return modelInfos;
    }

    /**
     * Listen generate tool path result
     */
    onGenerateToolPath(result) {
        return new Promise((resolve, reject) => {
            const model = this.modelMap.get(result.data.modelID);

            if (model) {
                if (result.status === 'failed') {
                    model.status = FAILED;

                    this.checkoutStatus();
                    reject();
                } else {
                    model.status = SUCCESS;
                    model.toolPathFile = result.filename;
                    this.loadToolPathFile(result.filename).then((toolPathObj3D) => {
                        // Not remove the pointer but just replace the contents of the pointer
                        if (!model.meshObj) {
                            model.meshObj = toolPathObj3D;
                            this.object.add(model.meshObj);
                        } else {
                            model.meshObj.copy(toolPathObj3D);
                        }

                        this.checkoutStatus();
                        resolve();
                    });
                }
            }
        });
    }

    checkoutStatus() {
        const values = [];
        for (const value of this.modelMap.values()) {
            values.push(value);
        }
        if (values.find(v => v.status === RUNNING)) {
            this.status = RUNNING;
        }
        if (values.filter(v => v.status === SUCCESS).length === values.length) {
            this.status = SUCCESS;
        }
        if (values.find(v => v.status === FAILED)) {
            this.status = FAILED;
        }
    }

    checkoutToolPathStatus() {
        const taskInfos = this.getSelectModelsAndToolPathInfo();
        if (!taskInfos || taskInfos.length === 0) {
            console.error('The models of tool path is empty');
            this.status = FAILED;
        }

        const types = getToolPathType(taskInfos);
        if (types.length !== 1 || types[0] !== this.type) {
            console.error('Inconsistent models types for tool path');
            this.status = FAILED;
            return;
        }

        const lastConfigJson = JSON.stringify(taskInfos);

        if (this.lastConfigJson !== lastConfigJson) {
            this.status = WARNING;
            this.lastConfigJson = lastConfigJson;
        }
    }

    loadToolPathFile(filename) {
        const toolPathFilePath = `${DATA_PREFIX}/${filename}`;
        return new Promise((resolve) => {
            new THREE.FileLoader().load(
                toolPathFilePath,
                (data) => {
                    const toolPath = JSON.parse(data);
                    const toolPathObj3D = generateToolPathObject3D(toolPath);
                    return resolve(toolPathObj3D);
                }
            );
        });
    }

    removeToolPathObject() {
        for (const value of this.modelMap.values()) {
            value.meshObj && this.object.remove(value.meshObj);
            value.status = WARNING;
        }
    }

    clearModelObjects() {
        for (const value of this.modelMap.values()) {
            this.object.remove(value.meshObj);
            value.meshObj = null;
        }
    }
}

export default ToolPath;
