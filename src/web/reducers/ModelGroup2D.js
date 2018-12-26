import * as THREE from 'three';


class ModelGroup2D extends THREE.Object3D {
    constructor() {
        super();
        this.isModelGroup2D = true;
        this.type = 'ModelGroup2D';

        this.changeCallbacks = [];

        this.state = {
            model: null, // selected model
            modelType: '',
            processMode: '',
            transformation: {},
            config: {},
            gcodeConfig: {}
        };
    }

    addChangeListener(callback) {
        if (this.changeCallbacks.indexOf(callback) === -1) {
            this.changeCallbacks.push(callback);
        }
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

            const modelInfo = model.getModelInfo();
            const { modelType, processMode, transformation, config, gcodeConfig } = modelInfo;
            const args = {
                model: model,
                modelType: modelType,
                processMode: processMode,
                transformation: transformation,
                config: config,
                gcodeConfig: gcodeConfig
            };
            this._invokeChangeCallbacks(args);
        }
    }

    unselectAllModels() {
        const selectedModel = this.getSelectedModel();
        selectedModel && selectedModel.setSelected(false);

        const args = {
            model: null,
            modelType: '',
            processMode: '',
            transformation: {},
            config: {},
            gcodeConfig: {}
        };
        this._invokeChangeCallbacks(args);
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
    transformSelectedModel(params) {
        const model = this.getSelectedModel();
        if (model) {
            model.updateTransformation(params);
            const modelInfo = model.getModelInfo();
            const { transformation } = modelInfo;
            const args = {
                transformation: transformation
            };
            this._invokeChangeCallbacks(args);
        }
    }

    updateSelectedModelConfig(params) {
        const model = this.getSelectedModel();
        if (model) {
            model.updateConfig(params);
            const modelInfo = model.getModelInfo();
            const { config } = modelInfo;
            const args = {
                config: config
            };
            this._invokeChangeCallbacks(args);
        }
    }

    updateSelectedModelGcodeConfig(params) {
        const model = this.getSelectedModel();
        if (model) {
            model.updateGcodeConfig(params);
            const modelInfo = model.getModelInfo();
            const { gcodeConfig } = modelInfo;
            const args = {
                gcodeConfig: gcodeConfig
            };
            this._invokeChangeCallbacks(args);
        }
    }

    resizeSelectedModel() {
        const model = this.getSelectedModel();
        if (model) {
            model.resize();
            const modelInfo = model.getModelInfo();
            const { transformation } = modelInfo;
            const args = {
                transformation: transformation
            };
            this._invokeChangeCallbacks(args);
        }
    }

    _invokeChangeCallbacks(args, isChanging = false) {
        this.state = {
            ...this.state,
            ...args
        };
        for (let i = 0; i < this.changeCallbacks.length; i++) {
            this.changeCallbacks[i](this.state, isChanging);
        }
    }

    previewSelectedModel() {
        const model = this.getSelectedModel();
        if (model) {
            model.preview(() => {
                const modelInfo = model.getModelInfo();
                const { transformation } = modelInfo;
                const args = {
                    transformation: transformation
                };
                this._invokeChangeCallbacks(args);
            });
        }
    }

    canGenerateGcode() {
        for (const model of this.getModels()) {
            if (model.stage !== 'previewed') {
                return false;
            }
        }
        return true;
    }

    removeSelectedModel() {
        const model = this.getSelectedModel();
        if (model) {
            this.remove(model);
            const args = {
                model: null,
                modelType: '',
                processMode: '',
                transformation: {},
                config: {},
                gcodeConfig: {}
            };
            this._invokeChangeCallbacks(args);
        }
    }
}

export default ModelGroup2D;
