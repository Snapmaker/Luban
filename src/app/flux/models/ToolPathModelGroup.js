import { Group } from 'three';
import uuid from 'uuid';
import ToolPathModel from './ToolPathModel';

class ToolPathModelGroup {
    constructor() {
        this.object = new Group();

        this.toolPathModels = [];
        this.selectedToolPathModel = null;

        this._emptyState = {
            printOrder: 0,
            gcodeConfig: {},
            config: {}
        };
    }

    _getState(model) {
        const { modelID, config, gcodeConfig, printOrder } = model;
        return {
            modelID: modelID,
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
            selected.id = '';
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

    cancelSelectedPreview() {
        this.selectedToolPathModel && (this.selectedToolPathModel.id = '');
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
                this.object.add(toolPathModel.toolPathObj3D);
                return this._getState(toolPathModel);
            }
        }
        return null;
    }

    // generateGcode() {
    //     const toolPathModels = this.toolPathModels.map(d => d).sort((d1, d2) => {
    //         if (d1.printOrder > d2.printOrder) {
    //             return 1;
    //         } else if (d1.printOrder < d2.printOrder) {
    //             return -1;
    //         } else {
    //             return 1;
    //         }
    //     });
    //     return toolPathModels.map(model => {
    //         return {
    //             gcode: model.generateGcode(),
    //             modelInfo: {
    //                 modelID: model.modelID,
    //                 estimatedTime: model.estimatedTime,
    //                 config: model.config,
    //                 gcodeConfig: model.gcodeConfig
    //             }
    //         };
    //     });
    // }

    undoRedo(toolPathModels) {
        for (const toolPathModel of this.toolPathModels) {
            this.object.remove(toolPathModel.toolPathObj3D);
            toolPathModel.id = '';
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
