import * as THREE from 'three';

class ModelGroup2D extends THREE.Object3D {
    constructor() {
        super();
        this.isModelGroup2D = true;
        this.type = 'ModelGroup2D';
        this.autoPreviewEnabled = true;
        this.candidatePoints = null;
        this.onSelectedModelTransformChanged = null;
    }

    addChangeListener(callback) {
    }

    addModel(model) {
        if (model && model.isModel2D === true) {
            model.position.x = 0;
            model.position.y = 0;
            this.add(model);
            model.autoPreviewEnabled = this.autoPreviewEnabled;
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

    // keep the origin order
    bringSelectedModelToFront() {
        const margin = 0.01;
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].position.z = (i + 1) * margin;
        }
        const selected = this.getSelectedModel();
        selected.position.z = (sorted.length + 2) * margin;
    }

    // keep the origin order
    sendSelectedModelToBack() {
        const margin = 0.01;
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].position.z = (i + 1) * margin;
        }
        const selected = this.getSelectedModel();
        selected.position.z = 0;
    }

    setAutoPreview(value) {
        if (this.autoPreviewEnabled !== value) {
            this.autoPreviewEnabled = value;
            const models = this.getModels();
            for (let i = 0; i < models.length; i++) {
                models[i].autoPreviewEnabled = value;
                this.autoPreviewEnabled && models[i].autoPreview();
            }
        }
    }

    getSortedModelsByPositionZ() {
        // bubble sort
        const sorted = this.getModels();
        const length = sorted.length;
        for (let i = 0; i < length; i++) {
            for (let j = 0; j < (length - i - 1); j++) {
                if (sorted[j].position.z > sorted[j + 1].position.z) {
                    const tmp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = tmp;
                }
            }
        }
        return sorted;
    }

    onSetPosition(position) {
        let posX = 0;
        let posY = 0;
        const selected = this.getSelectedModel();
        console.log(selected);
        const transformation = selected.modelInfo.transformation;
        const { width, height } = transformation;
        switch (position) {
            case 'Top Left':
                posX = -width / 2;
                posY = height / 2;
                break;
            case 'Top Middle':
                posX = 0;
                posY = height / 2;
                break;
            case 'Top Right':
                posX = width / 2;
                posY = height / 2;
                break;
            case 'Center Left':
                posX = -width / 2;
                posY = 0;
                break;
            case 'Center':
                posX = 0;
                posY = 0;
                break;
            case 'Center Right':
                posX = width / 2;
                posY = 0;
                break;
            case 'Bottom Left':
                posX = -width / 2;
                posY = -height / 2;
                break;
            case 'Bottom Middle':
                posX = 0;
                posY = -height / 2;
                break;
            case 'Bottom Right':
                posX = width / 2;
                posY = -height / 2;
                break;
            default:
                posX = 0;
                posY = 0;
        }
        transformation.translateX = posX;
        transformation.translateY = posY;
        transformation.rotation = 0;
        this.updateSelectedModelTransformation(transformation);
    }

    arrangeAllModels() {
        const generateCandidatePoints = (minX, minY, maxX, maxY, step) => {
            const computeDis = (point) => {
                return point.x * point.x + point.y * point.y;
            };

            const quickSort = (origArray) => {
                if (origArray.length <= 1) {
                    return origArray;
                } else {
                    const left = [];
                    const right = [];
                    const newArray = [];
                    const pivot = origArray.pop();
                    const length = origArray.length;
                    for (let i = 0; i < length; i++) {
                        if (computeDis(origArray[i]) <= computeDis(pivot)) {
                            left.push(origArray[i]);
                        } else {
                            right.push(origArray[i]);
                        }
                    }
                    return newArray.concat(quickSort(left), pivot, quickSort(right));
                }
            };

            const points = [];
            for (let i = 0; i <= (maxX - minX) / step; i++) {
                for (let j = 0; j <= (maxY - minY) / step; j++) {
                    points.push(
                        {
                            x: minX + step * i,
                            y: minY + step * j
                        }
                    );
                }
            }

            return quickSort(points);
        };

        const setSuitablePosition = (modelGroup, newModel, candidatePoints) => {
            if (modelGroup.children.length === 0) {
                newModel.position.x = 0;
                newModel.position.y = 0;
                return;
            }

            /**
             * check whether the model.bbox intersects the bbox of modelGroup.children
             */
            const intersect = (model, modelGroup) => {
                for (const m of modelGroup.children) {
                    if (model.boundingBox.intersectsBox(m.boundingBox)) {
                        return true;
                    }
                }
                return false;
            };

            for (const p of candidatePoints) {
                newModel.position.x = p.x;
                newModel.position.y = p.y;
                newModel.computeBoundingBox();
                if (!intersect(newModel, modelGroup)) {
                    return;
                }
            }
        };

        if (!this.candidatePoints) {
            // TODO: replace with real machine size
            this.candidatePoints = generateCandidatePoints(-200, -200, 200, 200, 5);
        }

        const models = this.getModels();
        for (const m of models) {
            m.computeBoundingBox();
        }
        this.remove(...models);
        for (const model of models) {
            setSuitablePosition(this, model, this.candidatePoints);
            this.add(model);
        }
        this.onSelectedModelTransformChanged && this.onSelectedModelTransformChanged();
    }
}

export default ModelGroup2D;
