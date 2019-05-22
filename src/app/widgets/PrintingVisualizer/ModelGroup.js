import * as THREE from 'three';
import { EPSILON } from '../../constants';

class Snapshot {
    constructor(models) {
        this.data = [];
        for (const model of models) {
            model.updateMatrix();
            this.data.push({
                model: model,
                matrix: model.matrix.clone()
            });
        }
    }

    static compareSnapshot(snapshot1, snapshot2) {
        if (snapshot1.data.length !== snapshot2.data.length) {
            return false;
        }
        // todo: the item order should not influence result
        const data1 = snapshot1.data;
        const data2 = snapshot2.data;
        for (let i = 0; i < data1.length; i++) {
            if (data1[i].model !== data2[i].model ||
                !Snapshot._customCompareMatrix4(data1[i].matrix, data2[i].matrix)) {
                return false;
            }
        }
        return true;
    }

    /**
     * return true if m1 equals m2
     * @param m1
     * @param m2
     * @private
     */
    static _customCompareMatrix4(m1, m2) {
        const arr1 = m1.toArray();
        const arr2 = m2.toArray();
        for (let i = 0; i < arr1.length; i++) {
            if (Math.abs(arr1[i] - arr2[i]) > EPSILON) {
                return false;
            }
        }
        return true;
    }
}

