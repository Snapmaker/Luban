import * as THREE from 'three';
import api from '../api';

class ModelGroup2D extends THREE.Object3D {
    constructor() {
        super();
        this.isModelGroup2D = true;
        this.type = 'ModelGroup2D';
        this.enabledAutoPreview = true;
        this.enablePolling();
    }
    autoFetchResults() {
        if (this.enabledAutoPreview) {
            api.fetchTaskResults()
                .then((res) => {
                    const result = res.body;
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
            model.allowAutoPreview = this.enabledAutoPreview;
            model.autoPreview();
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
    updateSelectedModelTransformation(transformation) {
        const model = this.getSelectedModel();
        if (model) {
            model.updateTransformation(transformation);
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

    // selected model: z -> 0.2
    // others: z -> 0.1
    bringSelectedModelToFront() {
        const selected = this.getSelectedModel();
        const models = this.getModels();
        if (selected && models.length > 1) {
            for (const m of models) {
                m.position.z = 0.1;
            }
            selected.position.z = 0.2;
        }
    }

    // selected model: z -> 0
    // others: z -> 0.1
    sendSelectedModelToBack() {
        const selected = this.getSelectedModel();
        const models = this.getModels();
        if (selected && models.length > 1) {
            for (const m of models) {
                m.position.z = 0.1;
            }
            selected.position.z = 0;
        }
    }

    toggleAutoPreview(value) {
        if (this.enabledAutoPreview !== value) {
            this.enabledAutoPreview = value;
            const models = this.getModels();
            for (let i = 0; i < models.length; i++) {
                models[i].allowAutoPreview = value;
                this.enabledAutoPreview && models[i].autoPreview();
            }
        }
    }
}

export default ModelGroup2D;
