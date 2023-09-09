import * as THREE from 'three';
import { Box2, Box3 } from 'three';

import { DATA_PREFIX, DEFAULT_LUBAN_HOST, HEAD_LASER } from '../constants';
import { Origin } from '../constants/coordinate';
import { ViewPathRenderer } from '../lib/renderer/ViewPathRenderer';
import { generateModelDefaultConfigs } from '../models/ModelInfoUtils';
import ThreeModel from '../models/ThreeModel';
import ToolPath from './ToolPath';
import { SUCCESS, createToolPathNameByType, getModelsByToolPathType, getToolPathType } from './utils';

class ToolPathGroup {
    public toolPaths: ToolPath[] = [];

    public selectedToolPathArray = [];

    public modelGroup;

    public headType;

    private updatedCallback;

    public object = new THREE.Group();

    public toolPathObjects = new THREE.Group();

    public simulationObjects = new THREE.Group();

    public simulationObject = null;

    public materialsObject = null;

    public thumbnail = '';

    private origin: Origin;

    public constructor(modelGroup, headType) {
        this.modelGroup = modelGroup;
        this.headType = headType;

        this.object.add(this.toolPathObjects);
        this.object.add(this.simulationObjects);

        this.object.visible = false;
    }

    private _updated() {
        this.updatedCallback && this.updatedCallback();
    }

    /**
     * Used to show toolpath group objects in process canvas after preview models
     */
    public show() {
        this.object.visible = true;
    }

    public get count() {
        return this.toolPaths.length + 1;
    }

    public get isSingleSelected() {
        return this.toolPaths && this.selectedToolPathArray.length === 1;
    }

    public get firstSelectedToolpath() {
        return this.toolPaths && this.toolPaths.find(v => v.id === this.selectedToolPathArray[0]);
    }

    /**
     * Used to show model group objects in process canvas before preview models
     */
    public hide() {
        this.object.visible = false;
        this.simulationObjects.visible = false;
    }

    public showToolpathObjects(show: boolean, showWood: boolean): void {
        this.toolPathObjects.visible = show;
        showWood && (this.simulationObjects.visible = show);
    }

    public showSimulationObject(show) {
        // Todo, control it in actions-process
        this.simulationObject && (this.simulationObjects.visible = show);
        this.simulationObject && (this.simulationObject.visible = show);
    }

    public setUpdatedCallBack(updatedCallback) {
        this.updatedCallback = updatedCallback;
    }

    // Select
    public selectToolPathById(toolPathId = null) {
        if (!toolPathId) {
            this.selectedToolPathArray = [];
        } else {
            this.selectedToolPathArray = [toolPathId];
        }
        this.addSelectedToolpathColor();
        this._updated();
    }

    // Unselect when selected id === toolPathId
    public selectToolPathId(toolPathId) {
        if (this.selectedToolPathArray.includes(toolPathId)) {
            const newArray = [];
            this.selectedToolPathArray.forEach(
                (id) => {
                    if (id !== toolPathId) {
                        newArray.push(id);
                    }
                }
            );
            this.selectedToolPathArray = newArray;
        } else {
            this.selectedToolPathArray.push(toolPathId);
        }
        this.addSelectedToolpathColor();
        this._updated();
    }

    public selectOneToolPathId(toolPathId) {
        if (this.selectedToolPathArray.length > 1) {
            this.selectedToolPathArray = [toolPathId];
        } else {
            if (this.selectedToolPathArray.includes(toolPathId)) {
                this.selectedToolPathArray = [];
            } else {
                this.selectedToolPathArray = [toolPathId];
            }
        }
        this.addSelectedToolpathColor();
        this._updated();
    }

    public getToolPathTypes() {
        // return getToolPathType(this.modelGroup.getSelectedToolPathModels());
        return getToolPathType(this.modelGroup.getSelectedModelArray());
    }

    private _getToolPaths() {
        return this.toolPaths;
    }

    public getToolPaths() {
        return this._getToolPaths().map(v => v.getState());
    }

    private _getToolPath(toolPathId) {
        return this.toolPaths.find(v => v.id === toolPathId);
    }

    public getToolPath(toolPathId) {
        const toolPath = this._getToolPath(toolPathId);
        return toolPath ? toolPath.getState() : null;
    }

