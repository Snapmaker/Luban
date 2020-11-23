import * as THREE from 'three';

import uuid from 'uuid';
import ToolPathModel from './ToolPathModel';
import { DATA_PREFIX } from '../constants';
import { ViewPathRenderer } from '../lib/renderer/ViewPathRenderer';
import { MATERIAL_UNSELECTED, MATERIAL_SELECTED } from '../lib/renderer/ToolPathRenderer';

class ToolPathModelGroup {
    constructor(modelGroup) {
        this.object = new THREE.Group();
        this.object.visible = false;
        this.object.isRotate = false;

        this.toolPathObjs = new THREE.Group();
        this.materialsObj = null;

        this.viewPathObjs = new THREE.Group();
        this.viewPathObjs.visible = false;

        this.object.add(this.toolPathObjs);
        this.object.add(this.viewPathObjs);

        this.toolPathModels = [];
        this.selectedToolPathModelArray = [];
        this.selectedToolPathModel = null;

        this._emptyState = {
            printOrder: 0,
            gcodeConfig: {}
        };
        this.modelGroup = modelGroup;
        this.modelGroup.on('add', (model) => {
            const toolPathModel = this.addModel(model);
            model.setRelatedModels({ toolPathModel });
        });
        this.modelGroup.on('select', (modelArray) => {
            if (modelArray.length !== 0) {
                this.selectToolPathModel(modelArray[0].modelID);
            }
        });

        this.viewPathObj = null;
    }

    getIsAllToolPath() {

    }

    getState(toolPathModel) {
        const { modelID, printOrder, gcodeConfig } = toolPathModel;
        return {
            modelID,
            printOrder,
            gcodeConfig
        };
    }

    removeSelectedToolPathModels() {
        for (const toolPathModel of this.selectedToolPathModelArray) {
            this.toolPathModels = this.toolPathModels.filter(d => d !== toolPathModel);
            this.object.remove(toolPathModel.toolPathObj3D);
            toolPathModel.id = '';
        }
        this.selectedToolPathModelArray = [];
        return this._emptyState;
    }

    removeSelectedToolPathModel() {
        const selected = this.selectedToolPathModel;
        if (selected) {
            this.selectedToolPathModel = null;
            this.toolPathModels = this.toolPathModels.filter(d => d !== selected);
            this.toolPathObjs.remove(selected.toolPathObj3D);
            selected.id = '';
            return this._emptyState;
        }
        return null;
    }

    removeAllModels() {
        this.selectedToolPathModel = null;
        this.selectedToolPathModelArray = [];
        for (const model of this.toolPathModels) {
            this.toolPathObjs.remove(model.toolPathObj3D);
        }
        this.toolPathModels = [];
    }

    // addToSelectToolPathModel(toolPathModels) {
    //     for (const toolPathModel of toolPathModels) {
    //         if (!this.selectedToolPathModel.include(toolPathModel)) {
    //             this.selectedToolPathModel
    //         }
    //     }
    // }

    selectToolPathModel(modelID) {
        this.selectedToolPathModel = this.getToolPathModel(modelID);
        // change toolPathObj3D's material
        this.toolPathModels.forEach((item) => {
            if (item.toolPathObj3D) {
                item.toolPathObj3D.material = MATERIAL_UNSELECTED;
            }
        });

        if (this.selectedToolPathModel) {
            if (this.selectedToolPathModel.toolPathObj3D) {
                this.selectedToolPathModel.toolPathObj3D.material = MATERIAL_SELECTED;
            }
            return this.getState(this.selectedToolPathModel);
        } else {
            this.selectedToolPathModel = null;
            return this._emptyState;
        }
    }

    updateSelectedMode(mode, gcodeConfig) {
        this.selectedToolPathModel.updateMode(mode, gcodeConfig);
        return this.getState(this.selectedToolPathModel);
    }

    /*
    generateToolPathModel(modelInfo) {
        const toolPathModel = new ToolPathModel(modelInfo);
        this.addToolPathModel(toolPathModel);
        this.selectedToolPathModel = toolPathModel;
        return this.getState(toolPathModel);
    }
    */

    addToolPathModel(toolPathModel) {
        if (toolPathModel) {
            this.toolPathModels.push(toolPathModel);

            this.selectedModel = toolPathModel;
        }
    }

    addModel(modelInfo) {
        const toolPathModel = new ToolPathModel(modelInfo);
        this.addToolPathModel(toolPathModel);
        this.selectedToolPathModel = toolPathModel;
        return toolPathModel;
    }

    previewToolPathModels() {
        return this.getToolPathModels().filter(v => v.toolPathFilename).length;
    }

    allNotHidedToolPathModelsArePreviewed() {
        for (const toolPathModel of this.toolPathModels) {
            if (toolPathModel.visible && !toolPathModel.isPreview) {
                return false;
            }
        }
        return true;
    }

    // unselectAllModels() {
    //     this.selectedToolPathModel = null;
    //     return this._emptyState;
    // }

    getToolPathModel(modelID) {
        return this.toolPathModels.find(d => d.modelID === modelID);
    }

