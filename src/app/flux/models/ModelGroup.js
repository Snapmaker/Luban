// import { Euler, Vector3, Box3, Object3D } from 'three';
import { Euler, Vector3, Box3, Group } from 'three';
// import { EPSILON } from '../../constants';
import Model from './Model';
import Snapshot from './Snapshot';

const EVENTS = {
    UPDATE: { type: 'update' }
};

// class ModelGroup extends Object3D {
class ModelGroup {
    constructor() {
        // this.object = new Object3D();
        this.object = new Group();
        this.models = [];
        this.selectedModel = null;
        this.estimatedTime = 0;

        this.autoPreviewEnabled = true;
        this.candidatePoints = null;
        this.onSelectedModelTransformChanged = null;

        // _undoes & _redoes widget snapshot of all models
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
            selectedModelID: '',
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
            printOrder: 1,
            transformation: null,
            config: null,
            gcodeConfig: null,
            // TODO 2D bbox
            boundingBox: new Box3(new Vector3(), new Vector3())
        };
    }

    onModelUpdate = () => {
        this.object.dispatchEvent(EVENTS.UPDATE);
    };

    updateStateFromSelectedModel() {
        const model = this.selectedModel;

        const { sourceType, mode, modelID, meshObject, transformation, config, gcodeConfig, printOrder, boundingBox } = model;
        const { position, scale, rotation } = meshObject;

        const state = {
            positionX: position.x,
            positionY: position.y,
            positionZ: position.z,
            rotationX: rotation.x,
            rotationY: rotation.y,
            rotationZ: rotation.z,
            scaleX: scale.x,
            scaleY: scale.y,
            scaleZ: scale.z,
            sourceType: sourceType,
            mode: mode,
            selectedModelID: modelID,
            transformation: { ...transformation },
            config: { ...config },
            gcodeConfig: { ...gcodeConfig },
            printOrder: printOrder,
            boundingBox, // only used in 3dp
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped()
        };
        this._invokeListeners(state);
    }

    addModel(model) {
        if (model) {
            this.selectedModel = model;
            this.selectedModel.computeBoundingBox();
            model.meshObject.position.x = 0;
            model.meshObject.position.y = 0;
            model.meshObject.position.z = 0;
            if (model.sourceType === '3d') {
                model.stickToPlate();
                const xz = this._computeAvailableXZ(model);
                model.meshObject.position.x = xz.x;
                model.meshObject.position.z = xz.z;
            }

            this.models.push(model);
            this.object.add(model.meshObject);
            model.meshObject.addEventListener('update', this.onModelUpdate);
            model.autoPreviewEnabled = this.autoPreviewEnabled;
            model.autoPreview();
            this._recordSnapshot();
            this.updateStateFromSelectedModel();
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
        const selected = this.getSelectedModel();
        if (selected) {
            this.selectedModel = null;
            selected.meshObject.removeEventListener('update', this.onModelUpdate);
            // this.remove(selected);
            this.models = this.models.filter(model => model !== selected);
            this.object.remove(selected.meshObject);
            this._recordSnapshot();

            const state = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped(),
                selectedModelID: null
            };
            this._invokeListeners(state);
        }
    }

    // keep the origin order
    bringSelectedModelToFront() {
        const margin = 0.01;
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].meshObject.position.z = (i + 1) * margin;
        }
        const selected = this.getSelectedModel();
        selected.meshObject.position.z = (sorted.length + 2) * margin;
        this.updateStateFromSelectedModel();
    }

    // keep the origin order
    sendSelectedModelToBack() {
        const margin = 0.01;
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].meshObject.position.z = (i + 1) * margin;
        }
        const selected = this.getSelectedModel();
        selected.meshObject.position.z = 0;
        this.updateStateFromSelectedModel();
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
                if (sorted[j].meshObject.position.z > sorted[j + 1].meshObject.position.z) {
                    const tmp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = tmp;
                }
            }
        }
        return sorted;
    }

    arrangeAllModels2D() {
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
            // if (modelGroup.children.length === 0) {
            if (modelGroup.models.length === 0) {
                newModel.meshObject.position.x = 0;
                newModel.meshObject.position.y = 0;
                return;
            }

            /**
             * check whether the model.bbox intersects the bbox of modelGroup.children
             */
            const intersect = (model) => {
                for (const m of modelGroup.models) {
                    if (model.boundingBox.intersectsBox(m.boundingBox)) {
                        return true;
                    }
                }
                return false;
            };
            for (const p of candidatePoints) {
                newModel.meshObject.position.x = p.x;
                newModel.meshObject.position.y = p.y;
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
        for (const model of models) {
            model.computeBoundingBox();
            this.object.remove(model.meshObject);
        }
        this.models.splice(0);
        for (const model of models) {
            setSuitablePosition(this, model, this.candidatePoints);
            this.models.push(model);
            this.object.add(model.meshObject);
        }
        this.onSelectedModelTransformChanged && this.onSelectedModelTransformChanged();
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

    removeAllModels() {
        if (this._hasModel()) {
            this.unselectAllModels();
            const models = this.getModels();
            for (const model of models) {
                this.object.remove(model.meshObject);
            }
            this.models.splice(0);
            this._recordSnapshot();
            const state = {
                selectedModelID: null,
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped()
            };
            this._invokeListeners(state);
        }
    }

    undo() {
        if (!this._canUndo()) {
            return;
        }
        this.unselectAllModels();
        this._redoes.push(this._undoes.pop());
        const snapshot = this._undoes[this._undoes.length - 1];
        this._recoverToSnapshot(snapshot);
        this._undoRedo();
    }

    redo() {
        if (!this._canRedo()) {
            return;
        }

        this.unselectAllModels();

        this._undoes.push(this._redoes.pop());
        const snapshot = this._undoes[this._undoes.length - 1];

        this._recoverToSnapshot(snapshot);

        this._undoRedo();
    }

    _undoRedo() {
        const state = {
            selectedModelID: null,
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped()
        };
        const models = this.getModels();
        for (const model of models) {
            if (model.sourceType !== '3d') {
                model.meshObject.addEventListener('update', this.onModelUpdate);
                model.autoPreviewEnabled = this.autoPreviewEnabled;
                model.autoPreview();
            }
        }
        this._invokeListeners(state);
    }

    _recoverToSnapshot(snapshot) {
        if (snapshot === this._emptySnapshot) {
            // this.remove(...this.getModels());
            const models = this.getModels();
            for (const model of models) {
                this.object.remove(model.meshObject);
            }
            this.models.splice(0);
        } else {
            // remove all then add back
            // this.remove(...this.getModels());
            const models = this.getModels();
            for (const model of models) {
                this.object.remove(model.meshObject);
            }
            this.models.splice(0);
            for (const item of snapshot.data) {
                const { model, matrix } = item;
                model.setMatrix(matrix);
                this.models.push(model);
                this.object.add(model.meshObject);
            }
        }
    }

    getModels() {
        const models = [];
        for (const model of this.models) {
            models.push(model);
        }
        return models;
    }

    selectModel(modelMeshObject) {
        if (modelMeshObject) {
            for (const model of this.models) {
                if (model.meshObject === modelMeshObject) {
                    this.selectedModel = model;
                    if (model.estimatedTime) {
                        this.estimatedTime = model.estimatedTime;
                    }
                    model.computeBoundingBox();
                    this.updateStateFromSelectedModel();
                }
            }
        }
    }

    unselectAllModels() {
        this.selectedModel = null;
        const state = {
            selectedModelID: null
        };
        this._invokeListeners(state);
    }

    arrangeAllModels() {
        const models = this.getModels();
        // this.remove(...models);
        for (const model of models) {
            this.object.remove(model.meshObject);
        }
        this.models.splice(0);

        for (const model of models) {
            model.stickToPlate();
            model.meshObject.position.x = 0;
            model.meshObject.position.z = 0;
            const xz = this._computeAvailableXZ(model);
            model.meshObject.position.x = xz.x;
            model.meshObject.position.z = xz.z;
            // this.add(model);
            this.models.push(model);
            this.object.add(model.meshObject);
        }
        this._recordSnapshot();

        const selected = this.getSelectedModel();
        let modelID = null;
        if (selected && selected.modelID) {
            modelID = selected.modelID;
        }
        let state = {
            selectedModelID: modelID,
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped()
        };
        if (selected) {
            const { position, scale, rotation } = selected.meshObject;
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
                model.meshObject.position.x = 0;
                model.meshObject.position.z = 0;
                const xz = this._computeAvailableXZ(model);
                model.meshObject.position.x = xz.x;
                model.meshObject.position.z = xz.z;
                // this.add(model);
                this.models.push(model);
                this.object.add(model.meshObject);
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
        return this.selectedModel;
    }

    // reset scale to (1, 1, 1) and rotation to (0, 0, 0)
    resetSelectedModelTransformation() {
        const selected = this.getSelectedModel();
        if (selected) {
            selected.meshObject.scale.copy(new Vector3(1, 1, 1));
            selected.meshObject.setRotationFromEuler(new Euler(0, 0, 0, 'XYZ'));
            selected.stickToPlate();
            this._recordSnapshot();
            selected.computeBoundingBox();
            this.updateStateFromSelectedModel();
        }
    }

    generateModel(modelInfo) {
        const model = new Model(modelInfo);
        // this.selectedModel = model;
        return model;
    }

    generateSelectedGcode() {
        return this.selectedModel.generateGcode();
    }

    onSelectedTransform() {
        this.selectedModel.onTransform();
        // this._recordSnapshot();
    }

    updateTransformationFromSelectedModel() {
        this.selectedModel.updateTransformationFromModel();
        // Many 2d snapshots. Don't record.
        // this._recordSnapshot();
    }

    updateSelectedPrintOrder(printOrder) {
        this.selectedModel.updatePrintOrder(printOrder);
        this._recordSnapshot();
    }

    updateSelectedSource(source) {
        this.selectedModel.updateSource(source);
        this._recordSnapshot();
    }

    updateSelectedConfig(config) {
        this.selectedModel.updateConfig(config);
        this._recordSnapshot();
    }

    updateSelectedGcodeConfig(gcodeConfig) {
        this.selectedModel.updateGcodeConfig(gcodeConfig);
        this._recordSnapshot();
    }

    layFlatSelectedModel() {
        const selected = this.getSelectedModel();
        if (!selected) {
            return;
        }

        selected.layFlat();
        this._recordSnapshot();
        selected.computeBoundingBox();
        this.updateStateFromSelectedModel();
    }

    updateSelectedModelTransformation(transformation) {
        const selected = this.getSelectedModel();
        if (selected) {
            selected.updateTransformation(transformation);
            this.updateStateFromSelectedModel();
            // this._recordSnapshot();
        }
    }

    onModelTransform() {
        const selected = this.getSelectedModel();
        if (!selected) {
            return;
        }
        // Many 3d snapshots. Don't record.
        // this._recordSnapshot();
        this.updateStateFromSelectedModel();
    }

    onModelAfterTransform() {
        const selected = this.getSelectedModel();
        if (!selected) {
            return;
        }

        if (selected.sourceType === '3d') {
            selected.stickToPlate();
        }
        this._recordSnapshot();
        selected.computeBoundingBox();
        this.updateStateFromSelectedModel();
    }

    _canUndo() {
        return this._undoes.length > 1;
    }

    _canRedo() {
        return this._redoes.length > 0;
    }

    _recordSnapshot() {
        const models = this.getModels();
        const newSnapshot = new Snapshot(models);
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
        for (const m of this.getModels()) {
            m.computeBoundingBox();
            box3Arr.push(m.boundingBox);
        }

        const length = 65;
        const step = 5; // min distance of models &
        const y = 1;
        for (let stepCount = 1; stepCount < length / step; stepCount++) {
            // check the 4 positions on x&z axis first
            const positionsOnAxis = [
                new Vector3(0, y, stepCount * step),
                new Vector3(0, y, -stepCount * step),
                new Vector3(stepCount * step, y, 0),
                new Vector3(-stepCount * step, y, 0)
            ];
            // clock direction
            const p1 = new Vector3(stepCount * step, y, stepCount * step);
            const p2 = new Vector3(stepCount * step, y, -stepCount * step);
            const p3 = new Vector3(-stepCount * step, y, -stepCount * step);
            const p4 = new Vector3(-stepCount * step, y, stepCount * step);
            const positionsOnSquare = this._getCheckPositions(p1, p2, p3, p4, step);
            const checkPositions = [].concat(positionsOnAxis);
            // no duplicates
            for (const item of positionsOnSquare) {
                if (!(item.x === 0 || item.z === 0)) {
                    checkPositions.push(item);
                }
            }

            // {
            //     const geometry = new Geometry();
            //     for (const vector3 of checkPositions) {
            //         geometry.vertices.push(vector3);
            //     }
            //     const material = new PointsMaterial({ color: 0xff0000 });
            //     const points = new Points(geometry, material);
            //     points.position.y = -1;
            //     this.add(points);
            // }

            for (const position of checkPositions) {
                const modelBox3Clone = modelBox3.clone();
                modelBox3Clone.translate(new Vector3(position.x, 0, position.z));
                if (modelBox3Clone.min.x < this._bbox.min.x
                    || modelBox3Clone.max.x > this._bbox.max.x
                    || modelBox3Clone.min.z < this._bbox.min.z
                    || modelBox3Clone.max.z > this._bbox.max.z) {
                    continue;
                }
                if (!this._isBox3IntersectOthers(modelBox3Clone, box3Arr)) {
                    return { x: position.x, z: position.z };
                }
            }
        }
        return { x: 0, z: 0 };
    }

    _checkAnyModelOverstepped() {
        let isAnyModelOverstepped = false;
        for (const model of this.getModels()) {
            if (model.sourceType === '3d') {
                const overstepped = this._checkOverstepped(model);
                model.setOverstepped(overstepped);
                isAnyModelOverstepped = (isAnyModelOverstepped || overstepped);
            }
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
                positions.push(new Vector3(x, 1, z));
            }
        } else if (p1.z !== p2.z) {
            const x = p1.x;
            const minZ = Math.min(p1.z, p2.z) + step;
            const maxZ = Math.max(p1.z, p2.z);
            for (let z = minZ; z < maxZ; z += step) {
                positions.push(new Vector3(x, 1, z));
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
    //         return new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
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
}


export default ModelGroup;
