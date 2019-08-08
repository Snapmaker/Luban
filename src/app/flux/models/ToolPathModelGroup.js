import { Group } from 'three';
import uuid from 'uuid';
import ToolPathModel from './ToolPathModel';

class ToolPathModelGroup {
    constructor() {
        this.object = new Group();

        this.toolPathModels = [];
        this.selectedToolPathModel = null;

        this._emptyState = {
            mode: '',
            printOrder: 0,
            gcodeConfig: {},
            config: {}
        };
    }

    _getState(model) {
        const { modelID, mode, config, gcodeConfig, printOrder } = model;
        return {
            modelID: modelID,
            mode,
            config,
            gcodeConfig,
            printOrder
        };
    }

    removeSelectedToolPathModel() {
        const selected = this.selectedToolPathModel;
        if (selected) {
            this.selectedToolPathModel = null;
            this.toolPathModels = this.toolPathModels.filter(d => d !== selected);
            this.object.remove(selected.toolPathObj3D);
            return this._emptyState;
        }
        return null;
    }

    getSelectedToolPathModelState() {
        return this._getState(this.selectedToolPathModel);
    }

    selectToolPathModel(modelID) {
        this.selectedToolPathModel = this.getToolPathModel(modelID);
        return this._getState(this.selectedToolPathModel);
    }

    generateToolPathModel(modelInfo) {
        const toolPathModel = new ToolPathModel(modelInfo);
        this.addToolPathModel(toolPathModel);
        this.selectedToolPathModel = toolPathModel;
        return this._getState(toolPathModel);
    }

    addToolPathModel(toolPathModel) {
        if (toolPathModel) {
            this.toolPathModels.push(toolPathModel);

            this.selectedModel = toolPathModel;
        }
    }

    unselectAllModels() {
        this.selectedToolPathModel = null;
        return this._emptyState;
    }

    getToolPathModel(modelID) {
        return this.toolPathModels.find(d => d.modelID === modelID);
    }

    getToolPathModelTaskInfo(modelID) {
        const toolPathModel = this.getToolPathModel(modelID);
        const taskID = uuid.v4();
        if (toolPathModel) {
            toolPathModel.taskID = taskID;
            return toolPathModel.getTaskInfo();
        }
        return null;
    }

    updateSelectedPrintOrder(printOrder) {
        this.selectedToolPathModel && (this.selectedToolPathModel.printOrder = printOrder);
    }

    updateSelectedGcodeConfig(gcodeConfig) {
        this.selectedToolPathModel && (this.selectedToolPathModel.updateGcodeConfig(gcodeConfig));
    }

    updateSelectedConfig(config) {
        this.selectedToolPathModel && (this.selectedToolPathModel.updateConfig(config));
    }

    updateAllModelConfig(config) {
        for (const toolPathModel of this.toolPathModels) {
            toolPathModel.updateConfig(config);
        }
    }

    hideAllModelsObj3D() {
        for (const toolPathModel of this.toolPathModels) {
            toolPathModel && toolPathModel.toolPathObj3D && (toolPathModel.toolPathObj3D.visible = false);
        }
    }

    showToolPathObj3D(modelID) {
        const toolPathModel = this.getToolPathModel(modelID);
        toolPathModel && toolPathModel.toolPathObj3D && (toolPathModel.toolPathObj3D.visible = true);
    }

    hideToolPathObj3D(modelID) {
        const toolPathModel = this.getToolPathModel(modelID);
        toolPathModel && toolPathModel.toolPathObj3D && (toolPathModel.toolPathObj3D.visible = false);
    }

    async receiveTaskResult(taskResult) {
        const toolPathModel = this.toolPathModels.find(d => d.taskID === taskResult.taskID);
        if (toolPathModel) {
            toolPathModel.toolPathObj3D && this.object.remove(toolPathModel.toolPathObj3D);
            const toolPathObj3D = await toolPathModel.loadToolPath(taskResult.filename);
            if (!toolPathObj3D) {
                return null;
            }
            console.log(this._getState(toolPathModel));
            this.object.add(toolPathModel.toolPathObj3D);
            return this._getState(toolPathModel);
        }
        return null;
    }
}

export default ToolPathModelGroup;
