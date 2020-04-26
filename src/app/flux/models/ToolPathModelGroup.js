import { Group } from 'three';
import uuid from 'uuid';
import ToolPathModel from './ToolPathModel';

class ToolPathModelGroup {
    constructor() {
        this.object = new Group();
        this.object.visible = false;

        this.toolPathModels = [];
        this.selectedToolPathModel = null;

        this._emptyState = {
            printOrder: 0,
            gcodeConfig: {}
        };
    }

    getState(toolPathModel) {
        const { modelID, printOrder, gcodeConfig } = toolPathModel;
        return {
            modelID,
            printOrder,
            gcodeConfig
        };
    }

    removeSelectedToolPathModel() {
        const selected = this.selectedToolPathModel;
        if (selected) {
            this.selectedToolPathModel = null;
            this.toolPathModels = this.toolPathModels.filter(d => d !== selected);
            this.object.remove(selected.toolPathObj3D);
            selected.id = '';
            return this._emptyState;
        }
        return null;
    }

    selectToolPathModel(modelID) {
        this.selectedToolPathModel = this.getToolPathModel(modelID);
        return this.getState(this.selectedToolPathModel);
    }

    updateSelectedMode(mode, gcodeConfig) {
        this.selectedToolPathModel.updateMode(mode, gcodeConfig);
        return this.getState(this.selectedToolPathModel);
    }

    generateToolPathModel(modelInfo) {
        const toolPathModel = new ToolPathModel(modelInfo);
        this.addToolPathModel(toolPathModel);
        this.selectedToolPathModel = toolPathModel;
        return this.getState(toolPathModel);
    }

    addToolPathModel(toolPathModel) {
        if (toolPathModel) {
            this.toolPathModels.push(toolPathModel);

            this.selectedModel = toolPathModel;
        }
    }

    previewToolPathModels() {
        return this.getToolPathModels().filter(v => v.toolPathFilename).length;
    }

    unselectAllModels() {
        this.selectedToolPathModel = null;
        return this._emptyState;
    }

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

    updateSelectedNeedPreview(param) {
        this.selectedToolPathModel && this.selectedToolPathModel.updateNeedPreview(param);
    }

    updateAllNeedPreview(param) {
        for (const toolPathModel of this.getToolPathModels()) {
            toolPathModel.updateNeedPreview(param);
        }
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

    showAllToolPathModelsObj3D() {
        this.object.visible = true;
    }

    hideAllToolPathModelsObj3D() {
        this.object.visible = false;
    }

    getToolPathModelByID(id) {
        return this.toolPathModels.find(d => d.id === id);
    }

    async receiveTaskResult(data, filename) {
        const toolPathModel = this.toolPathModels.find(d => d.id === data.id);
        if (toolPathModel) {
            toolPathModel.toolPathObj3D && this.object.remove(toolPathModel.toolPathObj3D);
            const toolPathObj3D = await toolPathModel.loadToolPath(filename);
            if (!toolPathObj3D) {
                return null;
            }
            if (toolPathModel.id === data.id) {
                toolPathModel.updateNeedPreview(false);
                this.object.add(toolPathModel.toolPathObj3D);

                return this.getState(toolPathModel);
            }
        }
        return null;
    }

    multiplySelectedModel(modelID) {
        const clone = this.selectedToolPathModel.clone();
        clone.modelID = modelID;
        clone.updateNeedPreview(true);
        this.toolPathModels.push(clone);
    }

    undoRedo(toolPathModels) {
        for (const toolPathModel of this.toolPathModels) {
            this.object.remove(toolPathModel.toolPathObj3D);
            toolPathModel.updateNeedPreview(true);
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
}

export default ToolPathModelGroup;
