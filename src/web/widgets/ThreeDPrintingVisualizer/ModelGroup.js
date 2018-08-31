import * as THREE from 'three';

// lazy mode
function ModelGroup(legalBoundingBox) {
    THREE.Object3D.call(this);
    this.type = 'ModelGroup';
    this.undoes = [];
    this.redoes = [];
    // record empty state
    this.recordModelsState();
    this.legalBoundingBox = legalBoundingBox;
    this.selectedModel = undefined;
}

ModelGroup.prototype = Object.assign(Object.create(THREE.Object3D.prototype), {

    constructor: ModelGroup,

    isModelGroup: true,

    addModel: function(model) {
        if (model && model.isModel === true) {
            model.alignWithParent();
            const xz = this.computeAvailableXZ(model);
            model.position.x = xz.x;
            model.position.z = xz.z;
            this.add(model);
        }
    },

    removeModel: function(model) {
        if (model && model.isModel === true) {
            this.remove(model);
            if (model === this.selectedModel) {
                this.selectedModel.setSelected(false);
                this.selectedModel = undefined;
            }
        }
    },

    removeSelectedModel: function() {
        if (this.selectedModel) {
            this.removeModel(this.selectedModel);
            this.selectedModel = undefined;
        }
    },

    removeAllModels: function() {
        this.remove(...this.getModels());
        if (this.selectedModel) {
            this.selectedModel = undefined;
        }
    },

    undo: function () {
        if (!this.canUndo()) {
            return;
        }
        this.redoes.push(this.undoes.pop());
        const modelGroupState = this.undoes[this.undoes.length - 1];
        if (modelGroupState.length === 0) {
            this.removeAllModels();
            return;
        }
        // remove all then add back
        this.removeAllModels();
        // todo: handle selectedModel
        for (const childState of modelGroupState) {
            const model = childState.model;
            const matrix = childState.matrix;
            model.setMatrix(matrix);
            this.add(childState.model);
        }
    },

    redo: function () {
        if (!this.canRedo()) {
            return;
        }
        this.undoes.push(this.redoes.pop());
        const modelGroupState = this.undoes[this.undoes.length - 1];
        // remove all then add back
        this.removeAllModels();
        // todo: handle selectedModel
        for (const childState of modelGroupState) {
            childState.model.setMatrix(childState.matrix);
            this.add(childState.model);
        }
    },

    canUndo: function () {
        return this.undoes.length > 1;
    },

    canRedo: function () {
        return this.redoes.length > 0;
    },

    recordModelsState: function () {
        const modelGroupState = [];
        for (const model of this.children) {
            if (model.isModel === true) {
                model.updateMatrix();
                const childState = {
                    model: model,
                    matrix: model.matrix.clone()
                };
                modelGroupState.push(childState);
            }
        }

        const lastModelGroupState = this.undoes[this.undoes.length - 1];
        // do not push if modelGroupState is same with last
        if (JSON.stringify(lastModelGroupState) === JSON.stringify(modelGroupState)) {
            return;
        }
        this.undoes.push(modelGroupState);
        this.redoes = [];
    },

    computeAvailableXZ: function(model) {
        model.computeBoundingBox();
        const modelBox3 = model.boundingBox;

        if (this.getModels().length === 0) {
            return { x: 0, z: 0 };
        }

        const box3Arr = [];
        for (const model of this.getModels()) {
            model.computeBoundingBox();
            box3Arr.push(model.boundingBox);
        }

        const length = 100;
        const step = 5; // min distance of models &
        const y = 1;
        for (let stepCount = 1; stepCount < length / step; stepCount++) {
            // clock direction
            const p1 = new THREE.Vector3(stepCount * step, y, stepCount * step);
            const p2 = new THREE.Vector3(stepCount * step, y, -stepCount * step);
            const p3 = new THREE.Vector3(-stepCount * step, y, -stepCount * step);
            const p4 = new THREE.Vector3(-stepCount * step, y, stepCount * step);
            const positionArr = this.getCheckPositions(p1, p2, p3, p4, step);

            // {
            //     var geometry = new THREE.Geometry();
            //     for (const v of positionArr){
            //         geometry.vertices.push(v);
            //     }
            //     var material = new THREE.PointsMaterial( { color: 0xff0000 } );
            //     var points = new THREE.Points( geometry, material );
            //     points.position.y = -1;
            //     this.add(points);
            // }

            for (const position of positionArr) {
                const modelBox3Clone = modelBox3.clone();
                modelBox3Clone.translate(new THREE.Vector3(position.x, 0, position.z));
                if (modelBox3Clone.min.x < this.legalBoundingBox.min.x ||
                    modelBox3Clone.max.x > this.legalBoundingBox.max.x ||
                    modelBox3Clone.min.z < this.legalBoundingBox.min.z ||
                    modelBox3Clone.max.z > this.legalBoundingBox.max.z) {
                    continue;
                }
                if (!this.isBox3IntersectOthers(modelBox3Clone, box3Arr)) {
                    return { x: position.x, z: position.z };
                }
            }
        }
        return { x: 0, z: 0 };
    },

    checkModelsOverstepped: function() {
        let isAnyModelOverstepped = false;
        for (const model of this.getModels()) {
            model.computeBoundingBox();
            const overstepped = !this.legalBoundingBox.containsBox(model.boundingBox);
            model.setOverstepped(overstepped);
            isAnyModelOverstepped = (isAnyModelOverstepped || overstepped);
        }
        return isAnyModelOverstepped;
    },

    hasModel: function () {
        return this.getModels().length > 0;
    },

    getModels: function() {
        const models = [];
        for (const child of this.children) {
            if (child.isModel === true) {
                models.push(child);
            }
        }
        return models;
    },

    selectModel: function(model) {
        if (model && model.isModel === true) {
            for (const item of this.getModels()) {
                item.setSelected(false);
            }
            model.setSelected(true);
            this.selectedModel = model;
        }
    },

    unselectAllModels: function() {
        for (const model of this.getModels()) {
            model.setSelected(false);
        }
        this.selectedModel = undefined;
    },

    getSelectedModel: function() {
        return this.selectedModel;
    },

    // not include p1, p2
    getPositionBetween: function(p1, p2, step) {
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
    },

    getCheckPositions: function(p1, p2, p3, p4, step) {
        const arr1 = this.getPositionBetween(p1, p2, step);
        const arr2 = this.getPositionBetween(p2, p3, step);
        const arr3 = this.getPositionBetween(p3, p4, step);
        const arr4 = this.getPositionBetween(p4, p1, step);
        return [p1].concat(arr1, [p2], arr2, [p3], arr3, arr4, [p4]);
    },

    isBox3IntersectOthers: function(box3, box3Arr) {
        // check intersect with other box3
        for (const otherBox3 of box3Arr) {
            if (box3.intersectsBox(otherBox3)) {
                return true;
            }
        }
        return false;
    },

    arrangeAllModels: function() {
        const models = this.getModels();
        this.removeAllModels();
        for (const model of models) {
            model.setMatrix(new THREE.Matrix4());
            this.addModel(model);
        }
    },

    multiplySelectedModel(count) {
        if (this.selectedModel) {
            for (let i = 0; i < count; i++) {
                // FIXME: random color of material
                const clone = this.selectedModel.clone();
                this.addModel(clone);
            }
        }
    }
});

export default ModelGroup;
