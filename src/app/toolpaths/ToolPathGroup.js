import * as THREE from 'three';
import ToolPath from './ToolPath';
import { createToolPathNameByType, getModelsByToolPathType, getToolPathType, SUCCESS } from './utils';
import { generateModelDefaultConfigs } from '../models/ModelInfoUtils';
import { DATA_PREFIX, HEAD_LASER } from '../constants';
import { ViewPathRenderer } from '../lib/renderer/ViewPathRenderer';
import { MATERIAL_UNSELECTED, MATERIAL_SELECTED } from '../lib/renderer/ToolPathRenderer';

class ToolPathGroup {
    toolPaths = [];

    selectedToolPathId = '';

    modelGroup;

    headType;

    updatedCallback;

    object = new THREE.Group();

    toolPathObjects = new THREE.Group();

    simulationObjects = new THREE.Group();

    simulationObject = null;

    materialsObject = null;

    constructor(modelGroup, headType) {
        this.modelGroup = modelGroup;
        this.headType = headType;

        this.object.add(this.toolPathObjects);
        this.object.add(this.simulationObjects);

        this.object.visible = false;
    }

    _updated() {
        this.updatedCallback && this.updatedCallback();
    }

    /**
     * Used to show toolpath group objects in process canvas after preview models
     */
    show() {
        this.object.visible = true;
    }

    get count() {
        return this.toolPaths.length + 1;
    }

    /**
     * Used to show model group objects in process canvas before preview models
     */
    hide() {
        this.object.visible = false;
        this.simulationObjects.visible = false;
    }

    showToolpathObjects(show) {
        this.toolPathObjects.visible = show;
    }

    showSimulationObject(show) {
        // Todo, control it in actions-process
        this.simulationObject && (this.simulationObjects.visible = show);
    }

    async onGenerateToolPath(taskResult) {
        const toolPath = this.toolPaths.find(v => v.id === taskResult.taskId);

        if (toolPath) {
            await toolPath.onGenerateToolPath(taskResult);
            this.addSelectedToolpathColor();
            this._updated();
        }
    }

    setUpdatedCallBack(updatedCallback) {
        this.updatedCallback = updatedCallback;
    }

    // Select
    selectToolPathById(toolPathId) {
        this.selectedToolPathId = toolPathId;
        this.addSelectedToolpathColor();
        this._updated();
    }

    // Unselect when selected id === toolPathId
    selectToolPathId(toolPathId) {
        if (this.selectedToolPathId === toolPathId) {
            this.selectedToolPathId = '';
        } else {
            this.selectedToolPathId = toolPathId;
        }
        this.addSelectedToolpathColor();
        this._updated();
    }

    getToolPathTypes() {
        // return getToolPathType(this.modelGroup.getSelectedToolPathModels());
        return getToolPathType(this.modelGroup.getSelectedModelArray());
    }

    _getToolPaths() {
        return this.toolPaths;
    }

    getToolPaths() {
        return this._getToolPaths().map(v => v.getState());
    }

    _getToolPath(toolPathId) {
        return this.toolPaths.find(v => v.id === toolPathId);
    }

    getToolPath(toolPathId) {
        const toolPath = this._getToolPath(toolPathId);
        return toolPath ? toolPath.getState() : null;
    }

