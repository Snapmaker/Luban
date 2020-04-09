// import { Euler, Vector3, Box3, Object3D } from 'three';
import { Vector3, Group } from 'three';
// import { EPSILON } from '../../constants';
import Model from './Model';

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

        this.candidatePoints = null;
        this.onSelectedModelTransformChanged = null;

        this._bbox = null;

        this._emptyState = {
            mode: '',
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            selectedModelID: null,
            transformation: {}
        };
    }

    onModelUpdate = () => {
        this.object.dispatchEvent(EVENTS.UPDATE);
    };

    _getState(model) {
        const { headerType, sourceType, mode, modelID, transformation, boundingBox, originalName } = model;
        return {
            headerType: headerType,
            sourceType: sourceType,
            originalName: originalName,
            mode: mode,
            selectedModelID: modelID,
            modelID: modelID,
            transformation: { ...transformation },
            boundingBox, // only used in 3dp
            estimatedTime: this.estimatedTime,
            hasModel: this._hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped()
        };
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
        }
    }

    getModel(modelID) {
        return this.models.find(d => d.modelID === modelID);
    }

    removeSelectedModel() {
        const selected = this.getSelectedModel();
        if (selected) {
            this.selectedModel = null;
            selected.meshObject.removeEventListener('update', this.onModelUpdate);
            // this.remove(selected);
            this.models = this.models.filter(model => model !== selected);
            this.object.remove(selected.meshObject);

            return this._emptyState;
        }
        return null;
    }

    // model.transformation.positionZ !== model.meshObject3D.position.z
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
                newModel.transformation.positionX = 0;
                newModel.transformation.positionY = 0;
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
                newModel.transformation.positionX = p.x;
                newModel.transformation.positionY = p.y;
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

    setConvexGeometry(uploadName, convexGeometry) {
        const model = this.models.find(m => m.uploadName === uploadName);
        model && model.setConvexGeometry(convexGeometry);
    }

    updateBoundingBox(bbox) {
        this._bbox = bbox;
    }

    removeAllModels() {
        if (this._hasModel()) {
            this.unselectAllModels();
            const models = this.getModels();
            for (const model of models) {
                this.object.remove(model.meshObject);
            }
            this.models.splice(0);
            return this._emptyState;
        }
        return this._emptyState;
    }

    totalEstimatedTime() {
        let totalEstimatedTime_ = 0;
        for (const model of this.models) {
            const estimatedTime_ = model.estimatedTime;
            if (typeof estimatedTime_ !== 'number' || !Number.isNaN(estimatedTime_)) {
                totalEstimatedTime_ += estimatedTime_;
            }
        }
        return totalEstimatedTime_;
    }

    undoRedo(models) {
        for (const model of this.models) {
            model.meshObject.removeEventListener('update', this.onModelUpdate);
            this.object.remove(model.meshObject);
        }
        this.models.splice(0);
        for (const model of models) {
            const newModel = model.clone();
            newModel.meshObject.addEventListener('update', this.onModelUpdate);
            newModel.computeBoundingBox();
            this.models.push(newModel);
            this.object.add(newModel.meshObject);
        }
        this.selectedModel = null;
        return this._emptyState;
    }

    getModels() {
        const models = [];
        for (const model of this.models) {
            models.push(model);
        }
        return models;
    }

    getModelState(modelID) {
        const model = this.getModel(modelID);
        if (model) {
            return this._getState(model);
        }
        return null;
    }

    selectModel(modelMeshObject) {
        if (modelMeshObject) {
            const model = this.models.find(d => d.meshObject === modelMeshObject);
            this.selectedModel = model;
            if (model.estimatedTime) {
                this.estimatedTime = model.estimatedTime;
            }
            model.computeBoundingBox();
            return this._getState(model);
        }
        return null;
    }

    unselectAllModels() {
        this.selectedModel = null;
        return this._emptyState;
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
        return this.selectedModel ? this._getState(this.selectedModel) : this._emptyState;
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

            return {
                hasModel: this._hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped()
            };
            // const state = {
            //     canUndo: this._canUndo(),
            //     canRedo: this._canRedo(),
            //     hasModel: this._hasModel(),
            //     isAnyModelOverstepped: this._checkAnyModelOverstepped()
            // };
            // this.updateState(state);
        }
        return null;
    }

    getSelectedModelState() {
        return this._getState(this.selectedModel);
    }

    getSelectedModel() {
        return this.selectedModel;
    }

    getSelectedModelTaskInfo() {
        if (this.selectedModel) {
            return this.selectedModel.getTaskInfo();
        }
        return null;
    }

    generateModel(modelInfo) {
        const model = new Model(modelInfo);
        model.meshObject.addEventListener('update', this.onModelUpdate);
        model.generateModelObject3D();
        this.addModel(model);
        return this._getState(model);
    }

    updateSelectedSource(source) {
        if (this.selectedModel) {
            this.selectedModel.updateSource(source);
        }
    }


    layFlatSelectedModel() {
        const selected = this.getSelectedModel();
        if (!selected) {
            return null;
        }

        selected.layFlat();
        selected.computeBoundingBox();
        return this._getState(selected);
    }

    onModelTransform() {
        this.selectedModel.onTransform();
        const { sourceType, mode, modelID, transformation, boundingBox, originalName } = this.selectedModel;
        return {
            sourceType: sourceType,
            originalName: originalName,
            mode: mode,
            selectedModelID: modelID,
            modelID: modelID,
            transformation: { ...transformation },
            boundingBox, // only used in 3dp
            hasModel: this._hasModel()
        };
    }

    updateSelectedModelTransformation(transformation) {
        if (this.selectedModel) {
            this.selectedModel.updateTransformation(transformation);
            return this._getState(this.selectedModel);
        }
        return null;
    }

    // model transformation triggered by controls
    onModelAfterTransform() {
        const selected = this.getSelectedModel();
        if (!selected) {
            return null;
        }

        if (selected.sourceType === '3d') {
            selected.stickToPlate();
        }
        selected.computeBoundingBox();
        return this._getState(selected);
    }

    showAllModelsObj3D() {
        for (const model of this.models) {
            model && model.modelObject3D && (model.modelObject3D.visible = true);
        }
    }

    showModelObj3D(modelID) {
        const model = this.getModel(modelID);
        model && model.modelObject3D && (model.modelObject3D.visible = true);
    }

    hideModelObj3D(modelID) {
        const model = this.getModel(modelID);
        model && model.modelObject3D && (model.modelObject3D.visible = false);
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

    getAllBoundingBox() {
        const boundingBox = { max: { x: null, y: null, z: null }, min: { x: null, y: null, z: null } };
        for (const model of this.models) {
            let modelBoundingBox;
            if (model.headerType === '3dp') {
                modelBoundingBox = model.boundingBox;
            } else {
                modelBoundingBox = {
                    max: {
                        x: model.transformation.positionX + model.transformation.width / 2,
                        y: model.transformation.positionY + model.transformation.height / 2,
                        z: 0
                    },
                    min: {
                        x: model.transformation.positionX - model.transformation.width / 2,
                        y: model.transformation.positionY - model.transformation.height / 2,
                        z: 0
                    }
                };
            }
            boundingBox.max.x = boundingBox.max.x ? Math.max(boundingBox.max.x, modelBoundingBox.max.x) : modelBoundingBox.max.x;
            boundingBox.max.y = boundingBox.max.y ? Math.max(boundingBox.max.y, modelBoundingBox.max.y) : modelBoundingBox.max.y;
            boundingBox.max.z = boundingBox.max.z ? Math.max(boundingBox.max.z, modelBoundingBox.max.z) : modelBoundingBox.max.z;
            boundingBox.min.x = boundingBox.min.x ? Math.min(boundingBox.min.x, modelBoundingBox.min.x) : modelBoundingBox.min.x;
            boundingBox.min.y = boundingBox.min.y ? Math.min(boundingBox.min.y, modelBoundingBox.min.y) : modelBoundingBox.min.y;
            boundingBox.min.z = boundingBox.min.z ? Math.min(boundingBox.min.z, modelBoundingBox.min.z) : modelBoundingBox.min.z;
        }
        return boundingBox;
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

    cloneModels() {
        return this.models.map(d => d.clone());
    }
}


export default ModelGroup;