    public createToolPath(options) {
        const { materials, origin } = options;

        // const models = this.modelGroup.getSelectedToolPathModels();
        const models = this.modelGroup.getSelectedModelArray();

        if (models.length === 0) {
            return null;
        }

        const types = getToolPathType(models);

        if (types.length > 1) {
            return null;
        }

        const type = types[0];

        const { gcodeConfig } = generateModelDefaultConfigs(this.headType, models[0].sourceType, models[0].mode, materials.isRotate);

        this._updated();
        const toolPathInfo = new ToolPath({
            name: createToolPathNameByType(this.count, type, this.headType),
            baseName: models[0] instanceof ThreeModel ? models[0].uploadName : models[0].resource.originalFile.name,
            modelMode: models[0].mode,
            headType: this.headType,
            type,
            visibleModelIDs: this.modelGroup.selectedModelIDArray,
            modelGroup: this.modelGroup,
            gcodeConfig,
            materials,
            origin,
        }).getState();
        return toolPathInfo;
    }

    public fastCreateToolPath(options) {
        const models = this.modelGroup?.models;
        if (models.length === 0) {
            return null;
        }
        const modelObj = getModelsByToolPathType(models);
        const { materials, origin, toolParams } = options;
        Object.entries(modelObj).forEach(([type, modelsWithSameType]) => {
            const toolPathModelIDs = modelsWithSameType.map((model) => model.modelID);
            const { gcodeConfig } = generateModelDefaultConfigs(
                this.headType, modelsWithSameType[0].sourceType, modelsWithSameType[0].mode, materials.isRotate
            );
            this._updated();
            const toolPathInfo = new ToolPath({
                name: createToolPathNameByType(this.count, type, this.headType),
                baseName: modelsWithSameType[0] instanceof ThreeModel ? modelsWithSameType[0].uploadName : modelsWithSameType[0].resource.originalFile.name,
                headType: this.headType,
                type,
                visibleModelIDs: toolPathModelIDs,
                modelGroup: this.modelGroup,
                gcodeConfig,
                toolParams,
                materials,
                origin,
            }).getState();
            this.saveToolPath(toolPathInfo, options);
        });
        return null;
    }

    public saveToolPath(toolPathInfo, options, shouldCommitGenerate = true) {
        let toolPath = this._getToolPath(toolPathInfo.id);
        if (toolPath) {
            toolPath.updateState({ ...toolPathInfo, ...options });
        } else {
            toolPath = new ToolPath({
                ...toolPathInfo,
                ...options,
                modelGroup: this.modelGroup
            });
            this.toolPaths.push(toolPath);
            this.toolPathObjects.add(toolPath.object);
            this.selectToolPathById(toolPath.id);
        }
        if (shouldCommitGenerate) {
            toolPath.getGenerateToolPathTask();
        }
        return toolPath;
    }

    public addSelectedToolpathColor(withoutSelection = false) {
        // 2D SVGCanvas
        const { modelGroup } = this;
        modelGroup.models.forEach((model) => {
            model.updateIsToolPathSelect(false);
        });
        this.selectedToolPathArray.forEach((id) => {
            const selectedToolpath = this._getToolPath(id);
            if (selectedToolpath && selectedToolpath.visibleModelIDs) {
                for (const modelId of selectedToolpath?.visibleModelIDs) {
                    const model = modelGroup.getModel(modelId);
                    model && model.updateIsToolPathSelect(true);
                }
            }
        });

        // 3D SMCanvas
        this.toolPathObjects.children.forEach((item) => {
            item.children.forEach((meshObj) => {
                meshObj.material.uniforms.u_selected.value = false;
            });
        });
        this.selectedToolPathArray.forEach((id) => {
            const selectedToolpath = this._getToolPath(id);
            this.toolPathObjects.children.forEach((item) => {
                if (selectedToolpath && selectedToolpath.object.uuid === item.uuid) {
                    item.children.forEach((meshObj) => {
                        meshObj.material.uniforms.u_selected.value = true;
                    });
                }
            });
        });
        // The cloned object must be used to force updating the scene
        // The mesh object last add will show first in SMCanvas
        if (!withoutSelection) {
            this.selectedToolPathArray.forEach((id) => {
                const selectedToolpath = this._getToolPath(id);
                this.toolPathObjects.remove(selectedToolpath.object);
                selectedToolpath.object = selectedToolpath.object.clone();
                this.toolPathObjects.add(selectedToolpath.object);
            });
        }
    }