    createToolPath(options) {
        const { materials } = options;

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
            baseName: models[0].uploadName,
            headType: this.headType,
            type,
            modelIDs: this.modelGroup.selectedModelIDArray,
            modelGroup: this.modelGroup,
            gcodeConfig,
            materials
        }).getState();
        return toolPathInfo;
    }

    fastCreateToolPath(options) {
        const models = this.modelGroup?.models;
        if (models.length === 0) {
            return null;
        }
        const modelObj = getModelsByToolPathType(models);
        const { materials, toolParams } = options;
        Object.entries(modelObj).forEach(([type, modelsWithSameType]) => {
            const toolPathModelIDs = modelsWithSameType.map((model) => model.modelID);
            const { gcodeConfig } = generateModelDefaultConfigs(this.headType, modelsWithSameType[0].sourceType, modelsWithSameType[0].mode, materials.isRotate);
            this._updated();
            const toolPathInfo = new ToolPath({
                name: createToolPathNameByType(this.count, type, this.headType),
                baseName: modelsWithSameType[0].uploadName,
                headType: this.headType,
                type,
                modelIDs: toolPathModelIDs,
                modelGroup: this.modelGroup,
                gcodeConfig,
                toolParams,
                materials
            }).getState();
            this.saveToolPath(toolPathInfo, options);
        });
        return null;
    }

    saveToolPath(toolPathInfo, options, shouldCommitGenerate = true) {
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
            this.selectedToolPathId = toolPath.id;
        }
        if (shouldCommitGenerate) {
            toolPath.commitGenerateToolPath();
        }
    }

    addSelectedToolpathColor() {
        const selectedToolpath = this._getToolPath(this.selectedToolPathId);
        let newIndex = -1;
        this.toolPathObjects.children.forEach((item, index) => {
            if (selectedToolpath && selectedToolpath.object === item) {
                newIndex = index;
                item.children.forEach((meshObj) => {
                    meshObj.material = MATERIAL_SELECTED;
                });
            } else {
                item.children.forEach((meshObj) => {
                    meshObj.material = MATERIAL_UNSELECTED;
                });
            }
        });
        if (selectedToolpath && newIndex !== this.toolPathObjects.children.length - 1) {
            // The cloned object must be used to force updating the scene
            this.toolPathObjects.remove(selectedToolpath.object);
            selectedToolpath.object = selectedToolpath.object.clone();
            this.toolPathObjects.add(selectedToolpath.object);
        }
    }

    toolPathToUp(toolPathId) {
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

    toolPathToDown(toolPathId) {
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

    deleteToolPath(toolPathId) {
        const toolPath = this._getToolPath(toolPathId);

        if (toolPath) {
            this.toolPaths = this.toolPaths.filter(v => v.id !== toolPathId);
            this.toolPathObjects.remove(toolPath.object);
        }

        if (this.selectedToolPathId === toolPathId) {
            this.selectedToolPathId = '';
        }

        this._updated();
    }

    deleteAllToolPaths() {
        const toolPaths = this._getToolPaths();
        toolPaths.forEach((item) => {
            if (item) {
                this.toolPathObjects.remove(item.object);
            }
        });
        this.toolPaths = [];
        this.selectedToolPathId = '';

        this._updated();
    }

    commitToolPath(toolPathId) {
        let res = false;
        const toolPath = this._getToolPath(toolPathId);
        if (toolPath) {
            res = toolPath.commitGenerateToolPath();
        }
        this._updated();
        return res;
    }

    updateToolPath(toolPathId, newState, options) {
        const toolPath = this._getToolPath(toolPathId);
        if (toolPath) {
            toolPath.updateState({ ...newState, ...options });
            toolPath.commitGenerateToolPath();
        }

        this._updated();
    }

    getThumbnailObject() {
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

    updateMaterials(materials) {
        for (const toolPath of this.toolPaths) {
            toolPath.updateState({ materials });
        }

        if (this.headType === HEAD_LASER) {
            this.updateLaserMaterialsBackground(materials);
        }
    }

    updateLaserMaterialsBackground(materials) {
        this.materialsObject && this.simulationObjects.remove(this.materialsObject);
        this.materialsObject = null;
        if (materials.isRotate) {
            const geometry = new THREE.CylinderGeometry(materials.diameter / 2 - 0.1, materials.diameter / 2 - 0.1, materials.length, 32);
            const texture = new THREE.TextureLoader().load('../resources/images/wood.png');
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

    _getCheckAndSuccessToolPaths() {
        if (this.toolPaths.length === 0) {
            return null;
        }
        const toolPaths = this.toolPaths.filter(v => v.check === true);
        if (toolPaths.find(v => v.status !== SUCCESS)) {
            return null;
        }
        if (!toolPaths.find(v => v.visible)) {
            return null;
        }
        return toolPaths;
    }

    canGenerateGcode() {
        const toolPaths = this._getCheckAndSuccessToolPaths();
        return toolPaths !== null;
    }

    getCommitGenerateGcodeInfos() {
        const toolPaths = this._getCheckAndSuccessToolPaths();
        if (!toolPaths) {
            return null;
        }
        return toolPaths.map(v => v.getState());
    }

    getCommitGenerateViewPathInfos(options) {
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

    onGenerateViewPath(viewPathFile, size) {
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

    checkoutToolPathStatus() {
        for (const toolPath of this.toolPaths) {
            toolPath.checkoutToolPathStatus();
        }
    }
}

export default ToolPathGroup;
