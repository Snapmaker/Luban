import { includes } from 'lodash';
import * as THREE from 'three';
import { v4 as uuid } from 'uuid';
import { Box2, Group } from 'three';

import { ObjectReference, Origin, OriginType, RectangleWorkpieceReference } from '../constants/coordinate';
import { MINIMUM_WIDTH_AND_HEIGHT } from '../constants';
import log from '../lib/log';
import ModelGroup from '../models/ModelGroup';
import {
    MATERIAL_SELECTED,
} from '../workers/ShaderMaterial/ToolpathRendererMeterial';
import {
    FAILED,
    getToolPathType,
    IDLE,
    RUNNING,
    SUCCESS,
    WARNING,
} from './utils';
import SvgModel from '../models/SvgModel';

interface GenerateToolPathTask {
    taskId: string;
    modelId: string;
    headType: 'laser' | 'cnc';
    visible: boolean;
    data: object;
}

class ToolPath {
    public id: string;

    public name: string;

    public baseName: string;

    public type; // image, vector, image3d

    public useLegacyEngine = false;

    public status = IDLE; // idle, running, success, warning, failed

    public check = true;

    public visible = true;

    // Threejs Obj
    public object = new Group();

    public visibleModelIDs = [];

    // { modelID, meshObj, toolPathFile, status}
    public modelMap = new Map();

    public gcodeConfig;

    public toolParams;

    public materials;
    private origin: Origin;
    private referenceBox: Box2;

    public lastConfigJson = '';

    public modelGroup: ModelGroup;

    public constructor(options) {
        const {
            id,
            name,
            baseName,
            headType,
            type,
            useLegacyEngine = false,
            modelMode,
            visibleModelIDs,
            modelIDs,
            gcodeConfig,
            toolParams = {},
            materials = {},
            origin = {
                type: OriginType.Workpiece,
                reference: RectangleWorkpieceReference.Center,
                referenceMetadata: {},
            },
            modelGroup,
        } = options;

        this.id = id || uuid();
        this.name = name;
        this.baseName = baseName;
        this.headType = headType;
        this.modelMode = modelMode;
        this.type = type;
        this.status = IDLE;
        this.useLegacyEngine = useLegacyEngine;
        this.visibleModelIDs = (visibleModelIDs || modelIDs).map((v) => v);

        for (const modelID of this.visibleModelIDs) {
            this.modelMap.set(modelID, {
                meshObj: null,
                status: IDLE,
                toolPathFile: null,
            });
        }

        this.gcodeConfig = { ...gcodeConfig };
        this.toolParams = { ...toolParams };
        this.modelGroup = modelGroup;

        this.materials = { ...materials };
        this.origin = { ...origin };

        this.checkoutToolPathStatus();
    }