    public toolPathToUp(toolPathId) {
        let index = -1;
        for (let i = 0; i < this.toolPaths.length; i++) {
            if (toolPathId === this.toolPaths[i].id) {
                index = i;
                break;
            }
        }
        if (index <= 0) {
            return;
        }
        const toolPath = this.toolPaths[index];
        this.toolPaths[index] = this.toolPaths[index - 1];
        this.toolPaths[index - 1] = toolPath;

        this._updated();
    }

    public toolPathToDown(toolPathId) {
        let index = -1;
        for (let i = 0; i < this.toolPaths.length; i++) {
            if (toolPathId === this.toolPaths[i].id) {
                index = i;
                break;
            }
        }
        if (index === -1 || index === this.toolPaths.length - 1) {
            return;
        }
        const toolPath = this.toolPaths[index];
        this.toolPaths[index] = this.toolPaths[index + 1];
        this.toolPaths[index + 1] = toolPath;

        this._updated();
    }

    public toolPathToTop(toolPathId) {
        let index = -1;
        for (let i = 0; i < this.toolPaths.length; i++) {
            if (toolPathId === this.toolPaths[i].id) {
                index = i;
                break;
            }
        }
        if (index <= 0) {
            return;
        }
        const toolPath = this.toolPaths.splice(index, 1)[0];
        this.toolPaths.unshift(toolPath);

        this._updated();
    }

    public toolPathToBottom(toolPathId) {
        let index = -1;
        for (let i = 0; i < this.toolPaths.length; i++) {
            if (toolPathId === this.toolPaths[i].id) {
                index = i;
                break;
            }
        }
        if (index === -1 || index === this.toolPaths.length - 1) {
            return;
        }
        const toolPath = this.toolPaths.splice(index, 1)[0];
        this.toolPaths.push(toolPath);

        this._updated();
    }

    public deleteToolPath(toolPathId) {
        const toolPath = this._getToolPath(toolPathId);

        if (toolPath) {
            this.toolPaths = this.toolPaths.filter(v => v.id !== toolPathId);
            this.toolPathObjects.remove(toolPath.object);
        }

        this.selectToolPathById(null);

        this._updated();
    }

    public deleteAllToolPaths() {
        const toolPaths = this._getToolPaths();
        toolPaths.forEach((item) => {
            if (item) {
                this.toolPathObjects.remove(item.object);
            }
        });
        this.toolPaths = [];
        this.selectToolPathById(null);

        this._updated();
    }

    /**
     * get Bounding Box
     */
    public getBoundingBox() {
        const toolPaths = this.toolPaths.filter(toolpath => toolpath.visible);

        // compute bounding box of all visible tool paths
        const bbox = new Box3();
        for (const toolPath of toolPaths) {
            bbox.expandByObject(toolPath.object);
        }

        return bbox;
    }

    /**
     * Reference Box is the box tool paths resides in.
     *
     * Tool path use reference box & origin settings to calculate origin point.
     */
    public computeReferenceBox(): void {
        const toolPaths = this.toolPaths.filter(toolpath => toolpath.visible);

        // compute bounding box of all visible tool paths
        const bbox = new Box2();
        for (const toolPath of toolPaths) {
            const bbox2 = toolPath.getBoundingBox();

            bbox.expandByPoint(bbox2.min);
            bbox.expandByPoint(bbox2.max);
        }

        // set bbox as reference box of each tool path
        for (const toolPath of toolPaths) {
            toolPath.setReferenceBox(bbox);
        }
    }

    public getGenerateToolPathTask(toolPathId: string) {
        let task = null;
        const toolPath = this._getToolPath(toolPathId);
        if (toolPath) {
            task = toolPath.getGenerateToolPathTask();
        }
        this._updated();
        return task;
    }

    public async commitToolPathPromise(toolPathId) {
        return new Promise((resolve) => {
            let res = null;
            const toolPath = this._getToolPath(toolPathId);
            if (toolPath) {
                res = toolPath.getGenerateToolPathTask();
            }
            this._updated();
            resolve(res);
        });
    }

    public updateToolPath(toolPathId, newState, options) {
        const toolPath = this._getToolPath(toolPathId);
        if (toolPath) {
            toolPath.updateState({ ...newState, ...options });
            toolPath.setWarningStatus();
            // toolPath.commitGenerateToolPath();
        }

        this._updated();
        return toolPath;
    }

