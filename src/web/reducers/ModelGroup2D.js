import * as THREE from 'three';
import api from '../api';

class ModelGroup2D extends THREE.Object3D {
    constructor() {
        super();
        this.isModelGroup2D = true;
        this.type = 'ModelGroup2D';
    }
    autoFetchResults() {
        api.fetchTaskResults()
            .then((res) => {
                let result = res.body;
                if (Array.isArray(result)) {
                    result.forEach(e => {
                        for (const child of this.children) {
                            if (child.modelInfo.taskId === e.taskId) {
                                child.loadToolpathObj(e.filename, e.taskId);
                            }
                        }
                    });
                }
            });
    }
    enablePolling() {
        const loopFunc = () => {
            this.autoFetchResults();
            setTimeout(loopFunc, 1000);
        };
        loopFunc();
    }

    addChangeListener(callback) {
    }

    addModel(model) {
        if (model && model.isModel2D === true) {
            model.position.x = 0;
            model.position.y = 0;
            this.add(model);
        }
    }

    getModels() {
        const models = [];
        for (const child of this.children) {
            if (child.isModel2D === true) {
                models.push(child);
            }
        }
        return models;
    }

    selectModel(model) {
        const lastSelectedModel = this.getSelectedModel();
        if (model && model.isModel2D === true && model !== lastSelectedModel) {
            lastSelectedModel && lastSelectedModel.setSelected(false);
            model.setSelected(true);
        }
    }

    unselectAllModels() {
        const selectedModel = this.getSelectedModel();
        selectedModel && selectedModel.setSelected(false);
    }

    getSelectedModel() {
        for (const model of this.getModels()) {
            if (model.isSelected()) {
                return model;
            }
        }
        return null;
    }

    // operate selected model
    updateSelectedModelTransformation(params) {
        const model = this.getSelectedModel();
        if (model) {
            model.updateTransformation(params);
        }
    }

    updateSelectedModelConfig(params) {
        const model = this.getSelectedModel();
        if (model) {
            model.updateConfig(params);
        }
    }

    updateSelectedModelGcodeConfig(params) {
        const model = this.getSelectedModel();
        if (model) {
            model.updateGcodeConfig(params);
        }
    }

    previewSelectedModel(callback) {
        const model = this.getSelectedModel();
        if (model) {
            model.preview(() => {
                callback();
            });
        }
    }

    removeSelectedModel() {
        const model = this.getSelectedModel();
        if (model) {
            this.remove(model);
        }
    }
}

const modelGroup2D = new ModelGroup2D();
modelGroup2D.enablePolling();

export default modelGroup2D;