    public getState() {
        this.visibleModelIDs = this.modelGroup.models
            .filter((model) => {
                return (
                    this.modelMap.has(model.modelID) && model.visible === true
                );
            })
            .map((model) => {
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
            toolPathFiles: this.visibleModelIDs.map(
                (v) => this.modelMap.get(v)?.toolPathFile
            ),
            gcodeConfig: {
                ...this.gcodeConfig,
            },
            toolParams: {
                ...this.toolParams,
            },
            materials: {
                ...this.materials,
            },
        };
    }

    public updateStatus(status) {
        this.status = status;
    }

    public setWarningStatus() {
        this.status = WARNING;
    }

    public hasVisibleModels() {
        return this.getState().visibleModelIDs.length > 0;
    }

    public updateState(toolPath) {
        const {
            name = this.name,
            check = this.check,
            visible = this.visible,
            useLegacyEngine = this.useLegacyEngine,
            gcodeConfig = this.gcodeConfig,
            toolParams = this.toolParams,
            materials = this.materials,
            visibleModelIDs = this.visibleModelIDs,
        } = toolPath;
        this.name = name;
        this.check = check;
        this.visible = visible;
        this.useLegacyEngine = useLegacyEngine;
        this.object.visible = visible;

        this.visibleModelIDs = visibleModelIDs;
        this.gcodeConfig = {
            ...gcodeConfig,
        };
        this.toolParams = {
            ...toolParams,
        };
        this.materials = {
            ...materials,
        };

        this.checkoutToolPathStatus();
    }

    public setOrigin(origin: Origin): void {
        this.origin = origin;

        this.checkoutToolPathStatus();
    }

    public setReferenceBox(box: Box2): void {
        this.referenceBox = box;

        this.checkoutToolPathStatus();
    }

    private _getModels(): SvgModel[] {
        const models = this.modelGroup.getModels<SvgModel>();
        return models.filter((model) => {
            return (
                includes(this.visibleModelIDs, model.modelID) && model.visible
            );
        });
    }

    public deleteModel(modelId) {
        this.visibleModelIDs = this.visibleModelIDs.filter(
            (v) => v !== modelId
        );
        const modelObj = this.modelMap.get(modelId);
        modelObj.meshObj && this.object && this.object.remove(modelObj.meshObj);
        this.modelMap.delete(modelId);
    }

    public getBoundingBox(): Box2 {
        const bbox = new Box2();

        const selectModels = this._getModels();

        for (const model of selectModels) {
            model.computeBoundingBox();

            bbox.expandByPoint(model.boundingBox.min);
            bbox.expandByPoint(model.boundingBox.max);
        }

        return bbox;
    }

    /**
     * Generate toolpath task to server, need to call `commitToolPathTaskArray`
     */
    public getGenerateToolPathTask(): GenerateToolPathTask | null {
        if (this.status === FAILED) {
            this.clearModelObjects();
            return null;
        }

        this.checkoutToolPathStatus();
        if (this.status === SUCCESS) {
            return null;
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
        if (data.length === 0) {
            // if all the model in toolpath is invisible, do not generate toolpath
            return null;
        }

        const task = {
            taskId: this.id,
            modelId: '',
            headType: this.headType,
            visible: this.visible,
            data: data
        };

        this.checkoutStatus();
        return task;
    }

    private _getModelTaskInfos() {
        const selectModels = this._getModels();

        const modelInfos = selectModels
            .map((model) => model.getTaskInfo())
            .map((info) => {
                if (!info.transformation.width) {
                    info.transformation.width = MINIMUM_WIDTH_AND_HEIGHT;
                }
                if (!info.transformation.height) {
                    info.transformation.height = MINIMUM_WIDTH_AND_HEIGHT;
                }
                return {
                    visible: info.visible,
                    modelID: info.modelID,
                    headType: info.headType,
                    sourceType: info.sourceType,
                    mode: info.mode,
                    sourceHeight: info.sourceHeight,
                    sourceWidth: info.sourceWidth,
                    originalName: info.originalName,
                    uploadName: info.uploadName,
                    transformation: info.transformation,
                    config: info.config,
                    processImageName: info.processImageName
                };
            });

        return modelInfos;
    }

    public getSelectModelsAndToolPathInfo() {
        const modelInfos = this._getModelTaskInfos();

        // Deal with origin, if origin type is object, we add offsets to the model transformation here
        if (this.referenceBox && this.origin.type === OriginType.Object) {
            const box = this.referenceBox;

            for (const modelInfo of modelInfos) {
                switch (this.origin.reference) {
                    case ObjectReference.Center: {
                        modelInfo.transformation.positionX -= (box.min.x + box.max.x) * 0.5;
                        modelInfo.transformation.positionY -= (box.min.y + box.max.y) * 0.5;
                        break;
                    }
                    case ObjectReference.BottomLeft: {
                        modelInfo.transformation.positionX -= box.min.x;
                        modelInfo.transformation.positionY -= box.min.y;
                        break;
                    }
                    case ObjectReference.BottomRight: {
                        modelInfo.transformation.positionX -= box.max.x;
                        modelInfo.transformation.positionY -= box.min.y;
                        break;
                    }
                    case ObjectReference.TopLeft: {
                        modelInfo.transformation.positionX -= box.min.x;
                        modelInfo.transformation.positionY -= box.max.y;
                        break;
                    }
                    case ObjectReference.TopRight: {
                        modelInfo.transformation.positionX -= box.max.x;
                        modelInfo.transformation.positionY -= box.max.y;
                        break;
                    }
                    default:
                        break;
                }
            }
        }

        // FIXME
        // diameter is required by LunarTPP, or it won't work properly
        this.materials.diameter = this.materials.diameter || 0;

        const taskInfos = [];
        for (let i = 0; i < modelInfos.length; i++) {
            const taskInfo = {
                ...modelInfos[i],
                type: this.type,
                useLegacyEngine: this.useLegacyEngine,
                gcodeConfig: this.gcodeConfig,
                toolParams: this.toolParams,
                materials: this.materials,
            };

            taskInfos.push(taskInfo);
        }

        return taskInfos;
    }

    /**
     * Handle listening failed
     * @param taskResult
     */
    public onGenerateToolpathFailed(taskResult) {
        for (let i = 0; i < taskResult.data.length; i++) {
            const modelMapResult = this.modelMap.get(
                taskResult.data[i].modelID
            );
            modelMapResult && (modelMapResult.status = FAILED);
        }

        this.checkoutStatus();
    }

    public onGenerateToolpathFinail() {
        this.checkoutStatus();
        this.removeAllNonMeshObj();
    }

    public onGenerateToolpathModel(model, filename, renderResult) {
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

    public removeAllNonMeshObj() {
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
            log.warn('Toolpath has abnormal threejs object');
        }
        for (const reObj of reObjs) {
            this.object.remove(reObj);
        }
    }

    public checkoutStatus() {
        const values = [];
        for (const visibleModelID of this.getState().visibleModelIDs) {
            values.push(this.modelMap.get(visibleModelID));
        }
        if (values.find((v) => v.status === RUNNING)) {
            this.status = RUNNING;
        }
        if (
            values.filter((v) => v.status === SUCCESS).length === values.length
        ) {
            this.status = SUCCESS;
        }
        if (values.find((v) => v.status === FAILED)) {
            this.status = FAILED;
        }
    }

    public checkoutToolPathStatus() {
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
        } else if (!taskInfos.find((v) => v.visible)) {
            this.status = WARNING;
        }

        const types = getToolPathType(taskInfos);
        if (types.length !== 1 || types[0] !== this.type) {
            console.error('Inconsistent models types for tool path');
            this.status = FAILED;
        }
    }

    public renderToolpathObj(renderResult) {
        const {
            headType,
            movementMode,
            isRotate,
            isSelected,
            positions,
            gCodes,
            colors,
            positionX,
            positionY,
            rotationB,
        } = renderResult;

        const bufferGeometry = new THREE.BufferGeometry();
        const positionAttribute = new THREE.Float32BufferAttribute(
            positions.send,
            3
        );
        const gCodeAttribute = new THREE.Float32BufferAttribute(gCodes.send, 1);
        const colorsAttribute = new THREE.Uint8BufferAttribute(colors.send, 3);
        colorsAttribute.normalized = true;
        bufferGeometry.setAttribute('position', positionAttribute);
        bufferGeometry.setAttribute('a_g_code', gCodeAttribute);
        bufferGeometry.setAttribute('a_color', colorsAttribute);

        let obj;
        if (headType === 'laser') {
            if (movementMode === 'greyscale-dot') {
                obj = new THREE.Points(bufferGeometry, MATERIAL_SELECTED);
            } else {
                obj = new THREE.Line(bufferGeometry, MATERIAL_SELECTED);
            }
        } else {
            obj = new THREE.Line(bufferGeometry, MATERIAL_SELECTED);
        }
        if (isSelected) {
            obj.material.uniforms.u_selected.value = true;
        } else {
            obj.material.uniforms.u_selected.value = false;
        }
        obj.position.set(isRotate ? 0 : positionX, positionY, 0);
        if (rotationB) {
            obj.rotation.y = (rotationB / 180) * Math.PI;
        }
        obj.scale.set(1, 1, 1);
        return obj;
    }

    public removeToolPathObject() {
        for (const value of this.modelMap.values()) {
            value.meshObj && this.object.remove(value.meshObj);
            value.status = WARNING;
        }
    }

    public clearModelObjects() {
        for (const value of this.modelMap.values()) {
            this.object.remove(value.meshObj);
            value.meshObj = null;
        }
    }
}

export default ToolPath;