    public getThumbnailObject() {
        const toolPaths = this._getCheckAndSuccessToolPaths();

        const object = new THREE.Group();

        if (!toolPaths) {
            return object;
        }

        for (const toolPath of toolPaths) {
            object.add(toolPath.object.clone());
        }

        return object;
    }

    public updateThumbnail(thumbnail) {
        this.thumbnail = thumbnail;
    }

    public updateMaterials(materials) {
        for (const toolPath of this.toolPaths) {
            toolPath.updateState({ materials });
        }

        if (this.headType === HEAD_LASER) {
            this.updateLaserMaterialsBackground(materials);
        }
    }

    public setOrigin(origin: Origin): void {
        this.origin = origin;

        for (const toolPath of this.toolPaths) {
            toolPath.setOrigin(origin);
        }
    }

    public updateLaserMaterialsBackground(materials) {
        this.materialsObject && this.simulationObjects.remove(this.materialsObject);
        this.materialsObject = null;
        if (materials.isRotate) {
            const geometry = new THREE.CylinderGeometry(materials.diameter / 2 - 0.1, materials.diameter / 2 - 0.1, materials.length, 32);
            const texture = new THREE.TextureLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/wood.png`);
            const material = new THREE.MeshPhongMaterial(
                {
                    color: '#ffffff',
                    shininess: 0,
                    map: texture,
                    transparent: true,
                    opacity: 0.9,
                    blending: THREE.MultiplyBlending,
                    depthTest: false
                }
            );
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = materials.length / 2;

            this.materialsObject = mesh;
            this.simulationObjects.add(this.materialsObject);
        }
    }

    public _getCheckAndSuccessToolPaths() {
        if (this.toolPaths.length === 0) {
            return null;
        }
        const toolPaths = this.toolPaths.filter(v => v.visible === true && v.hasVisibleModels());
        if (toolPaths.find(v => v.status !== SUCCESS)) {
            return null;
        }
        return toolPaths;
    }

    public canGenerateGcode() {
        const toolPaths = this._getCheckAndSuccessToolPaths();
        return toolPaths !== null;
    }

    public getCommitGenerateGcodeInfos() {
        const toolPaths = this._getCheckAndSuccessToolPaths();
        if (!toolPaths) {
            return null;
        }
        return toolPaths.map(v => v.getState(true));
    }

    public getCommitGenerateViewPathInfos(options) {
        const { materials } = options;

        const infos = [];
        const modelIds = [];
        for (const toolPath of this.toolPaths) {
            if (toolPath.visible) {
                const taskInfos = toolPath.getSelectModelsAndToolPathInfo();

                for (const taskInfo of taskInfos) {
                    taskInfo.materials = materials;

                    if (!modelIds.includes(taskInfo.modelID)) {
                        infos.push(taskInfo);
                        modelIds.push(taskInfo.modelID);
                    }
                }
            }
        }

        return infos;
    }

    public async onGenerateViewPath(viewPathFile, size) {
        const toolPathFilePath = `${DATA_PREFIX}/${viewPathFile}`;
        return new Promise((resolve, reject) => {
            new THREE.FileLoader().load(
                toolPathFilePath,
                async (data) => {
                    this.simulationObject && (this.simulationObjects.remove(this.simulationObject));

                    const viewPathData = JSON.parse(data);
                    this.simulationObject = await new ViewPathRenderer().render(viewPathData, size);

                    this.simulationObjects.add(this.simulationObject);

                    this.simulationObjects.visible = true;

                    resolve();
                },
                null,
                (err) => {
                    reject(err);
                }
            );
        });
    }

    public checkoutToolPathStatus() {
        for (const toolPath of this.toolPaths) {
            toolPath.checkoutToolPathStatus();
        }
    }

    public checkHasVisibleToolPaths() {
        const toolPaths = this.getToolPaths();
        if (toolPaths.length === 0) {
            return false;
        }
        return toolPaths.every(
            (toolPath) => {
                if (toolPath.visible) {
                    return true;
                }
                return false;
            }
        );
    }

    public checkHasToolPathsWithFile() {
        const toolPaths = this.getToolPaths();
        if (toolPaths.length) {
            return toolPaths.every(
                (toolPath) => {
                    return toolPath.toolPathFiles.every(d => d);
                }
            );
        } else {
            return false;
        }
    }
}

export default ToolPathGroup;
