// import { Euler, Vector3, Box3, Object3D } from 'three';
import { Euler, Vector3, Box3, Group } from 'three';
import { EPSILON } from '../../constants';
import Model from './Model';

const EVENTS = {
    UPDATE: { type: 'update' }
};

class Snapshot {
    constructor(models) {
        this.data = [];
        for (const model of models) {
            // model.updateMatrix();
            model.meshObject.updateMatrix();
            this.data.push({
                model: model,
                // matrix: model.matrix.clone()
                matrix: model.meshObject.matrix.clone()
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
            if (data1[i].model !== data2[i].model || !Snapshot._customCompareMatrix4(data1[i].matrix, data2[i].matrix)) {
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


// class ModelGroup extends Object3D {
class ModelGroup {
    constructor() {
        // super();
        // this.object = new Object3D();
        this.object = new Group();
        this.models = [];
        this.selectedModel = null;
        this.estimatedTime = 0;

        this.autoPreviewEnabled = true;
        this.candidatePoints = null;
        this.onSelectedModelTransformChanged = null;

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
            // model: null,
            selectedModelID: '',
            positionX: 0,
            // positionY: 0,
            positionZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
            flip: 0,
            boundingBox: new Box3(new Vector3(), new Vector3())
        };
    }

    onModelUpdate = () => {
        // this.dispatchEvent(EVENTS.UPDATE);
        this.object.dispatchEvent(EVENTS.UPDATE);
    };

    addModel(model) {
        if (model) {
            this.selectedModel = model;
            if (model.sourceType === '3d') {
                model.stickToPlate();
                model.meshObject.position.x = 0;
                model.meshObject.position.z = 0;
                const xz = this._computeAvailableXZ(model);
                model.meshObject.position.x = xz.x;
                model.meshObject.position.z = xz.z;

                // this.add(model);
                this.models.push(model);
                this.object.add(model.meshObject);
                // this.add(model.meshObject);
                this._recordSnapshot();

                const state = {
                    canUndo: this._canUndo(),
                    canRedo: this._canRedo(),
                    hasModel: this._hasModel(),
                    isAnyModelOverstepped: this._checkAnyModelOverstepped()
                };
                this._invokeListeners(state);
            } else {
                model.meshObject.position.x = 0;
                model.meshObject.position.y = 0;
                this.models.push(model);
                this.object.add(model.meshObject);
                model.meshObject.addEventListener('update', this.onModelUpdate);
                model.autoPreviewEnabled = this.autoPreviewEnabled;
                model.autoPreview();
            }
            // TODO
            // this.calcTotalEstimatedTime();
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
            // selected.setSelected(false);
            this.selectedModel = null;
            selected.meshObject.removeEventListener('update', this.onModelUpdate);
            // this.remove(selected);
            this.models = this.models.filter(model => model !== selected);
            this.object.remove(selected.meshObject);
            this._recordSnapshot();
            // TODO
            // this.calcTotalEstimatedTime();

            const state = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped(),
                // model: null
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
                // for (const m of modelGroup.children) {
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
        // this.remove(...models);
        for (const model of models) {
            setSuitablePosition(this, model, this.candidatePoints);
            // this.add(model);
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
        const selected = this.getSelectedModel();
        if (selected) {
            // selected.setSelected(false);
            this.selectedModel = null;
        }
        // this.totalEstimatedTime = 0;
        if (this._hasModel()) {
            // this.remove(...this.getModels());
            const models = this.getModels();
            for (const model of models) {
                this.object.remove(model.meshObject);
            }
            this.models.splice(0);
            this._recordSnapshot();

            const state = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped(),
                // model: null
                selectedModelID: ''
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
        let modelID = '';
        if (selected && selected.modelID) {
            modelID = selected.modelID;
        }
        let state = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            // model: selected
            selectedModelID: modelID
        };
        if (selected) {
            selected.computeBoundingBox();
            const { meshObject, boundingBox } = selected;
            const { position, scale, rotation } = meshObject;
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
        let modelID = '';
        if (selected && selected.modelID) {
            modelID = selected.modelID;
        }
        let state = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            // model: selected
            selectedModelID: modelID
        };
        if (selected) {
            selected.computeBoundingBox();
            const { meshObject, boundingBox } = selected;
            const { position, scale, rotation } = meshObject;
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
            // selected && selected.setSelected(false);
            // this.remove(...this.getModels());
            selected && (this.selectedModel = null);
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
                // this.add(model);
                this.models.push(model);
                this.object.add(model.meshObject);
            }
        }
    }

    getModels() {
        const models = [];
        // for (const child of this.children) {
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
                    const { modelID, meshObject, boundingBox } = model;
                    const { position, scale, rotation } = meshObject;
                    const flip = model.transformation.flip;
                    const state = {
                        // model: model,
                        selectedModelID: modelID,
                        positionX: position.x,
                        // positionY: position.y,
                        positionZ: position.z,
                        rotationX: rotation.x,
                        rotationY: rotation.y,
                        rotationZ: rotation.z,
                        scaleX: scale.x,
                        scaleY: scale.y,
                        scaleZ: scale.z,
                        flip: flip,
                        boundingBox
                    };
                    this._invokeListeners(state);
                }
            }
        }
    }

    unselectAllModels() {
        // const selectedModel = this.getSelectedModel();
        // selectedModel && selectedModel.setSelected(false);
        this.selectedModel = null;

        const state = {
            // model: null,
            selectedModelID: '',
            position: new Vector3(),
            scale: new Vector3(),
            rotation: new Vector3()
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
        let modelID = '';
        if (selected && selected.modelID) {
            modelID = selected.modelID;
        }
        let state = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            selectedModelID: modelID
            // model: selected
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

    // TODO
    getSelectedModel() {
        /*
        for (const model of this.getModels()) {
            if (model.isSelected()) {
                return model;
            }
        }
        return null;
        */
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
            const { meshObject, boundingBox } = selected;
            const { position, scale, rotation } = meshObject;
            const flip = selected.transformation.flip;
            let modelID = '';
            if (selected && selected.modelID) {
                modelID = selected.modelID;
            }
            const state = {
                canUndo: this._canUndo(),
                canRedo: this._canRedo(),
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped(),

                // model: selected,
                selectedModelID: modelID,
                positionX: position.x,
                positionZ: position.z,
                rotationX: rotation.x,
                rotationY: rotation.y,
                rotationZ: rotation.z,
                scaleX: scale.x,
                scaleY: scale.y,
                scaleZ: scale.z,
                flip: flip,
                boundingBox
            };
            this._invokeListeners(state);
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

    /*
    getSelectedModelInfo() {
        return this.selectedModel.modelInfo;
    }
    */

    onSelectedTransform() {
        this.selectedModel.onTransform();
    }

    updateTransformationFromSelectedModel() {
        this.selectedModel.updateTransformationFromModel();
    }

    updateSelectedPrintOrder(printOrder) {
        this.selectedModel.updatePrintOrder(printOrder);
    }

    updateSelectedSource(source) {
        this.selectedModel.updateSource(source);
    }

    updateSelectedConfig(config) {
        this.selectedModel.updateConfig(config);
    }

    updateSelectedGcodeConfig(gcodeConfig) {
        this.selectedModel.updateGcodeConfig(gcodeConfig);
    }

    layFlatSelectedModel() {
        const selected = this.getSelectedModel();
        if (!selected) {
            return;
        }

        selected.layFlat();
        this._recordSnapshot();
        selected.computeBoundingBox();
        const { meshObject, boundingBox } = selected;
        const { position, scale, rotation } = meshObject;
        const flip = selected.transformation.flip;
        let modelID = '';
        if (selected && selected.modelID) {
            modelID = selected.modelID;
        }
        const state = {
            canUndo: this._canUndo(),
            canRedo: this._canRedo(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            // model: selected,
            selectedModelID: modelID,
            positionX: position.x,
            positionZ: position.z,
            rotationX: rotation.x,
            rotationY: rotation.y,
            rotationZ: rotation.z,
            scaleX: scale.x,
            scaleY: scale.y,
            scaleZ: scale.z,
            flip: flip,
            boundingBox
        };
        this._invokeListeners(state);
    }

    onModelTransform() {
        const selected = this.getSelectedModel();
        if (!selected) {
            return;
        }

        // const { position, scale, rotation } = selected;
        const { meshObject, boundingBox } = selected;
        const { position, scale, rotation } = meshObject;
        const flip = selected.transformation.flip;
        const state = {
            positionX: position.x,
            positionZ: position.z,
            rotationX: rotation.x,
            rotationY: rotation.y,
            rotationZ: rotation.z,
            scaleX: scale.x,
            scaleY: scale.y,
            scaleZ: scale.z,
            flip: flip,
            boundingBox
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
        // const { position, scale, rotation, boundingBox } = selected;
        const { meshObject, boundingBox } = selected;
        const { position, scale, rotation } = meshObject;
        const flip = selected.transformation.flip;
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
            flip: flip,
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

    /**
     * return true if any model is overstepped
     * @returns {boolean}
     * @private
     */
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

    updateSelectedModelTransformation(transformation) {
        const selected = this.getSelectedModel();
        if (selected) {
            selected.updateTransformation(transformation);
            const { meshObject, boundingBox } = selected;
            const { position, scale, rotation } = meshObject;
            const flip = selected.transformation.flip;
            const state = {
                positionX: position.x,
                positionZ: position.z,
                rotationX: rotation.x,
                rotationY: rotation.y,
                rotationZ: rotation.z,
                scaleX: scale.x,
                scaleY: scale.y,
                scaleZ: scale.z,
                flip: flip,
                boundingBox
            };
            this._invokeListeners(state);
        }
    }
}


export default ModelGroup;
