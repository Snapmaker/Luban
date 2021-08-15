import uuid from 'uuid';
import { includes } from 'lodash';
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

    useLegacyEngine = false;

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

    materials;

    lastConfigJson = '';

    modelGroup;

    constructor(options) {
        const { id, name, baseName, headType, type, useLegacyEngine = false, modelIDs, gcodeConfig, toolParams = {}, materials = {}, modelGroup } = options;

        this.id = id || uuid.v4();
        this.name = name;
        this.baseName = baseName;
        this.headType = headType;
        this.type = type;
        this.status = IDLE;
        this.useLegacyEngine = useLegacyEngine;
        this.modelIDs = modelIDs.map(v => v);

        for (const modelID of this.modelIDs) {
            this.modelMap.set(modelID, {
                meshObj: null,
                status: IDLE,
                toolPathFile: null
            });
        }

        this.gcodeConfig = { ...gcodeConfig };
        this.toolParams = { ...toolParams };
        this.materials = { ...materials };
        this.modelGroup = modelGroup;

        this.checkoutToolPathStatus();
    }

    getState(filterInvisible = false) {
        let modelIDs = [];
        let toolPathFiles = [];
        if (filterInvisible) {
            const modelsInModelIDs = this.modelGroup.models.filter(model => {
                return this.modelIDs.includes(model.modelID) && model.visible === true;
            });
            if (modelsInModelIDs) {
                modelIDs = [...modelsInModelIDs.map(model => model.modelID)];
                toolPathFiles = [...modelIDs.map(v => this.modelMap.get(v).toolPathFile)];
            }
        } else {
            modelIDs = this.modelIDs.map(v => v);
            toolPathFiles = this._getToolPathFiles();
        }
        return {
            id: this.id,
            headType: this.headType,
            name: this.name,
            baseName: this.baseName,
            type: this.type,
            useLegacyEngine: this.useLegacyEngine,
            status: this.status,
            check: this.check,
            visible: this.visible,
            modelIDs,
            toolPathFiles,
            gcodeConfig: {
                ...this.gcodeConfig
            },
            toolParams: {
                ...this.toolParams
            },
            materials: {
                ...this.materials
            }
        };
    }

    updateStatus(status) {
        this.status = status;
    }

    setWarningStatus() {
        this.status = WARNING;
    }

    hasVisibleModels() {
        return this.getState(true).modelIDs.length > 0;
    }

    updateState(toolPath) {
        const {
            name = this.name, check = this.check, visible = this.visible, useLegacyEngine = this.useLegacyEngine, gcodeConfig = this.gcodeConfig,
            toolParams = this.toolParams, materials = this.materials, modelIDs = this.modelIDs
        } = toolPath;

        this.name = name;
        this.check = check;
        this.visible = visible;
        this.useLegacyEngine = useLegacyEngine;
        this.object.visible = visible;

        this.modelIDs = modelIDs;
        this.gcodeConfig = {
            ...gcodeConfig
        };
        this.toolParams = {
            ...toolParams
        };
        this.materials = {
            ...materials
        };

        this.checkoutToolPathStatus();
    }

    _getToolPathFiles() {
        return this.modelIDs.map(v => this.modelMap.get(v).toolPathFile);
    }

    _getModels() {
        const models = this.modelGroup.getModels();
        return models.filter(model => includes(this.modelIDs, model.modelID));
    }

    deleteModel(modelId) {
        this.modelIDs = this.modelIDs.filter(v => v !== modelId);
        const modelObj = this.modelMap.get(modelId);
        modelObj.meshObj && this.object.remove(modelObj.meshObj);
        this.modelMap.delete(modelId);
    }

    /**
     * Commit generate toolpath task to server
     */
    commitGenerateToolPath() {
        if (this.status === FAILED) {
            this.clearModelObjects();
            return false;
        }

        this.checkoutToolPathStatus();
        if (this.status === SUCCESS) {
            return false;
        }

        const taskInfos = this.getSelectModelsAndToolPathInfo();

        if (taskInfos.length !== this.modelIDs.length) {
            const newIds = taskInfos.map(v => v.modelID);
            const filterIds = this.modelIDs.filter(v => !newIds.includes(v)) || [];
            for (const filterId of filterIds) {
                this.deleteModel(filterId);
            }
        }

        const data = [];

        for (let i = 0; i < taskInfos.length; i++) {
            const taskInfo = taskInfos[i];
            if (taskInfo.visible) {
                data.push(taskInfo);
                this.modelMap.get(taskInfo.modelID).status = RUNNING;
            }
        }
        if (data.length === 0) { // if all the model in toolpath is invisible, do not generate toolpath
            return false;
        }

        const task = {
            taskId: this.id,
            modelId: '',
            headType: this.headType,
            data: data
        };

        controller.commitToolPathTask(task);

        this.checkoutStatus();
        return true;
    }

    _getModelTaskInfos() {
        const selectModels = this._getModels();
        const modelInfos = selectModels
            .map(v => v.getTaskInfo())
            .map(v => {
                return {
                    visible: v.visible,
                    modelID: v.modelID,
                    headType: v.headType,
                    sourceType: v.sourceType,
                    mode: v.mode,
                    sourceHeight: v.sourceHeight,
                    sourceWidth: v.sourceWidth,
                    originalName: v.originalName,
                    uploadName: v.uploadName,
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
                type: this.type,
                useLegacyEngine: this.useLegacyEngine,
                gcodeConfig: this.gcodeConfig,
                toolParams: this.toolParams,
                materials: this.materials
            };
        }

        return modelInfos;
    }

    /**
     * Listen generate toolpath result
     */
    onGenerateToolPath(result, cb) {
        return new Promise(async (resolve, reject) => {
            if (result.status === 'failed') {
                for (let i = 0; i < result.data.length; i++) {
                    const modelMapResult = this.modelMap.get(result.data[i].modelID);
                    modelMapResult && (modelMapResult.status = FAILED);
                }

                this.checkoutStatus();
                reject();
            } else {
                for (let i = 0; i < result.data.length; i++) {
                    const modelMapResult = this.modelMap.get(result.data[i].modelID);
                    if (modelMapResult) {
                        modelMapResult.status = SUCCESS;
                        modelMapResult.toolPathFile = result.filenames[i];
                        const toolPathObj3D = await this.loadToolPathFile(result.filenames[i]);
                        const oldMeshObj = modelMapResult.meshObj;

                        oldMeshObj && this.object.remove(oldMeshObj);
                        modelMapResult.meshObj = toolPathObj3D;
                        this.object.add(toolPathObj3D);
                    }
                }

                this.checkoutStatus();
                this.removeAllNonMeshObj();
                cb();
                resolve();
            }
        });
    }

    removeAllNonMeshObj() {
        const reObjs = [];
        for (const child of this.object.children) {
            let removed = true;
            for (const value of this.modelMap.values()) {
                if (value.meshObj === child) {
                    removed = false;
                }
            }
            if (removed) {
                reObjs.push(child);
            }
        }
        if (reObjs.length > 0) {
            console.warn('Toolpath has abnormal threejs object');
        }
        for (const reObj of reObjs) {
            this.object.remove(reObj);
        }
    }

    checkoutStatus() {
        const values = [];
        for (const visibleModelID of this.getState(true).modelIDs) {
            values.push(this.modelMap.get(visibleModelID));
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
        const lastConfigJson = JSON.stringify(taskInfos);

        if (this.lastConfigJson !== lastConfigJson) {
            this.status = WARNING;
            this.lastConfigJson = lastConfigJson;
        }

        if (taskInfos.length !== this.modelIDs.length) {
            this.status = WARNING;
        }

        if (!taskInfos || taskInfos.length === 0 || !taskInfos.find(v => v.visible)) {
            console.error('The models of tool path is empty');
            this.status = WARNING;
        }

        const types = getToolPathType(taskInfos);
        if (types.length !== 1 || types[0] !== this.type) {
            console.error('Inconsistent models types for tool path');
            this.status = FAILED;
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
