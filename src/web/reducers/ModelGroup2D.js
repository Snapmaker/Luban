import * as THREE from 'three';


class ModelGroup2D extends THREE.Object3D {
    constructor() {
        super();
        this.isModelGroup2D = true;
        this.type = 'ModelGroup2D';
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
        let selectedModel = null;
        for (const model of this.getModels()) {
            if (model.isSelected()) {
                selectedModel = model;
                return selectedModel;
            }
        }
        return selectedModel;
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

    resizeSelectedModel() {
        const model = this.getSelectedModel();
        if (model) {
            model.resize();
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

export default ModelGroup2D;