class ModelGroup extends THREE.Object3D {
    constructor() {
        super();
        this.isModelGroup = true;
        // _undoes & _redoes store snapshot of all models
        this._undoes = [];
        this._redoes = [];
        this._emptySnapshot = new Snapshot([]);
        this._undoes.push(this._emptySnapshot);
        this._bbox = null;
        this._listeners = [];
        this._state = {
            canUndo: false,
            canRedo: false,
            hasModel: false,
            isAnyModelOverstepped: false,
            // selected model
            model: null,
            // boundingBox of selected model
            boundingBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()),
            // transformation of selected model
            positionX: 0,
            positionZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1
        };
    }

    updateBoundingBox(bbox) {
        this._bbox = bbox;
        const state = {
            isAnyModelOverstepped: this._checkAnyModelOverstepped()
        };
        this._invokeListeners(state);
    }

    /**
     * listeners will be invoked when this._state changed
     * @param listener
     */
    addStateChangeListener(listener) {
        if (this._listeners.indexOf(listener) === -1) {
            this._listeners.push(listener);
        }
    }

    addModel(model) {
        if (model && model.isModel === true) {
            model.stickToPlate();
            model.position.x = 0;
            model.position.z = 0;
            const xz = this._computeAvailableXZ(model);
            model.position.x = xz.x;
            model.position.z = xz.z;

            this.add(model);
            this._recordSnapshot();

            const state = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped()
            };
            this._invokeListeners(state);
        }
    }

    removeSelectedModel() {
        const selected = this.getSelectedModel();
        if (selected) {
            selected.setSelected(false);
            this.remove(selected);
            this._recordSnapshot();

            const state = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped(),
                model: null
            };
            this._invokeListeners(state);
        }
    }

    removeAllModels() {
        const selected = this.getSelectedModel();
        if (selected) {
            selected.setSelected(false);
        }
        if (this._hasModel()) {
            this.remove(...this.getModels());
            this._recordSnapshot();

            const state = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped(),
                model: null
            };
            this._invokeListeners(state);
        }
    }

    undo() {
        if (!this._canUndo()) {
            return;
        }

        this._redoes.push(this._undoes.pop());
        const snapshot = this._undoes[this._undoes.length - 1];
        this._recoverToSnapshot(snapshot);

        const selected = this.getSelectedModel();
        let state = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            model: selected
        };
        if (selected) {
            selected.computeBoundingBox();
            const { position, scale, rotation, boundingBox } = selected;
            state = {
                ...state,
                positionX: position.x,
                positionZ: position.z,
                rotationX: rotation.x,
                rotationY: rotation.y,
                rotationZ: rotation.z,
                scaleX: scale.x,
                scaleY: scale.y,
                scaleZ: scale.z,
                boundingBox
            };
        }
        this._invokeListeners(state);
    }

    redo() {
        if (!this._canRedo()) {
            return;
        }

        this._undoes.push(this._redoes.pop());
        const snapshot = this._undoes[this._undoes.length - 1];
        this._recoverToSnapshot(snapshot);

        const selected = this.getSelectedModel();
        let state = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            model: selected
        };
        if (selected) {
            selected.computeBoundingBox();
            const { position, scale, rotation, boundingBox } = selected;
            state = {
                ...state,
                positionX: position.x,
                positionZ: position.z,
                rotationX: rotation.x,
                rotationY: rotation.y,
                rotationZ: rotation.z,
                scaleX: scale.x,
                scaleY: scale.y,
                scaleZ: scale.z,
                boundingBox
            };
        }
        this._invokeListeners(state);
    }

    _recoverToSnapshot(snapshot) {
        if (snapshot === this._emptySnapshot) {
            const selected = this.getSelectedModel();
            selected && selected.setSelected(false);
            this.remove(...this.getModels());
        } else {
            // remove all then add back
            this.remove(...this.getModels());
            for (const item of snapshot.data) {
                const { model, matrix } = item;
                model.setMatrix(matrix);
                this.add(model);
            }
        }
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
        if (model && model.isModel) {
            const selected = this.getSelectedModel();
            if (model !== selected) {
                selected && selected.setSelected(false);
                model.setSelected(true);
                model.computeBoundingBox();
                const { position, scale, rotation, boundingBox } = model;
                const state = {
                    model: model,
                    positionX: position.x,
                    positionZ: position.z,
                    rotationX: rotation.x,
                    rotationY: rotation.y,
                    rotationZ: rotation.z,
                    scaleX: scale.x,
                    scaleY: scale.y,
                    scaleZ: scale.z,
                    boundingBox
                };
                this._invokeListeners(state);
            }
        }
    }

    unselectAllModels() {
        const selectedModel = this.getSelectedModel();
        selectedModel && selectedModel.setSelected(false);

        const state = {
            model: null,
            position: new THREE.Vector3(),
            scale: new THREE.Vector3(),
            rotation: new THREE.Vector3()
        };
        this._invokeListeners(state);
    }

    arrangeAllModels() {
        const models = this.getModels();
        this.remove(...models);

        for (const model of models) {
            model.stickToPlate();
            model.position.x = 0;
            model.position.z = 0;
            const xz = this._computeAvailableXZ(model);
            model.position.x = xz.x;
            model.position.z = xz.z;
            this.add(model);
        }
        this._recordSnapshot();

        const selected = this.getSelectedModel();
        let state = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            model: selected
        };
        if (selected) {
            const { position, scale, rotation } = selected;
            state = {
                ...state,
                positionX: position.x,
                positionZ: position.z,
                rotationX: rotation.x,
                rotationY: rotation.y,
                rotationZ: rotation.z,
                scaleX: scale.x,
                scaleY: scale.y,
                scaleZ: scale.z
            };
        }
        this._invokeListeners(state);
    }

    multiplySelectedModel(count) {
        const selected = this.getSelectedModel();
        if (selected && count > 0) {
            for (let i = 0; i < count; i++) {
                const model = this.getSelectedModel().clone();
                model.stickToPlate();
                model.position.x = 0;
                model.position.z = 0;
                const xz = this._computeAvailableXZ(model);
                model.position.x = xz.x;
                model.position.z = xz.z;
                this.add(model);
            }
            this._recordSnapshot();

            const state = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped()
            };
            this._invokeListeners(state);
        }
    }

    getSelectedModel() {
        for (const model of this.getModels()) {
            if (model.isSelected()) {
                return model;
            }
        }
        return null;
    }

    // reset scale to (1, 1, 1) and rotation to (0, 0, 0)
    resetSelectedModelTransformation() {
        const selected = this.getSelectedModel();
        if (selected) {
            selected.scale.copy(new THREE.Vector3(1, 1, 1));
            selected.setRotationFromEuler(new THREE.Euler(0, 0, 0, 'XYZ'));
            selected.stickToPlate();
            this._recordSnapshot();
            selected.computeBoundingBox();
            const { position, scale, rotation, boundingBox } = selected;
            const state = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped(),

                model: selected,
                positionX: position.x,
                positionZ: position.z,
                rotationX: rotation.x,
                rotationY: rotation.y,
                rotationZ: rotation.z,
                scaleX: scale.x,
                scaleY: scale.y,
                scaleZ: scale.z,
                boundingBox
            };
            this._invokeListeners(state);
        }
    }

    layFlatSelectedModel() {
        const selected = this.getSelectedModel();
        if (!selected) {
            return;
        }

        selected.layFlat();
        this._recordSnapshot();
        selected.computeBoundingBox();
        const { position, scale, rotation, boundingBox } = selected;
        const state = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            model: selected,
            positionX: position.x,
            positionZ: position.z,
            rotationX: rotation.x,
            rotationY: rotation.y,
            rotationZ: rotation.z,
            scaleX: scale.x,
            scaleY: scale.y,
            scaleZ: scale.z,
            boundingBox
        };
        this._invokeListeners(state);
    }

    onModelTransform() {
        const selected = this.getSelectedModel();
        if (!selected) {
            return;
        }

        const { position, scale, rotation } = selected;
        const state = {
            positionX: position.x,
            positionZ: position.z,
            rotationX: rotation.x,
            rotationY: rotation.y,
            rotationZ: rotation.z,
            scaleX: scale.x,
            scaleY: scale.y,
            scaleZ: scale.z,
        };
        this._invokeListeners(state);
    }

    onModelAfterTransform() {
        const selected = this.getSelectedModel();
        if (!selected) {
            return;
        }

        selected.stickToPlate();
        this._recordSnapshot();
        selected.computeBoundingBox();
        const { position, scale, rotation, boundingBox } = selected;
        const state = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            model: selected,
            positionX: position.x,
            positionZ: position.z,
            rotationX: rotation.x,
            rotationY: rotation.y,
            rotationZ: rotation.z,
            scaleX: scale.x,
            scaleY: scale.y,
            scaleZ: scale.z,
            boundingBox
        };
        this._invokeListeners(state);
    }

    _canUndo() {
        return this._undoes.length > 1;
    }

    _canRedo() {
        return this._redoes.length > 0;
    }

    /**
     * not record snapshot if new snapshot is same with last snapshot
     * @private
     */
    _recordSnapshot() {
        const newSnapshot = new Snapshot(this.getModels());
        const lastSnapshot = this._undoes[this._undoes.length - 1];
        if (!Snapshot.compareSnapshot(newSnapshot, lastSnapshot)) {
            this._undoes.push(newSnapshot);
            this._redoes = [];
        }
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

    /**
     * return true if any model is overstepped
     * @returns {boolean}
     * @private
     */
    _checkAnyModelOverstepped() {
        let isAnyModelOverstepped = false;
        for (const model of this.getModels()) {
            const overstepped = this._checkOverstepped(model);
            model.setOverstepped(overstepped);
            isAnyModelOverstepped = (isAnyModelOverstepped || overstepped);
        }
        return isAnyModelOverstepped;
    }

    _checkOverstepped(model) {
        model.computeBoundingBox();
        return !this._bbox.containsBox(model.boundingBox);
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

    // _computeModelsBBox() {
    //     const boundingBox3Arr = [];
    //     for (const model of this.getModels()) {
    //         model.computeBoundingBox();
    //         boundingBox3Arr.push(model.boundingBox);
    //     }
    //     if (boundingBox3Arr.length === 0) {
    //         return new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
    //     } else {
    //         let boundingBoxUnion = boundingBox3Arr[0];
    //         for (let i = 1; i < boundingBox3Arr.length; i++) {
    //             boundingBoxUnion = boundingBoxUnion.union(boundingBox3Arr[i]);
    //         }
    //         return boundingBoxUnion;
    //     }
    // }

    _invokeListeners(state) {
        this._state = {
            ...this._state,
            ...state
        };
        for (let i = 0; i < this._listeners.length; i++) {
            this._listeners[i](this._state);
        }
    }

    updateSelectedModelTransformation(transformation) {
        const selected = this.getSelectedModel();
        if (selected) {
            selected.updateTransformation(transformation);
            const { position, scale, rotation } = selected;
            const state = {
                positionX: position.x,
                positionZ: position.z,
                rotationX: rotation.x,
                rotationY: rotation.y,
                rotationZ: rotation.z,
                scaleX: scale.x,
                scaleY: scale.y,
                scaleZ: scale.z
            };
            this._invokeListeners(state);
        }
    }
}

export default ModelGroup;
