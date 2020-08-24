// import { Euler, Vector3, Box3, Object3D } from 'three';
// import { Vector3, Group, MeshPhongMaterial } from 'three';
import { Vector3, Group, MeshPhongMaterial, Matrix4 } from 'three';
import EventEmitter from 'events';
// import { EPSILON } from '../../constants';
import uuid from 'uuid';
import Model from './Model';

const materialNormal = new MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 30 });
const materialSelected = new MeshPhongMaterial({ color: 0xf0f0f0 });

const EVENTS = {
    UPDATE: { type: 'update' }
};

// class ModelGroup extends Object3D {
class ModelGroup extends EventEmitter {
    constructor(headType) {
        super();
        this.headType = headType;
        // this.object = new Object3D();
        this.object = new Group();

        this.models = [];

        this.selectedGroup = new Group();
        this.selectedGroup.uniformScalingState = true;
        this.object.add(this.selectedGroup);
        this.selectedModelArray = [];
        this.copiedModelArray = [];
        this.estimatedTime = 0;
        this.selectedModelIDArray = [];

        this.candidatePoints = null;
        this._bbox = null;
    }

    setDataChangedCallback(handler) {
        this.onDataChangedCallback = handler;
    }


    _getEmptyState = () => {
        return {
            mode: '',
            hasModel: this.hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            selectedModelIDArray: [],
            selectedModelArray: [],
            transformation: {}
        };
    };

    setUpdateHandler(handler) {
        this._updateView = handler;
    }

    onModelUpdate = () => {
        this.object.dispatchEvent(EVENTS.UPDATE);
    };

    getState() {
        this.selectedModelIDArray = [];
        this.selectedModelArray.forEach((item) => {
            this.selectedModelIDArray.push(item.modelID);
        });

        return {
            selectedModelArray: this.selectedModelArray,
            selectedModelIDArray: this.selectedModelIDArray,
            estimatedTime: this.estimatedTime,
            hasModel: this.hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped()
        };
    }

    createNewModelName(model) {
        let baseName = '';
        if (model.sourceType === '3d') {
            baseName = '3DModel';
        } else {
            if (model.sourceType === 'text') {
                baseName = 'Text';
            } else if (model.mode !== 'vector') {
                baseName = model.originalName;
                // todo, it may named when upload, but not when create model
            } else {
                baseName = 'Shape';
            }
        }
        let count = 1;
        let name = '';
        while (1) {
            if (baseName === 'Text' || baseName === 'Shape') {
                name = `${baseName} ${count.toString()}`;
            } else {
                if (count === 1) {
                    name = baseName;
                } else {
                    name = `${baseName}(${count.toString()})`;
                }
            }
            if (!this.getModelByModelName(name)) {
                return name;
            }
            count++;
        }
    }

    getModel(modelID) {
        return this.models.find(d => d.modelID === modelID);
    }

    getModelByModelName(modelName) {
        return this.models.find(d => d.modelName === modelName);
    }

    getSelectedModelTransformation() {
        if (this.selectedModelArray.length > 0) {
            return {
                positionX: this.selectedGroup.position.x,
                positionY: this.selectedGroup.position.y,
                scaleX: this.selectedGroup.scale.x,
                scaleY: this.selectedGroup.scale.y,
                scaleZ: this.selectedGroup.scale.z,
                uniformScalingState: this.selectedGroup.uniformScalingState,
                rotationX: this.selectedGroup.quaternion.x,
                rotationY: this.selectedGroup.quaternion.y,
                rotationZ: this.selectedGroup.quaternion.z
            };
        } else {
            return {};
        }
    }

    changeShowOrigin() {
        return this.selectedModel && this.selectedModel.changeShowOrigin();
    }

    hideSelectedModel() {
        const models = this.getSelectedModelArray();
        models.forEach((model) => {
            model.visible = false;
        });
        return this.getState();
    }

    showSelectedModel() {
        const models = this.getSelectedModelArray();
        models.forEach((model) => {
            model.visible = true;
        });
        return this.getState();
    }

