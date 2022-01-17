import { v4 as uuid } from 'uuid';
import { includes } from 'lodash';
import * as THREE from 'three';
import { controller } from '../lib/controller';
import { FAILED, getToolPathType, IDLE, RUNNING, SUCCESS, WARNING } from './utils';
import { MATERIAL_SELECTED, MATERIAL_UNSELECTED } from '../workers/ShaderMaterial/ToolpathRendererMeterial';

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

    visibleModelIDs = [];

    // { modelID, meshObj, toolPathFile, status}
    modelMap = new Map();

    gcodeConfig;

    toolParams;

    materials;

    lastConfigJson = '';

    modelGroup;

    constructor(options) {
        const { id, name, baseName, headType, type, useLegacyEngine = false, modelMode,
            visibleModelIDs, gcodeConfig, toolParams = {}, materials = {}, modelGroup } = options;

        this.id = id || uuid();
        this.name = name;
        this.baseName = baseName;
        this.headType = headType;
        this.modelMode = modelMode;
        this.type = type;
        this.status = IDLE;
        this.useLegacyEngine = useLegacyEngine;
        this.visibleModelIDs = visibleModelIDs.map(v => v);

        for (const modelID of this.visibleModelIDs) {
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

    getState() {
        this.visibleModelIDs = this.modelGroup.models.filter(model => {
            return this.modelMap.has(model.modelID) && model.visible === true;
        }).map(model => {
            return model.modelID;
        });

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
            deleteModel: this.deleteModel,
            modelMap: this.modelMap,
            modelMode: this.modelMode,
            // object: this.object,
            visibleModelIDs: this.visibleModelIDs,
            toolPathFiles: this.visibleModelIDs.map(v => this.modelMap.get(v)?.toolPathFile),
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
        return this.getState().visibleModelIDs.length > 0;
    }

    updateState(toolPath) {
        const {
            name = this.name, check = this.check, visible = this.visible, useLegacyEngine = this.useLegacyEngine, gcodeConfig = this.gcodeConfig,
            toolParams = this.toolParams, materials = this.materials, visibleModelIDs = this.visibleModelIDs
        } = toolPath;
        this.name = name;
        this.check = check;
        this.visible = visible;
        this.useLegacyEngine = useLegacyEngine;
        this.object.visible = visible;

        this.visibleModelIDs = visibleModelIDs;
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

    _getModels() {
        const models = this.modelGroup.getModels();
        return models.filter(model => {
            return includes(this.visibleModelIDs, model.modelID) && model.visible;
        });
    }

    deleteModel(modelId) {
        this.visibleModelIDs = this.visibleModelIDs.filter(v => v !== modelId);
        const modelObj = this.modelMap.get(modelId);
        modelObj.meshObj && this.object && this.object.remove(modelObj.meshObj);
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

        // if (taskInfos.length !== this.visibleModelIDs.length) {
        //     // const newIds = taskInfos.map(v => v.modelID);
        //     // const filterIds = this.visibleModelIDs.filter(v => !newIds.includes(v)) || [];
        //     // for (const filterId of filterIds) {
        //     //     this.deleteModel(filterId);
        //     // }
        // }

        const data = [];

        for (let i = 0; i < taskInfos.length; i++) {
            const taskInfo = taskInfos[i];
            if (taskInfo.visible && this.modelMap.get(taskInfo.modelID)) {
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
     * Handle listening failed
     * @param taskResult
     */
    onGenerateToolpathFailed(taskResult) {
        for (let i = 0; i < taskResult.data.length; i++) {
            const modelMapResult = this.modelMap.get(taskResult.data[i].modelID);
            modelMapResult && (modelMapResult.status = FAILED);
        }

        this.checkoutStatus();
    }

    onGenerateToolpathFinail() {
        this.checkoutStatus();
        this.removeAllNonMeshObj();
    }

    onGenerateToolpathModel(model, filename, renderResult) {
        const modelMapResult = this.modelMap.get(model.modelID);
        if (modelMapResult) {
            modelMapResult.status = SUCCESS;
            modelMapResult.toolPathFile = filename;

            const oldMeshObj = modelMapResult.meshObj;
            oldMeshObj && this.object.remove(oldMeshObj);

            const toolPathObj3D = this.renderToolpathObj(renderResult);

            modelMapResult.meshObj = toolPathObj3D;
            this.object.add(toolPathObj3D);
        }
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
        for (const visibleModelID of this.getState().visibleModelIDs) {
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

        if (taskInfos.length !== this.visibleModelIDs.length) {
            this.status = WARNING;
        }

        if (!taskInfos || taskInfos.length === 0) {
            console.error('The models of tool path is empty');
            this.status = FAILED;
        } else if (!taskInfos.find(v => v.visible)) {
            this.status = WARNING;
        }

        const types = getToolPathType(taskInfos);
        if (types.length !== 1 || types[0] !== this.type) {
            console.error('Inconsistent models types for tool path');
            this.status = FAILED;
        }
    }


    renderToolpathObj(renderResult) {
        const { headType, movementMode, isRotate, isSelected, positions, gCodes, positionX, positionY, rotationB } = renderResult;

        const bufferGeometry = new THREE.BufferGeometry();
        const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
        const gCodeAttribute = new THREE.Float32BufferAttribute(gCodes, 1);
        bufferGeometry.setAttribute('position', positionAttribute);
        bufferGeometry.setAttribute('a_g_code', gCodeAttribute);
        let material;
        if (isSelected) {
            material = MATERIAL_SELECTED;
        } else {
            material = MATERIAL_UNSELECTED;
        }

        let obj;
        if (headType === 'laser') {
            if (movementMode === 'greyscale-dot') {
                obj = new THREE.Points(bufferGeometry, material);
            } else {
                obj = new THREE.Line(bufferGeometry, material);
            }
        } else {
            obj = new THREE.Line(bufferGeometry, material);
        }
        obj.position.set(isRotate ? 0 : positionX, positionY, 0);
        if (rotationB) {
            obj.rotation.y = rotationB / 180 * Math.PI;
        }
        obj.scale.set(1, 1, 1);
        return obj;
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
