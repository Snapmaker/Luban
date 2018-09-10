import * as THREE from 'three';

const NO_MODEL = 'no_model';

class ModelGroup extends THREE.Object3D {
    constructor(legalBoundingBox) {
        super();
        this.isModelGroup = true;
        this.type = 'ModelGroup';
        this._undoes = [];
        this._redoes = [];
        // record empty state
        this._undoes.push(NO_MODEL);
        this._legalBoundingBox = legalBoundingBox;
        this._selectedModel = null;
    }

    addModel(model) {
        if (model && model.isModel === true) {
            model.alignWithParent();
            model.position.x = 0;
            model.position.z = 0;
            const xz = this.computeAvailableXZ(model);
            model.position.x = xz.x;
            model.position.z = xz.z;
            this.add(model);
        }
    }

    removeModel(model) {
        if (model && model.isModel === true) {
            this.remove(model);
            if (model === this._selectedModel) {
                this._selectedModel.setSelected(false);
                this._selectedModel = null;
            }
        }
    }

    removeSelectedModel() {
        if (this._selectedModel) {
            this.removeModel(this._selectedModel);
            this._selectedModel = null;
        }
    }

    removeAllModels() {
        this.remove(...this.getModels());
        if (this._selectedModel) {
            this._selectedModel = null;
        }
    }

    undo() {
        if (!this.canUndo()) {
            return;
        }
        this._redoes.push(this._undoes.pop());
        const modelGroupState = this._undoes[this._undoes.length - 1];
        if (modelGroupState === NO_MODEL) {
            this.removeAllModels();
            return;
        }
        // remove all then add back
        this.removeAllModels();
        // todo: handle _selectedModel
        for (const childState of modelGroupState) {
            const model = childState.model;
            const matrix = childState.matrix;
            model.setMatrix(matrix);
            this.add(childState.model);
        }
    }

    redo() {
        if (!this.canRedo()) {
            return;
        }
        this._undoes.push(this._redoes.pop());
        const modelGroupState = this._undoes[this._undoes.length - 1];
        // remove all then add back
        this.removeAllModels();
        // todo: handle _selectedModel
        for (const childState of modelGroupState) {
            childState.model.setMatrix(childState.matrix);
            this.add(childState.model);
        }
    }

    canUndo() {
        return this._undoes.length > 1;
    }

    canRedo() {
        return this._redoes.length > 0;
    }

    recordModelsState() {
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
        if (!this.compareModelGroupState(lastModelGroupState, modelGroupState)) {
            this._undoes.push(modelGroupState);
            this._redoes = [];
        }
    }

    compareModelGroupState(modelGroupState1, modelGroupState2) {
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

    computeAvailableXZ(model) {
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
            const positionsOnSquare = this.getCheckPositions(p1, p2, p3, p4, step);
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
                if (modelBox3Clone.min.x < this._legalBoundingBox.min.x ||
                    modelBox3Clone.max.x > this._legalBoundingBox.max.x ||
                    modelBox3Clone.min.z < this._legalBoundingBox.min.z ||
                    modelBox3Clone.max.z > this._legalBoundingBox.max.z) {
                    continue;
                }
                if (!this.isBox3IntersectOthers(modelBox3Clone, box3Arr)) {
                    return { x: position.x, z: position.z };
                }
            }
        }
        return { x: 0, z: 0 };
    }

    checkModelsOverstepped() {
        let isAnyModelOverstepped = false;
        for (const model of this.getModels()) {
            model.computeBoundingBox();
            const overstepped = !this._legalBoundingBox.containsBox(model.boundingBox);
            model.setOverstepped(overstepped);
            isAnyModelOverstepped = (isAnyModelOverstepped || overstepped);
        }
        return isAnyModelOverstepped;
    }

    hasModel() {
        return this.getModels().length > 0;
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
        if (model && model.isModel === true) {
            for (const item of this.getModels()) {
                item.setSelected(false);
            }
            model.setSelected(true);
            this._selectedModel = model;
        }
    }

    unselectAllModels() {
        for (const model of this.getModels()) {
            model.setSelected(false);
        }
        this._selectedModel = null;
    }

    getSelectedModel() {
        return this._selectedModel;
    }

    // not include p1, p2
    getPositionBetween(p1, p2, step) {
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

    getCheckPositions(p1, p2, p3, p4, step) {
        const arr1 = this.getPositionBetween(p1, p2, step);
        const arr2 = this.getPositionBetween(p2, p3, step);
        const arr3 = this.getPositionBetween(p3, p4, step);
        const arr4 = this.getPositionBetween(p4, p1, step);
        return [p1].concat(arr1, [p2], arr2, [p3], arr3, arr4, [p4]);
    }

    isBox3IntersectOthers(box3, box3Arr) {
        // check intersect with other box3
        for (const otherBox3 of box3Arr) {
            if (box3.intersectsBox(otherBox3)) {
                return true;
            }
        }
        return false;
    }

    arrangeAllModels() {
        const models = this.getModels();
        this.removeAllModels();
        for (const model of models) {
            model.setMatrix(new THREE.Matrix4());
            this.addModel(model);
        }
    }

    multiplySelectedModel(count) {
        if (this._selectedModel) {
            for (let i = 0; i < count; i++) {
                const clone = this._selectedModel.clone();
                this.addModel(clone);
            }
        }
    }

    computeAllModelBoundingBoxUnion() {
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

    // reset scale and rotation
    resetSelectedModelTransformation() {
        if (this._selectedModel) {
            this._selectedModel.scale.copy(new THREE.Vector3(1, 1, 1));
            this._selectedModel.setRotationFromEuler(new THREE.Euler(0, 0, 0, 'XYZ'));
        }
    }
}

export default ModelGroup;
