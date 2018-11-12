import * as THREE from 'three';

const NO_MODEL = 'no_model';

class ModelGroup extends THREE.Object3D {
    constructor(bbox) {
        super();
        this.isModelGroup = true;
        this.type = 'ModelGroup';
        this._undoes = [];
        this._redoes = [];
        // record empty state
        this._undoes.push(NO_MODEL);
        this._bbox = bbox;

        this.changeCallbacks = [];

        this.state = {
            canUndo: false,
            canRedo: false,
            hasModel: false,
            isAnyModelOverstepped: false,
            modelsBBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()),
            selected: {
                model: null,
                position: new THREE.Vector3(),
                scale: new THREE.Vector3(),
                rotation: new THREE.Vector3()
            }
        };
    }

    addChangeListener(callback) {
        this.changeCallbacks.push(callback);
    }

    addModel(model) {
        if (model && model.isModel === true) {
            model.alignWithParent();
            model.position.x = 0;
            model.position.z = 0;
            const xz = this._computeAvailableXZ(model);
            model.position.x = xz.x;
            model.position.z = xz.z;
            this.add(model);
            this._recordModelsState();

            const args = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkModelsOverstepped(),
                modelsBBox: this._computeModelsBBox()
            };
            this._invokeChangeCallbacks(args);
        }
    }

    removeSelectedModel() {
        const selectedModel = this.getSelectedModel();
        if (selectedModel) {
            selectedModel.setSelected(false);
            this.remove(selectedModel);
            this._recordModelsState();

            const args = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkModelsOverstepped(),
                modelsBBox: this._computeModelsBBox(),
                selected: {
                    model: null,
                    position: new THREE.Vector3(),
                    scale: new THREE.Vector3(),
                    rotation: new THREE.Vector3()
                }
            };
            this._invokeChangeCallbacks(args);
        }
    }

    removeAllModels() {
        const selectedModel = this.getSelectedModel();
        if (selectedModel) {
            selectedModel.setSelected(false);
        }
        if (this._hasModel()) {
            this.remove(...this.getModels());
            this._recordModelsState();

            const args = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkModelsOverstepped(),
                modelsBBox: this._computeModelsBBox(),
                selected: {
                    model: null,
                    position: new THREE.Vector3(),
                    scale: new THREE.Vector3(),
                    rotation: new THREE.Vector3()
                }
            };
            this._invokeChangeCallbacks(args);
        }
    }

    undo() {
        if (!this._canUndo()) {
            return;
        }
        this._redoes.push(this._undoes.pop());

        const modelGroupState = this._undoes[this._undoes.length - 1];
        if (modelGroupState === NO_MODEL) {
            this.remove(...this.getModels());
            const args = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkModelsOverstepped(),
                modelsBBox: this._computeModelsBBox(),
                selected: {
                    model: null,
                    position: new THREE.Vector3(),
                    scale: new THREE.Vector3(),
                    rotation: new THREE.Vector3()
                }
            };
            this._invokeChangeCallbacks(args);
            return;
        }

        // remove all then add back
        this.remove(...this.getModels());
        for (const childState of modelGroupState) {
            const model = childState.model;
            const matrix = childState.matrix;
            model.setMatrix(matrix);
            this.add(childState.model);
        }

        const selectedModel = this.getSelectedModel();
        const args = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkModelsOverstepped(),
            modelsBBox: this._computeModelsBBox(),
            selected: {
                model: selectedModel,
                position: selectedModel ? selectedModel.position : new THREE.Vector3(),
                scale: selectedModel ? selectedModel.scale : new THREE.Vector3(),
                rotation: selectedModel ? selectedModel.rotation : new THREE.Vector3()
            }
        };
        this._invokeChangeCallbacks(args);
    }

    redo() {
        if (!this._canRedo()) {
            return;
        }
        this._undoes.push(this._redoes.pop());
        const modelGroupState = this._undoes[this._undoes.length - 1];

        // remove all then add back
        this.remove(...this.getModels());
        for (const childState of modelGroupState) {
            const model = childState.model;
            model.setMatrix(childState.matrix);
            this.add(model);
        }

        const selectedModel = this.getSelectedModel();
        const args = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkModelsOverstepped(),
            modelsBBox: this._computeModelsBBox(),
            selected: {
                model: selectedModel,
                position: selectedModel ? selectedModel.position : new THREE.Vector3(),
                scale: selectedModel ? selectedModel.scale : new THREE.Vector3(),
                rotation: selectedModel ? selectedModel.rotation : new THREE.Vector3()
            }
        };
        this._invokeChangeCallbacks(args);
    }

    getModels() {
        const models = [];
        for (const child of this.children) {
            if (child.isModel === true) {
                models.push(child);
            }
        }
        return models;
    }

    selectModel(model) {
        const lastSelectedModel = this.getSelectedModel();
        if (model && model.isModel === true && model !== lastSelectedModel) {
            lastSelectedModel && lastSelectedModel.setSelected(false);
            model.setSelected(true);

            const args = {
                selected: {
                    model: model,
                    position: model.position,
                    scale: model.scale,
                    rotation: model.rotation
                }
            };
            this._invokeChangeCallbacks(args);
        }
    }

    unselectAllModels() {
        const selectedModel = this.getSelectedModel();
        selectedModel && selectedModel.setSelected(false);

        const args = {
            selected: {
                model: null,
                position: new THREE.Vector3(),
                scale: new THREE.Vector3(),
                rotation: new THREE.Vector3()
            }
        };
        this._invokeChangeCallbacks(args);
    }

    arrangeAllModels() {
        const models = this.getModels();
        this.remove(...models);

        for (const model of models) {
            model.alignWithParent();
            model.position.x = 0;
            model.position.z = 0;
            const xz = this._computeAvailableXZ(model);
            model.position.x = xz.x;
            model.position.z = xz.z;
            this.add(model);
        }
        this._recordModelsState();

        const selectedModel = this.getSelectedModel();
        const args = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkModelsOverstepped(),
            modelsBBox: this._computeModelsBBox(),
            selected: {
                model: selectedModel,
                position: selectedModel ? selectedModel.position : new THREE.Vector3(),
                scale: selectedModel ? selectedModel.scale : new THREE.Vector3(),
                rotation: selectedModel ? selectedModel.rotation : new THREE.Vector3()
            }
        };
        this._invokeChangeCallbacks(args);
    }

    multiplySelectedModel(count) {
        const selectedModel = this.getSelectedModel();
        if (selectedModel && count > 0) {
            for (let i = 0; i < count; i++) {
                const model = this.getSelectedModel().clone();
                model.alignWithParent();
                model.position.x = 0;
                model.position.z = 0;
                const xz = this._computeAvailableXZ(model);
                model.position.x = xz.x;
                model.position.z = xz.z;
                this.add(model);
            }
            this._recordModelsState();

            const args = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkModelsOverstepped(),
                modelsBBox: this._computeModelsBBox()
            };
            this._invokeChangeCallbacks(args);
        }
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

    // reset scale and rotation
    resetSelectedModelTransformation() {
        const selectedModel = this.getSelectedModel();
        if (selectedModel) {
            selectedModel.scale.copy(new THREE.Vector3(1, 1, 1));
            selectedModel.setRotationFromEuler(new THREE.Euler(0, 0, 0, 'XYZ'));
            selectedModel.alignWithParent();
            this._recordModelsState();

            const args = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkModelsOverstepped(),
                modelsBBox: this._computeModelsBBox(),
                selected: {
                    model: selectedModel,
                    position: selectedModel.position,
                    scale: selectedModel.scale,
                    rotation: selectedModel.rotation
                }
            };
            this._invokeChangeCallbacks(args);
        }
    }

    transformSelectedModel(transformations, isAfter) {
        const selectedModel = this.getSelectedModel();
        if (!selectedModel) {
            return;
        }
        const { posX, posY, posZ, scale, rotateX, rotateY, rotateZ } = transformations;
        (posX !== undefined) && (selectedModel.position.x = posX);
        (posY !== undefined) && (selectedModel.position.y = posY);
        (posZ !== undefined) && (selectedModel.position.z = posZ);

        (scale !== undefined) && (selectedModel.scale.copy(scale));

        (rotateX !== undefined) && (selectedModel.rotation.x = rotateX);
        (rotateY !== undefined) && (selectedModel.rotation.y = rotateY);
        (rotateZ !== undefined) && (selectedModel.rotation.z = rotateZ);

        let args = null;
        if (isAfter) {
            selectedModel.alignWithParent();
            this._recordModelsState();
            args = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                isAnyModelOverstepped: this._checkModelsOverstepped(),
                modelsBBox: this._computeModelsBBox(),
                selected: {
                    model: selectedModel,
                    position: selectedModel.position,
                    scale: selectedModel.scale,
                    rotation: selectedModel.rotation
                }
            };
            this._invokeChangeCallbacks(args);
        } else {
            args = {
                selected: {
                    model: selectedModel,
                    position: selectedModel.position,
                    scale: selectedModel.scale,
                    rotation: selectedModel.rotation
                }
            };
            this._invokeChangeCallbacks(args, true);
        }
    }

    onModelTransform() {
        const selectedModel = this.getSelectedModel();
        if (selectedModel) {
            const args = {
                selected: {
                    model: selectedModel,
                    position: selectedModel.position,
                    scale: selectedModel.scale,
                    rotation: selectedModel.rotation
                }
            };
            this._invokeChangeCallbacks(args, true);
        }
    }

    onModelAfterTransform() {
        const selectedModel = this.getSelectedModel();
        if (!selectedModel) {
            return;
        }
        selectedModel.alignWithParent();
        this._recordModelsState();
        if (selectedModel) {
            const args = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                isAnyModelOverstepped: this._checkModelsOverstepped(),
                modelsBBox: this._computeModelsBBox(),
                selected: {
                    model: selectedModel,
                    position: selectedModel.position,
                    scale: selectedModel.scale,
                    rotation: selectedModel.rotation
                }
            };
            this._invokeChangeCallbacks(args);
        }
    }

    _canUndo() {
        return this._undoes.length > 1;
    }

    _canRedo() {
        return this._redoes.length > 0;
    }

    _recordModelsState() {
        const modelGroupState = [];
        for (const model of this.getModels()) {
            model.updateMatrix();
            const modelState = {
                model: model,
                matrix: model.matrix.clone()
            };
            modelGroupState.push(modelState);
        }
        const lastModelGroupState = this._undoes[this._undoes.length - 1];
        // do not push if modelGroupState is same with last
        if (!this._compareModelGroupState(lastModelGroupState, modelGroupState)) {
            this._undoes.push(modelGroupState);
            this._redoes = [];
        }
    }

    _compareModelGroupState(modelGroupState1, modelGroupState2) {
        if (modelGroupState1.length !== modelGroupState2.length) {
            return false;
        }
        for (let i = 0; i < modelGroupState1.length; i++) {
            if (modelGroupState1[i].model !== modelGroupState2[i].model ||
                !modelGroupState1[i].matrix.equals(modelGroupState2[i].matrix)) {
                return false;
            }
        }
        return true;
    }

    _computeAvailableXZ(model) {
        if (this.getModels().length === 0) {
            return { x: 0, z: 0 };
        }
        model.computeBoundingBox();
        const modelBox3 = model.boundingBox;
        const box3Arr = [];
        for (const model of this.getModels()) {
            model.computeBoundingBox();
            box3Arr.push(model.boundingBox);
        }

        const length = 65;
        const step = 5; // min distance of models &
        const y = 1;
        for (let stepCount = 1; stepCount < length / step; stepCount++) {
            // check the 4 positions on x&z axis first
            const positionsOnAxis = [
                new THREE.Vector3(0, y, stepCount * step),
                new THREE.Vector3(0, y, -stepCount * step),
                new THREE.Vector3(stepCount * step, y, 0),
                new THREE.Vector3(-stepCount * step, y, 0)
            ];
            // clock direction
            const p1 = new THREE.Vector3(stepCount * step, y, stepCount * step);
            const p2 = new THREE.Vector3(stepCount * step, y, -stepCount * step);
            const p3 = new THREE.Vector3(-stepCount * step, y, -stepCount * step);
            const p4 = new THREE.Vector3(-stepCount * step, y, stepCount * step);
            const positionsOnSquare = this._getCheckPositions(p1, p2, p3, p4, step);
            const checkPositions = [].concat(positionsOnAxis);
            // no duplicates
            for (const item of positionsOnSquare) {
                if (!(item.x === 0 || item.z === 0)) {
                    checkPositions.push(item);
                }
            }

            // {
            //     const geometry = new THREE.Geometry();
            //     for (const vector3 of checkPositions) {
            //         geometry.vertices.push(vector3);
            //     }
            //     const material = new THREE.PointsMaterial({ color: 0xff0000 });
            //     const points = new THREE.Points(geometry, material);
            //     points.position.y = -1;
            //     this.add(points);
            // }

            for (const position of checkPositions) {
                const modelBox3Clone = modelBox3.clone();
                modelBox3Clone.translate(new THREE.Vector3(position.x, 0, position.z));
                if (modelBox3Clone.min.x < this._bbox.min.x ||
                    modelBox3Clone.max.x > this._bbox.max.x ||
                    modelBox3Clone.min.z < this._bbox.min.z ||
                    modelBox3Clone.max.z > this._bbox.max.z) {
                    continue;
                }
                if (!this._isBox3IntersectOthers(modelBox3Clone, box3Arr)) {
                    return { x: position.x, z: position.z };
                }
            }
        }
        return { x: 0, z: 0 };
    }

    _checkModelsOverstepped() {
        let isAnyModelOverstepped = false;
        for (const model of this.getModels()) {
            model.computeBoundingBox();
            const overstepped = !this._bbox.containsBox(model.boundingBox);
            model.setOverstepped(overstepped);
            isAnyModelOverstepped = (isAnyModelOverstepped || overstepped);
        }
        return isAnyModelOverstepped;
    }

    _hasModel() {
        return this.getModels().length > 0;
    }

    // not include p1, p2
    _getPositionBetween(p1, p2, step) {
        const positions = [];
        if (p1.x !== p2.x) {
            const z = p1.z;
            const minX = Math.min(p1.x, p2.x) + step;
            const maxX = Math.max(p1.x, p2.x);
            for (let x = minX; x < maxX; x += step) {
                positions.push(new THREE.Vector3(x, 1, z));
            }
        } else if (p1.z !== p2.z) {
            const x = p1.x;
            const minZ = Math.min(p1.z, p2.z) + step;
            const maxZ = Math.max(p1.z, p2.z);
            for (let z = minZ; z < maxZ; z += step) {
                positions.push(new THREE.Vector3(x, 1, z));
            }
        }
        return positions;
    }

    _getCheckPositions(p1, p2, p3, p4, step) {
        const arr1 = this._getPositionBetween(p1, p2, step);
        const arr2 = this._getPositionBetween(p2, p3, step);
        const arr3 = this._getPositionBetween(p3, p4, step);
        const arr4 = this._getPositionBetween(p4, p1, step);
        return [p1].concat(arr1, [p2], arr2, [p3], arr3, arr4, [p4]);
    }

    _isBox3IntersectOthers(box3, box3Arr) {
        // check intersect with other box3
        for (const otherBox3 of box3Arr) {
            if (box3.intersectsBox(otherBox3)) {
                return true;
            }
        }
        return false;
    }

    _computeModelsBBox() {
        const boundingBox3Arr = [];
        for (const model of this.getModels()) {
            model.computeBoundingBox();
            boundingBox3Arr.push(model.boundingBox);
        }
        if (boundingBox3Arr.length === 0) {
            return new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
        } else {
            let boundingBoxUnion = boundingBox3Arr[0];
            for (let i = 1; i < boundingBox3Arr.length; i++) {
                boundingBoxUnion = boundingBoxUnion.union(boundingBox3Arr[i]);
            }
            return boundingBoxUnion;
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
}

export default ModelGroup;