    removeSelectedModel() {
        const selectedArray = this.getSelectedModelArray();
        if (selectedArray.length > 0) {
            selectedArray.forEach((selected) => {
                if (selected) {
                    selected.meshObject.removeEventListener('update', this.onModelUpdate);
                    this.models = this.models.filter(model => model !== selected);
                    this.selectedGroup.remove(selected.meshObject);
                }
            });
        }
        this.onDataChangedCallback();
        return this._getEmptyState();
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
                    const pivot = origArray.pop();
                    const length = origArray.length;
                    for (let i = 0; i < length; i++) {
                        if (computeDis(origArray[i]) <= computeDis(pivot)) {
                            left.push(origArray[i]);
                        } else {
                            right.push(origArray[i]);
                        }
                    }
                    return [].concat(quickSort(left), pivot, quickSort(right));
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
    }

    removeHiddenMeshObjects() {
        this.object.children.splice(0);
        this.models.forEach((item) => {
            if (item.visible === true) {
                this.object.children.push(item.meshObject);
            }
        });
    }

    addHiddenMeshObjects() {
        this.object.children.splice(0);
        this.models.forEach((item) => {
            this.object.children.push(item.meshObject);
        });
    }

    setConvexGeometry(uploadName, convexGeometry) {
        const models = this.models.filter(m => m.uploadName === uploadName);
        if (models.length) {
            for (let idx = 0; idx < models.length; idx++) {
                const model = models[idx];
                model.setConvexGeometry(convexGeometry);
            }
        }
    }

    updateBoundingBox(bbox) {
        this._bbox = bbox;
    }