    getToolPathModels() {
        const toolPathModels = [];
        for (const toolPathModel of this.toolPathModels) {
            toolPathModels.push(toolPathModel);
        }
        return toolPathModels;
    }

    getToolPathModelTaskInfo(modelID) {
        const toolPathModel = this.getToolPathModel(modelID);
        const id = uuid.v4();
        if (toolPathModel) {
            toolPathModel.id = id;
            return toolPathModel.getTaskInfo();
        }
        return null;
    }

    updateSelectedPrintOrder(printOrder) {
        this.selectedToolPathModel && (this.selectedToolPathModel.printOrder = printOrder);
    }

    updateSelectedGcodeConfig(gcodeConfig) {
        this.selectedToolPathModel.updateGcodeConfig(gcodeConfig);
    }

    // updateSelectedConfig(config) {
    //     this.selectedToolPathModel && (this.selectedToolPathModel.updateConfig(config));
    //     this.selectedToolPathModel && (this.selectedToolPathModel.updateNeedPreview(true));
    // }

    updateAllModelGcodeConfig(config) {
        for (const toolPathModel of this.toolPathModels) {
            toolPathModel.updateGcodeConfig(config);
        }
    }


    getToolPathModelByID(id) {
        return this.toolPathModels.find(d => d.id === id);
    }

    hideAllToolPathModels() {
        this.object.visible = false;
    }

    showAllToolPathModels() {
        this.object.visible = true;
    }

    showToolPathObjs() {
        this.toolPathObjs.visible = true;
        this.viewPathObjs.visible = false;
    }

    showViewPathObjs() {
        this.toolPathObjs.visible = false;
        this.viewPathObjs.visible = true;
    }

    async receiveTaskResult(data, filename) {
        const toolPathModel = this.toolPathModels.find(d => d.id === data.id);
        if (toolPathModel) {
            const isSelected = this.selectedToolPathModel && toolPathModel.modelID === this.selectedToolPathModel.modelID;
            toolPathModel.toolPathObj3D && this.toolPathObjs.remove(toolPathModel.toolPathObj3D);
            const toolPathObj3D = await toolPathModel.loadToolPath(filename, isSelected);
            if (!toolPathObj3D) {
                return null;
            }
            if (toolPathModel.id === data.id) {
                this.toolPathObjs.add(toolPathModel.toolPathObj3D);

                return this.getState(toolPathModel);
            }
        }
        return null;
    }

    receiveViewPathTaskResult(viewPathFile, size) {
        const toolPathFilePath = `${DATA_PREFIX}/${viewPathFile}`;
        return new Promise((resolve, reject) => {
            new THREE.FileLoader().load(
                toolPathFilePath,
                async (data) => {
                    this.viewPathObj && (this.viewPathObjs.remove(this.viewPathObj));

                    const viewPathObj = JSON.parse(data);
                    this.viewPathObj = await new ViewPathRenderer().render(viewPathObj, size);

                    this.viewPathObjs.add(this.viewPathObj);

                    this.showViewPathObjs();

                    resolve();
                },
                null,
                (err) => {
                    reject(err);
                }
            );
        });
    }

    duplicateSelectedModel(modelID) {
        const clone = this.selectedToolPathModel.clone();
        clone.modelID = modelID;
        this.toolPathModels.push(clone);
    }

    undoRedo(toolPathModels) {
        for (const toolPathModel of this.toolPathModels) {
            this.toolPathObjs.remove(toolPathModel.toolPathObj3D);
        }
        this.toolPathModels.splice(0);
        for (const toolPathModel of toolPathModels) {
            const newToolPathModel = toolPathModel.clone();
            this.toolPathModels.push(newToolPathModel);
        }
        return this._emptyState;
    }

    cloneToolPathModels() {
        return this.toolPathModels.map(d => d.clone());
    }

    hideSelectedModel() {
        const selectedToolPathModel = this.selectedToolPathModel;
        selectedToolPathModel.visible = false;
        selectedToolPathModel.toolPathObj3D && (selectedToolPathModel.toolPathObj3D.visible = false);
    }

    showSelectedModel() {
        const selectedToolPathModel = this.selectedToolPathModel;
        selectedToolPathModel.visible = true;
        selectedToolPathModel.toolPathObj3D && (selectedToolPathModel.toolPathObj3D.visible = true);
    }

    getSelectedModel() {
        if (this.selectedToolPathModel) {
            return this.selectedToolPathModel;
        }
        return this.MOCK_MODEL;
    }

    updateMaterials(materials) {
        this.materialsObj && this.toolPathObjs.remove(this.materialsObj);
        if (materials.isRotate) {
            const geometry = new THREE.CylinderGeometry(materials.diameter / 2 - 0.1, materials.diameter / 2 - 0.1, materials.length, 32);
            const texture = new THREE.TextureLoader().load('../../images/wood.png');
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
            this.materialsObj = mesh;
            this.toolPathObjs.add(mesh);
        }
    }
}

ToolPathModelGroup.prototype.MOCK_MODEL = {
    mock: true,
    sourceType: '',
    gcodeConfig: {
        optimizePath: true,
        fillEnabled: true,
        fillDensity: 0
    }
};
export default ToolPathModelGroup;