    removeAllModels() {
        if (this.hasModel()) {
            this.unselectAllModels();
            const models = this.getModels();
            for (const model of models) {
                this.object.remove(model.meshObject);
                this.selectedGroup.remove(model.meshObject);
            }
            this.models.splice(0);
            return {
                selectedModelArray: this.selectedModelArray,
                selectedModelIDArray: this.selectedModelIDArray
            };
        }
        return this._getEmptyState();
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
            this.selectedGroup.remove(model.meshObject);
        }
        this.models.splice(0);
        for (const model of models) {
            const newModel = model.clone();
            newModel.meshObject.addEventListener('update', this.onModelUpdate);
            newModel.computeBoundingBox();
            this.models.push(newModel);
            this.object.add(newModel.meshObject);
        }
        return this._getEmptyState();
    }

    getModels() {
        const models = [];
        for (const model of this.models) {
            models.push(model);
        }
        return models;
    }


    calculateSelectedGroupPosition() {
        const maxObjectPosition = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, 0);
        const minObjectPosition = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, 0);
        this.selectedGroup.children.forEach((meshObject) => {
            maxObjectPosition.x = Math.max(meshObject.position.x, maxObjectPosition.x);
            maxObjectPosition.y = Math.max(meshObject.position.y, maxObjectPosition.y);
            maxObjectPosition.z = Math.max(meshObject.position.z, maxObjectPosition.z);

            minObjectPosition.x = Math.min(meshObject.position.x, minObjectPosition.x);
            minObjectPosition.y = Math.min(meshObject.position.y, minObjectPosition.y);
        });
        if (this.selectedGroup.children.length > 1) {
            return new Vector3(
                (maxObjectPosition.x + minObjectPosition.x) / 2,
                (maxObjectPosition.y + minObjectPosition.y) / 2,
                0
            );
        } else if (this.selectedGroup.children.length === 1) {
            return new Vector3(
                maxObjectPosition.x,
                maxObjectPosition.y,
                0
            );
        } else {
            return new Vector3(
                0,
                0,
                0
            );
        }
    }

    applySelectedObjectParentMatrix() {
        const newPosition = this.calculateSelectedGroupPosition(this.selectedGroup);
        this.selectedGroup.position.copy(newPosition);
        this.selectedGroup.updateMatrix();
        this.selectedGroup.children.forEach((eachMeshObject) => {
            eachMeshObject.applyMatrix(new Matrix4().getInverse(this.selectedGroup.matrix));
        });
    }

    removeSelectedObjectParentMatrix() {
        if (this.selectedGroup.children.length > 0) {
            this.selectedGroup.children.forEach((eachMeshObject) => {
                eachMeshObject.applyMatrix(this.selectedGroup.matrix);
            });
        }
        this.selectedGroup.scale.copy(new Vector3(1, 1, 1));
        this.selectedGroup.updateMatrix();
    }

    selectModelById(modelArray, isMultiSelect = false) {
        let state;
        this.removeSelectedObjectParentMatrix();
        if (isMultiSelect === false) {
            this.selectedModelArray = [];
            this.selectedModelIDArray = [];
            this.models.forEach((item) => {
                item.isSelected = false;
                item.meshObject.material = materialNormal;
                this.object.add(item.meshObject);
            });
        }
        modelArray.forEach((model) => {
            const objectIndex = this.selectedModelArray.indexOf(model);
            if (objectIndex === -1) {
                model.isSelected = true;
                model.meshObject.material = materialSelected;
                this.selectedModelArray.push(model);
                this.selectedGroup.add(model.meshObject);
                if (model.estimatedTime) {
                    this.estimatedTime = model.estimatedTime;
                }
                model.computeBoundingBox();
            } else {
                model.isSelected = false;
                model.meshObject.material = materialNormal;
                this.selectedModelArray.splice(objectIndex, 1);
                this.object.add(model.meshObject);
                if (model.estimatedTime) {
                    this.estimatedTime = model.estimatedTime;
                }
                model.computeBoundingBox();
            }
        });
        this.applySelectedObjectParentMatrix();
        if (this.selectedModelArray.length > 0) {
            const modelState = this.getState();
            state = modelState;
        } else {
            state = this._getEmptyState();
        }
        this.onDataChangedCallback();

        return state;
    }

    selectMultiModel(modelArray) {
        this.selectedModelArray = [];
        let state;
        this.models.forEach((model) => {
            model.isSelected = false;
            model.meshObject.material = materialNormal;
            this.object.add(model.meshObject);
        });
        if (modelArray.length) {
            modelArray.forEach((model) => {
                if (model) {
                    model.isSelected = true;
                    model.meshObject.material = materialSelected;
                    this.selectedModelArray.push(model);
                    this.selectedGroup.add(model.meshObject);
                    if (model.estimatedTime) {
                        this.estimatedTime = model.estimatedTime;
                    }
                    model.computeBoundingBox();
                }
            });
        }
        if (this.selectedModelArray.length > 0) {
            const modelState = this.getState();
            state = modelState;
        } else {
            state = this._getEmptyState();
        }
        this.onDataChangedCallback();
        this.emit('select');
        return state;
    }

    selectAllModels() {
        this.selectedModelArray = this.models;
        this.selectedModelIDArray = [];
        this.removeSelectedObjectParentMatrix();
        this.selectedModelArray.forEach((item) => {
            item.isSelected = true;
            item.meshObject.material = materialSelected;
            this.selectedGroup.add(item.meshObject);
            this.selectedModelIDArray.push(item.modelID);
        });
        this.applySelectedObjectParentMatrix();

        this.onDataChangedCallback();

        return {
            selectedModelArray: this.selectedModelArray,
            selectedGroup: this.selectedGroup,
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            selectedModelIDArray: this.selectedModelIDArray
        };
    }

    unselectAllModels() {
        this.selectedModelArray = [];
        this.selectedModelIDArray = [];
        this.selectedGroup.children.splice(0);
        this.models.forEach((model) => {
            this.object.add(model.meshObject);
        });
        // this.removeSelectedObjectParentMatrix();
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
            model.meshObject.position.y = 0;
            const point = this._computeAvailableXY(model);
            model.meshObject.position.x = point.x;
            model.meshObject.position.y = point.y;
            // this.add(model);
            this.models.push(model);
            this.object.add(model.meshObject);
        }
        this._checkAnyModelOverstepped();
        // return this._getEmptyState();
        return this.getState();
    }

    duplicateSelectedModel(modelID) {
        this.removeSelectedObjectParentMatrix();
        const selectedArray = this.getSelectedModelArray();
        if (selectedArray.length > 0) {
            this.selectedModelArray = [];
            this.selectedModelIDArray = [];
            this.models.forEach((model) => {
                model.isSelected = false;
                model.meshObject.material = materialNormal;
                this.object.add(model.meshObject);
            });
        }
        selectedArray.forEach((selected) => {
            if (selected) {
                const model = selected.clone();
                selected.isSelected = false;
                selected.meshObject.material = materialNormal;
                if (selected.sourceType === '3d') {
                    const selectedConvexGeometry = selected.convexGeometry.clone();
                    model.convexGeometry = selectedConvexGeometry;
                    model.stickToPlate();
                    model.meshObject.position.x = 0;
                    model.meshObject.position.y = 0;
                    const point = this._computeAvailableXY(model);
                    model.meshObject.position.x = point.x;
                    model.meshObject.position.y = point.y;
                    model.meshObject.updateMatrix();


                    model.modelID = modelID || uuid.v4();
                } else {
                    model.meshObject.addEventListener('update', this.onModelUpdate);
                    model.modelID = modelID || uuid.v4();
                    model.computeBoundingBox();
                    model.updateTransformation({
                        positionX: 0,
                        positionY: 0,
                        positionZ: 0
                    });
                }
                model.updateModelName(this.createNewModelName(model));

                this.models.push(model);
                this.object.add(model.meshObject);
                model.isSelected = true;
                model.meshObject.material = materialSelected;
                this.selectedModelArray.push(model);
                this.selectedGroup.add(model.meshObject);
            }
        });
        this.applySelectedObjectParentMatrix();

        return {
            selectedModelArray: this.selectedModelArray,
            selectedModelIDArray: this.selectedModelIDArray,
            hasModel: this.hasModel(),
            isAnyModelOverstepped: this._checkAnyModelOverstepped()
        };
    }

    pasteModelArray() {
        this.removeSelectedObjectParentMatrix();
        const copiedArray = this.copiedModelArray;
        if (copiedArray.length > 0) {
            this.selectedModelArray = [];
            this.selectedModelIDArray = [];
            this.models.forEach((model) => {
                model.isSelected = false;
                model.meshObject.material = materialNormal;
                this.object.add(model.meshObject);
            });
        }

        copiedArray.forEach((selected) => {
            if (selected) {
                const model = selected.clone();
                this.object.add(selected.meshObject);
                if (selected.sourceType === '3d') {
                    const selectedConvexGeometry = selected.convexGeometry.clone();
                    model.convexGeometry = selectedConvexGeometry;
                    model.stickToPlate();
                    model.meshObject.position.x = 0;
                    model.meshObject.position.y = 0;
                    const point = this._computeAvailableXY(model);
                    model.meshObject.position.x = point.x;
                    model.meshObject.position.y = point.y;
                    // Once the position of selectedGroup is changed, updateMatrix must be called
                    model.meshObject.updateMatrix();
                    model.modelID = uuid.v4();
                }
                model.updateModelName(this.createNewModelName(model));
                this.models.push(model);

                model.isSelected = true;
                model.meshObject.material = materialSelected;
                this.selectedModelArray.push(model);
                this.selectedModelIDArray.push(model.modelID);
                this.selectedGroup.add(model.meshObject);
            }
        });
        this.applySelectedObjectParentMatrix();


        this.onModelAfterTransform();

        if (copiedArray.length > 0) {
            return {
                selectedModelArray: this.selectedModelArray,
                selectedModelIDArray: this.selectedModelIDArray,
                selectedGroup: this.selectedGroup,
                hasModel: this.hasModel(),
                isAnyModelOverstepped: this._checkAnyModelOverstepped()
            };
        } else {
            return null;
        }
    }


    getSelectedModel() {
        if (this.selectedModel) {
            return this.selectedModel;
        }

        return this.MOCK_MODEL;
    }

    getSelectedModelArray() {
        return this.selectedModelArray;
    }

    copyModelArray() {
        this.copiedModelArray = this.selectedModelArray;
    }

    copyAllModel(allModel) {
        this.copiedModelArray = allModel;
    }

    clearSelectedModelArray() {
        this.selectedModelArray = [];
    }

    updateSelectedMode(mode, config, processImageName) {
        this.selectedModel.processMode(mode, config, processImageName);
        return this._getEmptyState();
    }

    generateModel(modelInfo) {
        this.addModel(modelInfo);
        return this._getEmptyState();
    }

    updateSelectedSource(source) {
        if (this.selectedModel) {
            this.selectedModel.updateSource(source);
        }
    }


    layFlatSelectedModel() {
        const selected = this.getSelectedModelArray();
        if (selected.length === 0) {
            return null;
        }
        selected.forEach((item) => {
            item.layFlat();
            item.computeBoundingBox();
        });
        return this.getState();
    }

    onModelTransform() {
        this.selectedModelIDArray = [];
        this.selectedModelArray.forEach((item) => {
            this.selectedModelIDArray.push(item.modelID);
            item.onTransform();
        });
        const { sourceType, mode, transformation, boundingBox, originalName } = this.selectedModelArray[0];
        return {
            sourceType: sourceType,
            originalName: originalName,
            mode: mode,
            selectedModelIDArray: this.selectedModelIDArray,
            isAnyModelOverstepped: this._checkAnyModelOverstepped(),
            transformation: { ...transformation },
            boundingBox, // only used in 3dp
            hasModel: this.hasModel()
        };
    }

    updateSelectedModelTransformation(transformation) {
        const { positionX, positionY, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, uniformScalingState } = transformation;

        if (positionX !== undefined) {
            this.selectedGroup.position.setX(transformation.positionX);
        }
        if (positionY !== undefined) {
            this.selectedGroup.position.setY(transformation.positionY);
        }
        if (this.selectedGroup.uniformScalingState === true) {
            if (scaleX !== undefined) {
                this.selectedGroup.scale.set(transformation.scaleX, transformation.scaleX, transformation.scaleX);
            }
            if (scaleY !== undefined) {
                this.selectedGroup.scale.set(transformation.scaleY, transformation.scaleY, transformation.scaleY);
            }
            if (scaleZ !== undefined) {
                this.selectedGroup.scale.set(transformation.scaleZ, transformation.scaleZ, transformation.scaleZ);
            }
        } else {
            if (scaleX !== undefined) {
                this.selectedGroup.scale.setX(transformation.scaleX);
            }
            if (scaleY !== undefined) {
                this.selectedGroup.scale.setY(transformation.scaleY);
            }
            if (scaleZ !== undefined) {
                this.selectedGroup.scale.setZ(transformation.scaleZ);
            }
        }
        if (uniformScalingState !== undefined) {
            this.selectedGroup.uniformScalingState = uniformScalingState;
        }
        if (rotationX !== undefined) {
            this.selectedGroup.quaternion.x = transformation.rotationX;
        }
        if (rotationY !== undefined) {
            this.selectedGroup.quaternion.y = transformation.rotationY;
        }
        if (rotationZ !== undefined) {
            this.selectedGroup.quaternion.z = transformation.rotationZ;
        }
    }

    // model transformation triggered by controls
    onModelAfterTransform() {
        const selectedModelArray = this.selectedModelArray;
        selectedModelArray.forEach((selected) => {
            if (selected.sourceType === '3d') {
                selected.stickToPlate();
            }
            selected.computeBoundingBox();
        });
        if (selectedModelArray.length === 0) {
            return null;
        } else {
            return this.getState();
        }
    }

    updateSelectedConfig(config, processImageName) {
        this.selectedModel.updateConfig(config, processImageName);
    }

    showAllModelsObj3D() {
        this.object.visible = true;
        for (const model of this.getModels()) {
            model.updateVisible(true);
        }
    }

    _computeAvailableXY(model) {
        if (this.getModels().length === 0) {
            return { x: 0, y: 0 };
        }

        model.computeBoundingBox();
        const modelBox3 = model.boundingBox;
        const box3Arr = [];
        for (const m of this.getModels()) {
            m.computeBoundingBox();
            box3Arr.push(m.boundingBox);
        }

        const length = Math.max(this._bbox.max.x - this._bbox.min.x, this._bbox.max.y - this._bbox.min.y);
        const step = 5; // min distance of models &
        const z = 1;
        for (let stepCount = 1; stepCount < length / step; stepCount++) {
            // check the 4 positions on x&z axis first
            const positionsOnAxis = [
                new Vector3(0, stepCount * step, z),
                new Vector3(0, -stepCount * step, z),
                new Vector3(stepCount * step, 0, z),
                new Vector3(-stepCount * step, 0, z)
            ];
            // clock direction
            const p1 = new Vector3(stepCount * step, stepCount * step, z);
            const p2 = new Vector3(stepCount * step, -stepCount * step, z);
            const p3 = new Vector3(-stepCount * step, -stepCount * step, z);
            const p4 = new Vector3(-stepCount * step, stepCount * step, z);
            const positionsOnSquare = this._getCheckPositions(p1, p2, p3, p4, step);
            const checkPositions = [].concat(positionsOnAxis);

            // no duplicates
            // TODO: what is this?
            for (const item of positionsOnSquare) {
                if (!(item.x === 0 || item.y === 0)) {
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
                modelBox3Clone.translate(new Vector3(position.x, position.y, 0));
                if (modelBox3Clone.min.x < this._bbox.min.x
                    || modelBox3Clone.max.x > this._bbox.max.x
                    || modelBox3Clone.min.y < this._bbox.min.y
                    || modelBox3Clone.max.y > this._bbox.max.y) {
                    continue;
                }
                if (!this._isBox3IntersectOthers(modelBox3Clone, box3Arr)) {
                    return { x: position.x, y: position.y };
                }
            }
        }
        // if there is not suitable position to sit on the flat
        // set the model to the right out of the flat
        for (let stepCount = length / 2; stepCount < length * 3; stepCount += step) {
            const modelBox3Clone = modelBox3.clone();
            modelBox3Clone.translate(new Vector3(stepCount, 0, 0));
            if (!this._isBox3IntersectOthers(modelBox3Clone, box3Arr)) {
                return { x: stepCount, y: 0 };
            }
        }
        // too far from flat, get a result in the center
        return { x: 0, y: 0 };
    }

    getAllBoundingBox() {
        const boundingBox = { max: { x: null, y: null, z: null }, min: { x: null, y: null, z: null } };
        for (const model of this.models) {
            let modelBoundingBox;
            if (model.headType === '3dp') {
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
                model.setOversteppedAndSelected(overstepped, model.isSelected);
                isAnyModelOverstepped = (isAnyModelOverstepped || overstepped);
            }
        }
        return isAnyModelOverstepped;
    }

    _checkOverstepped(model) {
        model.computeBoundingBox();
        return this._bbox && !this._bbox.containsBox(model.boundingBox);
    }

    hasModel() {
        return this.getModels().length > 0;
    }

    // not include p1, p2
    _getPositionBetween(p1, p2, step) {
        const positions = [];
        if (p1.x !== p2.x) {
            const y = p1.y;
            const minX = Math.min(p1.x, p2.x) + step;
            const maxX = Math.max(p1.x, p2.x);
            for (let x = minX; x < maxX; x += step) {
                positions.push(new Vector3(x, y, 1));
            }
        } else if (p1.y !== p2.y) {
            const x = p1.x;
            const minY = Math.min(p1.y, p2.y) + step;
            const maxY = Math.max(p1.y, p2.y);
            for (let y = minY; y < maxY; y += step) {
                positions.push(new Vector3(x, y, 1));
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


    addModel(modelInfo, relatedModels = {}) {
        const model = new Model(modelInfo, this);
        model.updateModelName(this.createNewModelName(model));
        model.meshObject.addEventListener('update', this.onModelUpdate);
        model.generateModelObject3D();
        model.processMode(modelInfo.mode, modelInfo.config);

        if (model.sourceType === '3d' && model.transformation.positionX === 0 && model.transformation.positionY === 0) {
            model.stickToPlate();
            const point = this._computeAvailableXY(model);
            model.meshObject.position.x = point.x;
            model.meshObject.position.y = point.y;
        }
        model.computeBoundingBox();


        // add to group and select
        this.models.push(model);
        this.object.add(model.meshObject);
        this.selectModelById([model]);


        this.emit('add', model);
        model.setRelatedModels(relatedModels);
        // refresh view
        this.onDataChangedCallback();

        return model;
    }

    modelChanged() {
        this.onDataChangedCallback();
    }
}

ModelGroup.prototype.MOCK_MODEL = {
    mock: true,
    sourceType: '',
    mode: '',
    config: {},
    transformation: {
        rotationZ: 0,
        width: 0,
        height: 0,
        positionX: 0,
        positionY: 0,
        flip: 0
    }
};

export default ModelGroup;
