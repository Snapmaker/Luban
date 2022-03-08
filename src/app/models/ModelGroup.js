import { Sphere, SphereBufferGeometry, MeshStandardMaterial, Vector3, Group, Matrix4, BufferGeometry, MeshPhongMaterial, Mesh, DoubleSide, Float32BufferAttribute, MeshBasicMaterial } from 'three';
import EventEmitter from 'events';
import { CONTAINED, INTERSECTED, NOT_INTERSECTED } from 'three-mesh-bvh';
// import { EPSILON } from '../../constants';
import { v4 as uuid } from 'uuid';
import _ from 'lodash';
import i18n from '../lib/i18n';

import Model from './ThreeBaseModel';
import ThreeModel from './ThreeModel';
import SvgModel from './SvgModel';
import { EPSILON, SELECTEVENT } from '../constants';

import ThreeUtils from '../three-extensions/ThreeUtils';
import ThreeGroup from './ThreeGroup';
import PrimeTowerModel from './PrimeTowerModel';
import { HEAD_PRINTING } from '../../server/constants';
import { calculateUvVector } from '../lib/threejs/ThreeStlCalculation';

const EVENTS = {
    UPDATE: { type: 'update' }
};
const INDEXMARGIN = 0.02;
const SUPPORT_AVAIL_AREA_COLOR = [0.5725490196078431, 0.32941176470588235, 0.8705882352941177];
const SUPPORT_ADD_AREA_COLOR = [0.2980392156862745, 0, 0.5098039215686274];
const SUPPORT_UNAVAIL_AREA_COLOR = [0.9, 0.9, 0.9];
const AVAIL = -1, NONE = 0, FACE = 1/* , POINT = 2, LINE = 3 */;

class ModelGroup extends EventEmitter {
    groupsChildrenMap = new Map();

    brushMesh = null;

    constructor(headType) {
        super();
        this.headType = headType;
        // this.object = new Object3D();
        this.object = new Group();
        this.models = [];
        this.selectedGroup = new Group();
        this.selectedGroup.uniformScalingState = true;
        this.selectedGroup.boundingBox = [];
        this.selectedGroup.shouldUpdateBoundingbox = true;
        this.object.add(this.selectedGroup);
        this.selectedModelArray = [];
        this.clipboard = [];
        this.estimatedTime = 0;
        // this.selectedModelIDArray = [];

        this.candidatePoints = null;
        this._bbox = null;
        this.selectedModelConvexMeshGroup = new Group();
        // The selectedToolPathModelIDs is used to generate the toolpath
        this.selectedToolPathModelIDs = [];
    }

    // model factory
    newModel(modelInfo) {
        if (this.headType === 'printing') {
            return new ThreeModel(modelInfo, this);
        } else {
            return new SvgModel(modelInfo, this);
        }
    }

    setMaterials(materials) {
        this.materials = materials;
    }

    setDataChangedCallback(handler, update) {
        this.onDataChangedCallback = handler;
        if (update) {
            this.primeTowerHeightCallback = update;
        }
    }

    // TODO: save last value and compare changes
    get selectedModelIDArray() {
        return this.selectedModelArray.map(m => m.modelID);
    }

    _getEmptyState = () => {
        return {
            mode: '',
            hasModel: this.hasModel(),
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

    getState(shouldCheckOverStep = true) {
        const baseState = {
            allModelIDs: this.models.map(m => m.modelID),
            selectedModelArray: this.selectedModelArray,
            selectedModelIDArray: this.selectedModelIDArray,
            estimatedTime: this.estimatedTime,
            hasModel: this.hasModel()
        };
        if (this.headType === 'printing' && shouldCheckOverStep) {
            return {
                ...baseState,
                isAnyModelOverstepped: this._checkAnyModelOversteppedOrSelected()
            };
        } else {
            return baseState;
        }
    }

    /**
     * Note: for performance consideration, don't call this method in render.
     */
    getBoundingBox() {
        return ThreeUtils.computeBoundingBox(this.object);
    }

    /**
     * Note: get valid area
     */
    getValidArea() {
        return this._bbox;
    }

    getModel(modelID) {
        return this.models.find(d => d.modelID === modelID);
    }

    getModelByModelName(modelName, models = this.models) {
        return models.find(d => {
            if (d.modelName === modelName) {
                return true;
            } else if (d.children && d.children.length > 0) {
                return this.getModelByModelName(modelName, d.children);
            }
            return false;
        });
    }

    // TODO: Unify method return type, it causes unnecessary calculations.
    getSelectedModelTransformation() {
        // todo
        if (this.selectedModelArray.length === 1) {
            return this.selectedModelArray[0].transformation;
        }
        if (this.selectedModelArray.length > 0) {
            return {
                positionX: this.selectedGroup.position.x,
                positionY: this.selectedGroup.position.y,
                scaleX: this.selectedGroup.scale.x,
                scaleY: this.selectedGroup.scale.y,
                scaleZ: this.selectedGroup.scale.z,
                uniformScalingState: this.selectedGroup.uniformScalingState,
                rotationX: this.selectedGroup.rotation.x,
                rotationY: this.selectedGroup.rotation.y,
                rotationZ: this.selectedGroup.rotation.z,
            };
        } else {
            return {};
        }
    }

    getSelectedModelTransformationForPrinting() {
        if (this.selectedModelArray.length > 0) {
            return {
                positionX: this.selectedGroup.position.x,
                positionY: this.selectedGroup.position.y,
                positionZ: this.selectedGroup.position.z,
                scaleX: this.selectedGroup.scale.x,
                scaleY: this.selectedGroup.scale.y,
                scaleZ: this.selectedGroup.scale.z,
                uniformScalingState: this.selectedGroup.uniformScalingState,
                rotationX: this.selectedGroup.rotation.x,
                rotationY: this.selectedGroup.rotation.y,
                rotationZ: this.selectedGroup.rotation.z
            };
        } else {
            return {};
        }
    }

    // Calculate selectedGroup's BBox in modelGroup
    getSelectedModelBBoxDes() {
        const selectedGroup = this.selectedGroup;
        if (selectedGroup.children.length > 0 && selectedGroup.shouldUpdateBoundingbox) {
            const whd = new Vector3(0, 0, 0);
            ThreeUtils.computeBoundingBox(this.selectedGroup).getSize(whd);
            return `${whd.x.toFixed(1)} × ${whd.y.toFixed(1)} × ${whd.z.toFixed(1)} mm`;
            // width-depth-height
        } else {
            return '';
        }
    }

    // get selected Model bounding box width & height & depth
    getSelectedModelBBoxWHD() {
        const whd = new Vector3(0, 0, 0);
        ThreeUtils.computeBoundingBox(this.selectedGroup).getSize(whd);
        return {
            x: whd.x,
            y: whd.y,
            z: whd.z
        };
    }

    hasAnyModelVisible() {
        return this.models.filter(m => !m.supportTag).some((model) => model.visible);
    }

    toggleModelsVisible(visible, models) {
        models.forEach((model) => {
            model.visible = visible;
            model.meshObject.visible = visible;
            if (model instanceof ThreeGroup) {
                model.traverse((subModel) => {
                    subModel.visible = visible;
                    subModel.meshObject.visible = visible;
                });
            } else if (model.parent && model.parent instanceof ThreeGroup) {
                let parentVisible = false;
                model.parent.traverse((subModel) => {
                    parentVisible = subModel.visible || parentVisible;
                });
                model.parent.visible = parentVisible;
                model.parent.meshObject.visible = parentVisible;
            }
        });
        // Make the reference of 'models' change to re-render
        this.models = [...this.models];
        return this.getState();
    }

    hideSelectedModel(targetModels = null) {
        const models = targetModels || this.getSelectedModelArray();
        return this.toggleModelsVisible(false, models);
    }

    showSelectedModel(targetModels = null) {
        const models = targetModels || this.getSelectedModelArray();
        return this.toggleModelsVisible(true, models);
    }

    _removeSelectedModels() {
        const selectedArray = this.getSelectedModelArray();
        selectedArray.forEach((selected) => {
            this.removeModel(selected);
        });
    }

    removeModel(model, loop = false) {
        if (model.type === 'primeTower') return;
        if (!(model instanceof SvgModel)) {
            model.setSelected(false);
        }
        if (model instanceof ThreeGroup) {
            model.children.forEach((child) => {
                this.removeModel(child, true);
            });
        }
        if (!model.supportTag && model instanceof ThreeModel) { // remove support children
            this.models
                .filter(i => i.supportTag && i.target === model)
                .map(m => this.removeModel(m));
        }
        if (model.meshObject && model.parent instanceof ThreeGroup) {
            // Reset the model to be deleted to the object
            // Then update the tran of the model to the coordinates based on the world coordinate system
            ThreeUtils.setObjectParent(model.meshObject, this.object);
            model.onTransform();
        }
        if (model.meshObject && model.meshObject.parent) {
            model.meshObject.parent.remove(model.meshObject);
        }
        if (model.sourceType !== '3d') {
            model.meshObject.remove(model.modelObject3D);
            model.meshObject.remove(model.processObject3D);
        }
        model.meshObject.removeEventListener('update', this.onModelUpdate);
        if (model.parent instanceof ThreeGroup) {
            const groupIndex = this.models.findIndex(m => m.modelID === model.parent.modelID);
            if (this.models[groupIndex].children.length === 1) {
                this.models[groupIndex].onTransform();
                this.models.splice(groupIndex, 1);
            } else {
                this.models[groupIndex].children = this.models[groupIndex].children.filter(subModel => subModel !== model);
                if (!loop) {
                    // When deleting a group, do not do stickToPlate again. To avoid updating the center point of the group
                    // Otherwise, the z-axis of the model in the group being deleted will be affected
                    this.stickToPlateAndCheckOverstepped(this.models[groupIndex]);
                }
                this.models[groupIndex].updateGroupExtruder();
            }
            this.models = this.models.concat();
        } else {
            this.models = this.models.filter(item => item !== model);
        }
        this.modelChanged();
        model.sourceType === '3d' && this.updatePrimeTowerHeight();
    }

    // remove selected models' supports
    // remove all support if no model selected
    /**
     * deprecated
     */
    removeAllManualSupport() {
        if (this.selectedModelArray.length) {
            this.traverseModels(this.selectedModelArray, target => {
                this.traverseModels(this.models, m => {
                    if (m.supportTag === true && m.target === target) {
                        this.removeModel(m);
                    }
                });
            });
        } else {
            this.traverseModels(this.models, m => {
                if (m.supportTag === true) {
                    this.removeModel(m);
                }
            });
        }
    }

    /**
     * Remove selected models and reset selected state.
     */
    // todo, remove mesh obj in 2d
    removeSelectedModel() {
        this._removeSelectedModels();
        this.unselectAllModels();
        return this.getState();
    }

    _removeAllModels() {
        const models = this.getModels();
        for (const model of models) {
            model.meshObject.removeEventListener('update', this.onModelUpdate);
            model.meshObject.parent && model.meshObject.parent.remove(model.meshObject);
        }
        this.models = [];
    }

    /**
     * Remove all models.
     */
    removeAllModels() {
        this.unselectAllModels();
        this._removeAllModels();

        this.modelChanged();
        this.updatePrimeTowerHeight();
        return this._getEmptyState();
    }

    bringSelectedModelToFront() {
        const selected = this.getSelectedModel();
        const sorted = this.getSortedModelsByPositionZ().filter(model => model !== selected);
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].updateTransformation({ 'positionZ': (i + 1) * INDEXMARGIN });
        }
        selected.updateTransformation({ 'positionZ': (sorted.length + 1) * INDEXMARGIN });
    }

    // keep the origin order
    sendSelectedModelToBack() {
        const selected = this.getSelectedModel();
        const sorted = this.getSortedModelsByPositionZ().filter(model => model !== selected);
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].updateTransformation({ 'positionZ': (i + 2) * INDEXMARGIN });
        }
        selected.updateTransformation({ 'positionZ': INDEXMARGIN });
    }

    resetModelsPositionZByOrder() {
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].updateTransformation({ 'positionZ': (i + 1) * INDEXMARGIN });
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


    setConvexGeometry(uploadName, convexGeometry) {
        const models = this.models.filter(m => m.uploadName === uploadName);
        if (models.length) {
            for (let idx = 0; idx < models.length; idx++) {
                const model = models[idx];
                model.setConvexGeometry(convexGeometry);
            }
        }
        this.emit('set-convex');
    }

    updateBoundingBox(bbox) {
        this._bbox = bbox;
        this._checkAnyModelOversteppedOrSelected();
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

    getModels() {
        const models = [];
        for (const model of this.models) {
            models.push(model);
        }
        return models;
    }


    calculateSelectedGroupPosition() {
        const boundingBoxTemp = ThreeUtils.computeBoundingBox(this.selectedGroup);
        if (this.selectedGroup.children.length >= 1) {
            return new Vector3(
                (boundingBoxTemp.max.x + boundingBoxTemp.min.x) / 2,
                (boundingBoxTemp.max.y + boundingBoxTemp.min.y) / 2,
                boundingBoxTemp.max.z / 2
            );
        } else {
            return new Vector3(
                0,
                0,
                0
            );
        }
    }

    /**
     * used only for laser/cnc
     */
    addSelectedModels(modelArray) {
        this.selectedGroup = new Group();
        for (const model of modelArray) {
            if (!this.selectedModelArray.includes(model)) {
                if (!model) {
                    console.trace('modelGroup, addSelectedModels', model);
                    window.alert('blank');
                }
                model && this.selectedModelArray.push(model);
            }
        }
        // TODO: why?
        this.selectedModelArray = [...this.selectedModelArray];

        let state;
        if (this.selectedModelArray.length > 0) {
            const modelState = this.getState();
            state = modelState;
        } else {
            state = this._getEmptyState();
        }
        this.emit('select', modelArray);
        this.modelChanged();

        return state;
    }

    emptySelectedModelArray() {
        this.selectedModelArray = [];
        this.modelChanged();
    }

    // TODO: model or modelID, need rename this method and add docs
    // use for widget
    // If isMultiSelect is equal to true, it is mutually exclusive
    selectModelById(modelID, isMultiSelect = false) {
        let selectModel = null;
        this.traverseModels(this.models, (model) => {
            if (model.modelID === modelID) {
                selectModel = model;
            }
        });

        if (isMultiSelect) {
            if (selectModel) {
                const objectIndex = this.selectedGroup.children.indexOf(selectModel.meshObject);
                if (objectIndex === -1) {
                    let isModelAcrossGroup = false;
                    for (const selectedModel of this.selectedModelArray) {
                        if (selectedModel.parent !== selectModel.parent) {
                            isModelAcrossGroup = true;
                            break;
                        }
                    }
                    if (isModelAcrossGroup) {
                        this.unselectAllModels();
                    }

                    if (selectModel.parent && this.selectedModelArray.length === selectModel.parent.children.length - 1) {
                        this.unselectAllModels();
                        this.addModelToSelectedGroup(selectModel.parent);
                    } else {
                        this.addModelToSelectedGroup(selectModel);
                    }
                } else {
                    this.removeModelFromSelectedGroup(selectModel);
                }
            }
        } else {
            this.unselectAllModels();
            if (selectModel) {
                if (selectModel?.parent?.children.length === 1) {
                    this.addModelToSelectedGroup(selectModel.parent);
                } else {
                    this.addModelToSelectedGroup(selectModel);
                }
            }
        }

        this.modelChanged();
        return this.getState(false);
    }

    traverseModels(models, callback) {
        models.forEach(model => {
            if (model instanceof ThreeGroup) {
                this.traverseModels(model.children, callback);
            }
            (typeof callback === 'function') && callback(model);
        });
    }

    /**
     * filter models, If the return value of callback is false, it will filter
     * @param {Array} models
     * @param {Function} callback Callback function has a parameter, which is an item of the loop
     * @returns new models
     */
    filterModels(models, callback) {
        return models.filter((model) => {
            if (model instanceof ThreeGroup) {
                return callback(model) !== false && this.filterModels(model.children, callback).length > 0;
            }
            if (typeof callback === 'function') {
                return callback(model);
            }
            return true;
        }).map((model) => {
            if (model instanceof ThreeGroup) {
                model.children = this.filterModels(model.children, callback);
                return model;
            }
            return model;
        });
    }

    findModelByID(modelID) {
        let model = null;
        this.traverseModels(this.models, (subModel) => {
            if (subModel.modelID === modelID) {
                model = subModel;
            }
        });
        return model;
    }

    findModelByMesh(meshObject) {
        for (const model of this.models) {
            if (model instanceof ThreeModel) {
                if (model.meshObject === meshObject || model.meshObject.children.indexOf(meshObject) > -1) {
                    return model;
                }
            } else if (model instanceof ThreeGroup) {
                const res = model.findModelInGroupByMesh(meshObject);
                if (res) {
                    return res;
                }
            }
        }
        return null;
    }

    // use for canvas
    selectMultiModel(intersect, selectEvent) {
        let model;
        switch (selectEvent) {
            case SELECTEVENT.UNSELECT:
                this.unselectAllModels();
                break;
            case SELECTEVENT.UNSELECT_ADDSELECT:
                model = this.findModelByMesh(intersect.object);
                if (model?.parent) {
                    // Unselect if there is only one model in the group
                    if (model.parent.children.length === 1 && model.parent.isSelected) {
                        this.unselectAllModelsInGroup(model.parent);
                        this.unselectAllModels();
                        break;
                    }
                    this.unselectAllModelsInGroup(model.parent);
                    this.unselectAllModels();
                } else {
                    this.unselectAllModels();
                }
                if (model) {
                    this.addModelToSelectedGroup(model);
                }
                break;
            case SELECTEVENT.ADDSELECT:
                model = this.findModelByMesh(intersect.object);
                if (model) {
                    // prevent selected models outside group
                    let isModelAcrossGroup = false;
                    for (const selectedModel of this.selectedModelArray) {
                        if (selectedModel.parent !== model.parent) {
                            isModelAcrossGroup = true;
                            break;
                        }
                    }
                    if (isModelAcrossGroup) {
                        this.unselectAllModels();
                    }
                    // cannot select model and support
                    // cannot select multi support
                    if (this.selectedModelArray.length && (
                        model instanceof ThreeModel && this.selectedModelArray[0] instanceof ThreeModel
                    ) && (this.selectedModelArray[0].supportTag !== model.supportTag || model.supportTag)) {
                        break;
                    }
                    // cannot select model and prime tower
                    if (this.selectedModelArray.length && _.some(this.selectedModelArray, (item) => {
                        return item.type !== model.type && (item.type === 'primeTower' || model.type === 'primeTower');
                    })) {
                        break;
                    }
                    // If all models in the group are selected, select group
                    if (model.parent && this.selectedModelArray.length === model.parent.children.length - 1) {
                        this.unselectAllModels();
                        this.addModelToSelectedGroup(model.parent);
                    } else {
                        this.addModelToSelectedGroup(model);
                    }
                }
                break;
            case SELECTEVENT.REMOVESELECT:
                model = this.findModelByMesh(intersect.object);
                if (model?.parent?.isSelected) {
                    this.removeModelFromSelectedGroup(model.parent);
                } else if (model?.isSelected) {
                    this.removeModelFromSelectedGroup(model);
                }
                break;
            default:
        }

        this.modelChanged();
        this.emit('select');
        return this.getState(false);
    }

    addModelToSelectedGroup(model) {
        if (!(model instanceof Model) || model.isSelected) return;
        if (model.type === 'primeTower' && !model.visible) return;
        model.setSelected(true);
        ThreeUtils.applyObjectMatrix(this.selectedGroup, new Matrix4().copy(this.selectedGroup.matrix).invert());
        this.selectedModelArray = [...this.selectedModelArray, model];

        ThreeUtils.setObjectParent(model.meshObject, this.selectedGroup);
        this.prepareSelectedGroup();
    }

    removeModelFromSelectedGroup(model) {
        if (!(model instanceof Model)) return;
        if (!this.selectedGroup.children.find(obj => obj === model.meshObject)) return;

        model.setSelected(false);
        ThreeUtils.applyObjectMatrix(this.selectedGroup, new Matrix4().copy(this.selectedGroup.matrix).invert());
        let parent = this.object;
        if (model.supportTag) { // support parent should be the target model
            parent = model.target.meshObject;
        }
        if (model.parent) {
            parent = model.parent.meshObject;
        }
        ThreeUtils.setObjectParent(model.meshObject, parent);
        this.selectedModelArray = [];
        this.selectedGroup.children.forEach((meshObject) => {
            let selectedModel = null;
            this.traverseModels(this.models, (subModel) => {
                if (subModel.meshObject === meshObject) {
                    selectedModel = subModel;
                }
            });
            this.selectedModelArray.push(selectedModel);
        });

        this.prepareSelectedGroup();
    }

    // refresh selected group matrix
    prepareSelectedGroup() {
        if (this.selectedModelArray.length === 1) {
            ThreeUtils.applyObjectMatrix(this.selectedGroup, new Matrix4().copy(this.selectedGroup.matrix).invert());
            ThreeUtils.liftObjectOnlyChildMatrix(this.selectedGroup);
            this.selectedGroup.uniformScalingState = this.selectedGroup.children[0].uniformScalingState;
        } else if (this.selectedModelArray.length > 1) {
            this.selectedGroup.uniformScalingState = true;
            const p = this.calculateSelectedGroupPosition(this.selectedGroup);
            // set selected group position need to remove children temporarily
            const children = [...this.selectedGroup.children];
            children.map(obj => ThreeUtils.removeObjectParent(obj));
            // only make the diff translation
            const oldPosition = new Vector3();
            this.selectedGroup.getWorldPosition(oldPosition);
            const matrix = new Matrix4().makeTranslation(p.x - oldPosition.x, p.y - oldPosition.y, p.z - oldPosition.z);
            ThreeUtils.applyObjectMatrix(this.selectedGroup, matrix);
            children.map(obj => ThreeUtils.setObjectParent(obj, this.selectedGroup));
        }
    }

    selectAllModels() {
        this.selectedModelArray = [];

        this.models.forEach((model) => {
            if (model.supportTag || model.type === 'primeTower') return;
            if (model.visible) {
                this.addModelToSelectedGroup(model);
            }
        });
        this.prepareSelectedGroup();
        this.modelChanged();

        return { // warning: this may not be correct
            selectedModelArray: this.selectedModelArray,
            selectedGroup: this.selectedGroup,
            selectedModelIDArray: this.selectedModelIDArray
        };
    }

    unselectAllModelsInGroup(group) {
        this.selectedModelArray = [];
        group.children.forEach((model) => {
            this.removeModelFromSelectedGroup(model);
        });
    }

    unselectAllModels() {
        const cancelSelectedModels = this.selectedModelArray.slice(0);
        this.selectedModelArray = [];
        if (this.headType === 'printing') {
            this.models.forEach((model) => {
                if (model instanceof ThreeGroup) {
                    model.children.forEach((subModel) => {
                        this.removeModelFromSelectedGroup(subModel);
                    });
                }
                this.removeModelFromSelectedGroup(model);
            });
        }
        return {
            recovery: () => {
                cancelSelectedModels.forEach(model => {
                    this.addModelToSelectedGroup(model);
                });
            }
        };
    }

    arrangeAllModels() {
        const models = this.getModels().filter(m => !m.supportTag);
        for (const model of models) {
            ThreeUtils.removeObjectParent(model.meshObject);
        }

        const arrangedModels = [];
        for (const model of models) {
            model.stickToPlate();
            model.meshObject.position.x = 0;
            model.meshObject.position.y = 0;
            const point = this._computeAvailableXY(model, arrangedModels);
            model.meshObject.position.x = point.x;
            model.meshObject.position.y = point.y;
            model.meshObject.updateMatrix();
            model.computeBoundingBox();

            arrangedModels.push(model);
            this.object.add(model.meshObject);
            if (this.selectedModelIDArray.includes(model.modelID)) {
                ThreeUtils.setObjectParent(model.meshObject, this.selectedGroup);
            }
        }
        this.prepareSelectedGroup();

        return this.getState();
    }

    duplicateSelectedModel(modelID) {
        const modelsToCopy = _.filter(this.selectedModelArray, (model) => model.type !== 'primeTower');
        if (modelsToCopy.length === 0) return this._getEmptyState();

        // Unselect all models
        this.unselectAllModels();

        modelsToCopy.forEach((model) => {
            const newModel = model.clone(this);

            if (model.isThreeModel || model instanceof ThreeGroup) {
                newModel.stickToPlate();
                newModel.modelName = this._createNewModelName(newModel);
                newModel.meshObject.position.x = 0;
                newModel.meshObject.position.y = 0;
                const point = this._computeAvailableXY(newModel);
                newModel.meshObject.position.x = point.x;
                newModel.meshObject.position.y = point.y;
                newModel.transformation.positionX = point.x;
                newModel.transformation.positionY = point.y;
                newModel.meshObject.updateMatrix();
                newModel.computeBoundingBox();

                newModel.modelID = modelID || uuid();
            } else {
                newModel.meshObject.addEventListener('update', this.onModelUpdate);
                newModel.modelID = modelID || uuid();
                newModel.computeBoundingBox();
                newModel.updateTransformation({
                    positionX: 0,
                    positionY: 0,
                    positionZ: 0
                });
            }

            this.models.push(newModel);
            this.object.add(newModel.meshObject);
            this.addModelToSelectedGroup(newModel);
        });

        return this.getState();
    }

    /**
     * Copy action: copy selected models (simply save the objects without their current positions).
     */
    copy() {
        this.clipboard = this.selectedModelArray.filter((model) => model.type !== 'primeTower').map(model => model.type !== 'primeTower' && model.clone(this));
    }

    /**
     * Paste action: paste(duplicate) models in clipboard.
     */
    paste() {
        const modelsToCopy = this.clipboard;
        if (modelsToCopy.length === 0) return this._getEmptyState();

        // Unselect all models
        this.unselectAllModels();

        // paste objects from clipboard
        // TODO: paste all objects from clipboard without losing their relative positions
        modelsToCopy.forEach((model) => {
            const newModel = model.clone(this);

            if (newModel.sourceType === '3d') {
                newModel.stickToPlate();
                newModel.modelName = this._createNewModelName(newModel);
                newModel.meshObject.position.x = 0;
                newModel.meshObject.position.y = 0;
                const point = this._computeAvailableXY(newModel);
                newModel.meshObject.position.x = point.x;
                newModel.meshObject.position.y = point.y;
                newModel.transformation.positionX = point.x;
                newModel.transformation.positionY = point.y;
                // Once the position of selectedGroup is changed, updateMatrix must be called
                newModel.meshObject.updateMatrix();
                newModel.computeBoundingBox();

                newModel.modelID = uuid();

                this.models.push(newModel);
                this.object.add(newModel.meshObject);
                this.addModelToSelectedGroup(newModel);
                this.updatePrimeTowerHeight();
            }
        });

        return this.getState();
    }

    // todo, remove it
    getSelectedModel() {
        if (this.selectedModelArray.length === 1) {
            return this.selectedModelArray[0];
        }
        // if (this.selectedModel) {
        //     return this.selectedModel;
        // }

        // todo
        return this.MOCK_MODEL;
    }

    isModelSelected(model) {
        return this.selectedGroup.children.includes(model.meshObject);
    }

    getSelectedModelArray() {
        return this.selectedModelArray;
    }

    updateSelectedMode(mode, config) {
        if (this.selectedModelArray.length === 1) {
            const selectedModel = this.selectedModelArray[0];
            selectedModel.processMode(mode, config);
        }
        return this._getEmptyState();
    }

    generateModel(modelInfo) {
        this.addModel(modelInfo);
        return this.getState();
    }

    updateSelectedSource(source) {
        // todo
        if (this.selectedModelArray.length === 1) {
            this.selectedModelArray[0].updateSource(source);
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

    autoRotateSelectedModel() {
        const selected = this.getSelectedModelArray();
        if (selected.length === 0) {
            return null;
        }

        selected.forEach((item) => {
            item.autoRotate();
            item.computeBoundingBox();
        });
        this.prepareSelectedGroup();
        return this.getState();
    }

    scaleToFitSelectedModel(size) {
        const selected = this.getSelectedModelArray();
        if (selected.length === 0) {
            return null;
        }
        selected.forEach((item) => {
            item.scaleToFit(size);
            item.computeBoundingBox();
        });
        this.prepareSelectedGroup();
        return this.getState();
    }

    resetSelectedModelTransformation() {
        const selected = this.getSelectedModelArray();
        if (selected.length === 0) {
            return null;
        }
        ThreeUtils.applyObjectMatrix(this.selectedGroup, new Matrix4().copy(this.selectedGroup.matrix).invert());

        selected.forEach((item) => {
            item.updateTransformation({
                scaleX: 1,
                scaleY: 1,
                scaleZ: 1,
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0
            });
            item instanceof ThreeGroup && item.stickToPlate();
        });
        this.prepareSelectedGroup();

        return this.getState();
    }

    onModelTransform() {
        try {
            // this.selectedModelIDArray.splice(0);
            this.selectedModelArray.forEach((model) => {
                if (model.parent && model.parent instanceof ThreeGroup) {
                    model.parent.children.forEach(subModel => {
                        subModel.onTransform();
                    });
                } else {
                    model.onTransform();
                }
                // this.selectedModelIDArray.push(item.modelID);
            });
            const { sourceType, mode, transformation, boundingBox, originalName } = this.selectedModelArray[0];
            return {
                sourceType: sourceType,
                originalName: originalName,
                mode: mode,
                selectedModelIDArray: this.selectedModelIDArray,
                transformation: { ...transformation },
                boundingBox, // only used in 3dp
                hasModel: this.hasModel()
            };
        } catch (error) {
            console.trace('onModelTransform error', error);
            return {};
        }
    }

    shouldApplyScaleToObjects(scaleX, scaleY, scaleZ) {
        return this.selectedGroup.children.every((meshObject) => {
            if (Math.abs(scaleX * meshObject.scale.x) < 0.01
                || Math.abs(scaleY * meshObject.scale.y) < 0.01
                || Math.abs(scaleZ * meshObject.scale.z) < 0.01
            ) {
                return false; // should disable
            }
            return true;
        });
    }

    updateModelsPositionBaseFirstModel(models) {
        if (models && models.length > 0) {
            const firstModel = models[0];
            const otherModels = models.filter(d => d.meshObject !== firstModel.meshObject);
            this.selectModelById(firstModel.modelID);
            this.updateSelectedGroupTransformation({ positionZ: firstModel.originalPosition.z });
            otherModels.forEach((model) => {
                const newPosition = {
                    positionX: model.originalPosition.x - firstModel.originalPosition.x + firstModel.transformation.positionX,
                    positionY: model.originalPosition.y - firstModel.originalPosition.y + firstModel.transformation.positionY,
                    positionZ: model.originalPosition.z,
                };
                this.selectModelById(model.modelID);
                this.updateSelectedGroupTransformation(newPosition);
            });
            this.unselectAllModels();
            models.forEach((item) => {
                this.addModelToSelectedGroup(item);
            });

            this.modelChanged();
        }
        const newPosition = this.selectedGroup?.position;
        return {
            positionX: newPosition.x,
            positionY: newPosition.y,
        };
    }

    updateModelPositionByPosition(modelID, position) {
        if (modelID) {
            const model = this.models.find(d => d.modelID === modelID);
            this.selectModelById(model.modelID);
            this.updateSelectedGroupTransformation({
                positionX: position.x,
                positionY: position.y,
                positionZ: position.z,
            });
            this.onModelAfterTransform();
        }
    }

    /**
     * Update transformation of selected group.
     *
     * Note that this function is used for 3DP only.
     *
     * Note that when newUniformScalingState is used to mirror and to reset
     *
     * TODO: Laser and CNC was moved to somewhere else.
     *
     * TODO: Is there a need to update the transform of the model?
     *
     * @param transformation
     */
    updateSelectedGroupTransformation(transformation, newUniformScalingState = this.selectedGroup.uniformScalingState) {
        const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, uniformScalingState } = transformation;
        const shouldUniformScale = newUniformScalingState ?? this.selectedGroup.uniformScalingState;

        if (positionX !== undefined) {
            this.selectedGroup.position.setX(positionX);
        }
        if (positionY !== undefined) {
            this.selectedGroup.position.setY(positionY);
        }
        if (positionZ !== undefined) {
            this.selectedGroup.position.setZ(positionZ);
        }
        // Note that this is new value, but not a proportion, not to change pls.
        if (shouldUniformScale) {
            if (scaleX !== undefined) {
                const { x, y, z } = this.selectedGroup.scale;
                if (this.shouldApplyScaleToObjects(scaleX, scaleX * y / x, scaleX * z / x)) {
                    this.selectedGroup.scale.set(scaleX, scaleX * y / x, scaleX * z / x);
                }
            }
            if (scaleY !== undefined) {
                const { x, y, z } = this.selectedGroup.scale;
                if (this.shouldApplyScaleToObjects(scaleY * x / y, scaleY, scaleY * z / y)) {
                    this.selectedGroup.scale.set(scaleY * x / y, scaleY, scaleY * z / y);
                }
            }
            if (scaleZ !== undefined) {
                const { x, y, z } = this.selectedGroup.scale;
                if (this.shouldApplyScaleToObjects(scaleZ * x / z, scaleZ * y / z, scaleZ)) {
                    this.selectedGroup.scale.set(scaleZ * x / z, scaleZ * y / z, scaleZ);
                }
            }
        } else {
            if (scaleX !== undefined) {
                const shouldApplyScaleToObjects = this.selectedGroup.children.every((meshObject) => {
                    if (Math.abs(scaleX * meshObject.scale.x) < 0.01
                    ) {
                        return false; // should disable
                    }
                    return true;
                });
                if (shouldApplyScaleToObjects) {
                    this.selectedGroup.scale.setX(scaleX);
                }
            }
            if (scaleY !== undefined) {
                const shouldApplyScaleToObjects = this.selectedGroup.children.every((meshObject) => {
                    if (Math.abs(scaleY * meshObject.scale.y) < 0.01
                    ) {
                        return false; // should disable
                    }
                    return true;
                });
                if (shouldApplyScaleToObjects) {
                    this.selectedGroup.scale.setY(scaleY);
                }
            }
            if (scaleZ !== undefined) {
                const shouldApplyScaleToObjects = this.selectedGroup.children.every((meshObject) => {
                    if (Math.abs(scaleZ * meshObject.scale.z) < 0.01
                    ) {
                        return false; // should disable
                    }
                    return true;
                });
                if (shouldApplyScaleToObjects) {
                    this.selectedGroup.scale.setZ(scaleZ);
                }
            }
        }
        if (uniformScalingState !== undefined) {
            this.selectedGroup.uniformScalingState = uniformScalingState;
            if (this.selectedGroup.children.length === 1) {
                this.selectedGroup.children[0].uniformScalingState = uniformScalingState;
            } else {
                // multi models scaling is wrong currently, disable it now
                // this.selectedGroup.children.forEach((item) => {
                //     item.uniformScalingState = uniformScalingState;
                // });
            }
        }
        if (rotationX !== undefined) {
            this.selectedGroup.rotation.x = rotationX;
        }
        if (rotationY !== undefined) {
            this.selectedGroup.rotation.y = rotationY;
        }
        if (rotationZ !== undefined) {
            this.selectedGroup.rotation.z = rotationZ;
        }
        this.selectedGroup.updateMatrix();
        this.selectedGroup.shouldUpdateBoundingbox = false;
        if (this.selectedModelArray.length === 1 && this.selectedModelArray[0].supportTag) {
            const model = this.selectedModelArray[0];
            const revert = ThreeUtils.removeObjectParent(model.meshObject);
            model.generateSupportGeometry();
            revert();
        }
        this.modelChanged();
        return this.getState();
    }

    // on 3dp scale
    updateSelectedGroupModelsVectorUv() {
        this.selectedGroup.children.forEach((mesh) => {
            if (mesh.geometry) {
                const newUv = calculateUvVector(this.selectedGroup.scale, mesh);
                mesh.geometry.setAttribute('uv', newUv);
            }
        });
    }

    // model transformation triggered by controls
    // Note: the function is only useful for 3D object operations on Canvas
    onModelAfterTransform(shouldStickToPlate = true) {
        const selectedModelArray = this.selectedModelArray;
        const { recovery } = this.unselectAllModels();
        // update model's boundingbox which has supports
        selectedModelArray.forEach((selected) => {
            if (selected.sourceType === '3d' && shouldStickToPlate) {
                if (selected.supportTag && selected.isSelected) {
                    selected.meshObject.parent.position.setZ(0);
                    selected.meshObject.parent.updateMatrix();
                    this.removeModelFromSelectedGroup(selected);
                    this.stickToPlateAndCheckOverstepped(selected.target);
                    this.addModelToSelectedGroup(selected);
                } else {
                    this.stickToPlateAndCheckOverstepped(selected);
                    if (selected.parent && selected.parent instanceof ThreeGroup) {
                        this.stickToPlateAndCheckOverstepped(selected.parent);
                        selected.parent.computeBoundingBox();
                    }
                }
            }
            selected.computeBoundingBox();
        });
        this.selectedGroup.shouldUpdateBoundingbox = false;

        this.prepareSelectedGroup();
        this.updatePrimeTowerHeight();
        recovery();

        if (selectedModelArray.length === 0) {
            return {};
        } else {
            return this.getState();
        }
    }

    updateSelectedConfig(config) {
        if (this.selectedModelArray.length === 1) {
            this.selectedModelArray[0].updateConfig(config);
        }
    }

    updateSelectedModelProcessImage(processImageName) {
        if (this.selectedModelArray.length === 1) {
            const selectedModel = this.selectedModelArray[0];
            selectedModel.updateProcessImageName(processImageName);
        }
    }

    hideAllModelsObj3D() {
        this.object.visible = false;
    }

    showAllModelsObj3D() {
        this.object.visible = true;
    }

    arrangeOutsidePlate(model, size) {
        model.computeBoundingBox();
        const x = size.x / 2 + (model.boundingBox.max.x - model.boundingBox.min.x) / 2;
        let y = -size.y / 2;
        const stepCount = 1;

        const modelBox3Clone = model.boundingBox.clone();
        modelBox3Clone.translate(new Vector3(x, y, 0));
        const box3Arr = [];
        for (const m of this.getModels()) {
            m.stickToPlate();
            m.computeBoundingBox();
            box3Arr.push(m.boundingBox);
        }
        while (1) {
            if (!this._isBox3IntersectOthers(modelBox3Clone, box3Arr)) {
                return { x, y };
            }
            y += stepCount;
            modelBox3Clone.translate(new Vector3(0, 1, 0));
        }
    }

    _computeAvailableXY(model, arrangedModels) {
        if (!arrangedModels) {
            arrangedModels = this.getModels();
        }
        if (arrangedModels.length === 0) {
            return { x: 0, y: 0 };
        }

        model.computeBoundingBox();
        const modelBox3 = model.boundingBox;
        const box3Arr = [];
        for (const m of arrangedModels) {
            m.stickToPlate();
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

    _checkAnyModelOversteppedOrSelected() {
        let isAnyModelOverstepped = false;
        for (const model of this.getModels()) {
            if (model.sourceType === '3d' && model.visible) {
                const overstepped = this._checkOverstepped(model);
                model.setOversteppedAndSelected(overstepped, model.isSelected);
                isAnyModelOverstepped = (isAnyModelOverstepped || overstepped);
            }
        }
        return isAnyModelOverstepped;
    }

    _checkOverstepped(model) {
        let isOverstepped = false;
        // TODO: Using 'computeBoundingBox' here will make it's boundingBox uncorrect
        // model.computeBoundingBox();
        isOverstepped = this._bbox && model.boundingBox && !this._bbox.containsBox(model.boundingBox);
        return isOverstepped;
    }

    hasModel() {
        return this.getModels().filter(v => v.visible && v.type !== 'primeTower').length > 0;
    }

    // include visible and hidden model
    hasModelWhole() {
        return this.getModels();
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
        const newModels = this.models.map(d => d.clone(this));

        for (const model of newModels) {
            if (model.supportTag) {
                model.target = newModels.find(i => i.originModelID === model.target.modelID);
            }
        }
        // remove supports without target
        return newModels.filter(model => (!model.supportTag || model.target));
    }


    /**
     * Create model.
     *
     * Also:
     *      - create model 3D Object
     *      - stickToPlate (3D)
     *      - auto select created model
     *
     * TODO: Refactor on options to make it clearer.
     *
     * @param modelInfo - information needed to create new model.
     *      options = {
     *            modelID,
     *            limitSize: this.size,
     *            headType,
     *            sourceType,
     *            mode,
     *            originalName,
     *            modelName,
     *            uploadName,
     *            sourceWidth: res.body.width,
     *            width,
     *            sourceHeight: res.body.height,
     *            height,
     *            transformation,
     *            config,
     *            zIndex,
     *            gcodeConfig
     *        };
     *
     * @returns {Model}
     */
    addModel(modelInfo) {
        if (modelInfo.sourceType === '3d' && modelInfo.isGroup) {
            const group = new ThreeGroup(modelInfo, this);
            group.updateTransformation(modelInfo.transformation);
            this.groupsChildrenMap.set(group, modelInfo.children.map(item => item.modelID));
            return group;
        }
        if (!modelInfo.modelName) {
            modelInfo.modelName = this._createNewModelName({
                sourceType: modelInfo.sourceType,
                mode: modelInfo.mode,
                originalName: modelInfo.originalName,
                config: modelInfo.config
            });
        }
        // Adding the z position for each meshObject when add a model(Corresponding to 'bringSelectedModelToFront' function)
        if (modelInfo.sourceType !== '3d') {
            if (!(modelInfo?.transformation?.positionZ > 0)) {
                this.resetModelsPositionZByOrder();
                const modelLength = this.models.length;
                modelInfo.transformation.positionZ = (modelLength + 1) * INDEXMARGIN;
            }
        }
        const model = this.newModel(modelInfo);

        model.computeBoundingBox();

        if (model.sourceType === '3d') {
            if (modelInfo.parentModelID) {
                // when recovering project, add model to its group
                this.groupsChildrenMap.forEach((subModelIDs, group) => {
                    if (modelInfo.parentModelID === group.modelID) {
                        const newSubModelIDs = subModelIDs.map(id => {
                            if (id === model.modelID) {
                                return model;
                            }
                            return id;
                        });
                        if (newSubModelIDs.every(id => id instanceof ThreeModel)) {
                            this.unselectAllModels();
                            group.add(newSubModelIDs);
                            this.groupsChildrenMap.delete(group);
                            this.models = [...this.models, group];
                            group.stickToPlate();
                            group.computeBoundingBox();
                            const overstepped = this._checkOverstepped(group);
                            group.setOversteppedAndSelected(overstepped, group.isSelected);
                            this.addModelToSelectedGroup(group);
                        } else {
                            this.groupsChildrenMap.set(group, newSubModelIDs);
                        }
                    }
                });
            } else {
                // add to group and select
                model.stickToPlate();
                this.models.push(model);
                // todo, use this to refresh obj list
                this.models = [...this.models];
                this.object.add(model.meshObject);

                this.selectModelById(model.modelID);
            }
        } else {
            // add to group and select
            this.models.push(model);
            // todo, use this to refresh obj list
            this.models = [...this.models];
            this.object.add(model.meshObject);
        }

        this.emit('add', model);
        // refresh view
        this.modelChanged();
        modelInfo.sourceType === '3d' && this.updatePrimeTowerHeight();
        return model;
    }

    /**
     * deprecated
     */
    hasSupportModel() {
        return !!this.models.find(i => i.supportTag === true);
    }

    /**
     * deprecated
     */
    isSupportSelected() {
        return this.selectedModelArray.length === 1 && this.selectedModelArray.every((model) => {
            return model.supportTag;
        });
    }

    isPrimeTowerSelected() {
        return this.selectedModelArray.length === 1 && this.selectedModelArray[0].type === 'primeTower';
    }

    /**
     * deprecated
     */
    addSupportOnSelectedModel(defaultSupportSize) {
        if (this.selectedModelArray.length !== 1) {
            return null;
        }
        let target = this.selectedModelArray[0];
        if (target.sourceType !== '3d') {
            return null;
        }
        if (target.supportTag === true) {
            target = target.target;
        }

        const model = this.newModel({ sourceType: '3d' });

        model.supportTag = true;
        model.supportSize = { ...defaultSupportSize };
        model.target = target;
        model.modelName = this._createNewModelName({ baseName: `${target.modelName}-support` });
        model.originalName = `supporter_${(Math.random() * 1000).toFixed(0)}`;
        const bbox = target.boundingBox;
        model.updateTransformation({
            positionX: Math.max(bbox.min.x + 5, bbox.max.x + 5),
            positionY: (bbox.min.y + bbox.max.y) / 2,
            uniformScalingState: false
        });
        const geometry = new BufferGeometry();
        const material = new MeshPhongMaterial({
            side: DoubleSide,
            color: 0xFFD700
        });
        model.meshObject = new Mesh(geometry, material);
        model.meshObject.supportTag = true;
        // https://github.com/mrdoob/three.js/issues/3845
        // because of limitation of decompose
        // non-uninform scale of object which has children is not recommended by threejs
        // we use manual updateMatrix to avoid this problem
        model.meshObject.matrixAutoUpdate = false;
        model.computeBoundingBox();

        // add to group and select
        this.models.push(model);
        // todo, use this to refresh obj list
        this.models = [...this.models];
        this.object.add(model.meshObject);
        model.generateSupportGeometry();

        // this.selectModelById(model.modelID);


        this.emit('add', model);
        // refresh view
        this.modelChanged();
        return model;
    }

    /**
     * deprecated
     */
    saveSupportModel(model) {
        model.generateSupportGeometry();
        if (model.isInitSupport) {
            this.removeModel(model);
        } else {
            if (model.target instanceof ThreeGroup) {
                const targetInGroup = model.target.intersectSupportTargetMeshInGroup(model);
                if (targetInGroup) {
                    model.target = targetInGroup;
                }
            }
            ThreeUtils.setObjectParent(model.meshObject, model.target.meshObject);
        }
    }

    /**
     * deprecated
     */
    getSupports() {
        const supports = [];
        this.traverseModels(this.models, (model) => {
            if (model.supportTag) {
                supports.push(model);
            }
        });
        return supports;
    }

    modelChanged() {
        if (typeof this.onDataChangedCallback === 'function') {
            this.onDataChangedCallback();
        }
    }

    // todo
    getSelectedModelByIntersect(intersect) {
        if (intersect) {
            const model = this.models.find(d => d.meshObject === intersect.object);
            if (model) {
                return model;
            }
        }
        return null;
    }

    /**
     * Create a new name for model.
     *
     * @param model - information needed to create new model name.
     *      options = {
     *            config,
     *            mode,
     *            sourceType,
     *            originalName
     *        };
     * @returns modelName
     */
    _createNewModelName(model) {
        let baseName = '';
        if (model.sourceType === '3d') {
            if (model instanceof ThreeGroup) {
                baseName = 'Group';
            } else {
                baseName = model.originalName;
            }
        } else {
            const { config } = model;
            const isText = (config && config.svgNodeName === 'text');
            const isShape = (model.mode === 'vector' && config && config.svgNodeName !== 'image');
            if (isText) {
                baseName = i18n._('key-2D_model_basename-Text');
            } else if (isShape) {
                baseName = i18n._('key-2D_model_basename-Shape');
            } else {
                baseName = model.originalName;
            }
        }

        let count = 1;
        let name = '';
        while (1) {
            if (baseName === 'Text' || baseName === 'Shape') {
                name = `${baseName} ${count.toString()}`;
            } else {
                if (count === 1) {
                    if (model instanceof ThreeGroup) {
                        name = `${baseName} ${count.toString()}`;
                    } else {
                        name = baseName;
                    }
                } else {
                    if (model instanceof ThreeGroup) {
                        name = `${baseName} ${count.toString()}`;
                    } else {
                        name = `${baseName} (${count.toString()})`;
                    }
                }
            }
            if (!this.getModelByModelName(name)) {
                return name;
            }
            count++;
        }
    }

    /**
     * Set selected modelIDs to create toolpath.
     * @param modelIDs
     */
    setSelectedToolPathModelIDs(modelIDs = []) {
        this.selectedToolPathModelIDs = modelIDs.map(v => v);
        this.modelChanged();
    }

    addSelectedToolPathModelIDs(modelIDs = []) {
        for (const modelID of modelIDs) {
            this.selectedToolPathModelIDs.push(modelID);
        }
        this.modelChanged();
    }

    removeSelectedToolPathModelIDs(modelIDs = []) {
        this.selectedToolPathModelIDs = this.selectedToolPathModelIDs.filter(v => !_.includes(modelIDs, v));
        this.modelChanged();
    }

    getSelectedToolPathModels() {
        return this.models.filter(model => _.includes(this.selectedToolPathModelIDs, model.modelID));
    }

    setAllSelectedToolPathModelIDs() {
        this.selectedToolPathModelIDs = this.models.map(v => v.modelID);
        this.modelChanged();
    }

    stickToPlateAndCheckOverstepped(model) {
        if (model.sourceType === '3d') {
            model.computeBoundingBox();
            model.stickToPlate();
            const overstepped = this._checkOverstepped(model);
            model.setOversteppedAndSelected(overstepped, model.isSelected);
        }
    }

    analyzeSelectedModelRotationAsync() {
        return new Promise((resolve, reject) => {
            if (this.selectedModelArray.length === 1) {
                const model = this.selectedModelArray[0];
                if (model instanceof ThreeGroup) {
                    const result = this.analyzeSelectedModelRotation();
                    resolve(result);
                } else {
                    if (!model.convexGeometry) {
                        this.once('set-convex', () => {
                            const result = this.analyzeSelectedModelRotation();
                            resolve(result);
                        });
                    } else {
                        const result = this.analyzeSelectedModelRotation();
                        resolve(result);
                    }
                }
            } else {
                reject();
            }
        });
    }

    analyzeSelectedModelRotation() {
        if (this.selectedModelArray.length === 1) {
            const model = this.selectedModelArray[0];
            const rotationInfo = model.analyzeRotation();
            const tableResult = [];
            if (rotationInfo) {
                const len = Math.min(20, rotationInfo.rates.length);
                for (let i = 0; i < len; i++) {
                    const row = {
                        faceId: i,
                        rate: rotationInfo.rates[i],
                        area: rotationInfo.areas[i],
                        plane: rotationInfo.planes[i],
                        planesPosition: rotationInfo.planesPosition[i],
                        supportVolume: rotationInfo.supportVolumes[i]
                    };
                    tableResult.push(row);
                }
                // sort desc according to rates
                tableResult.sort((a, b) => b.rate - a.rate);

                const group = this.resetSelectedModelConvexMeshGroup();
                ThreeUtils.setObjectParent(group, model.meshObject);
                const MAX_POINTS_FOR_CURVE_FACE = 54;
                tableResult.forEach((rowInfo) => {
                    const geometry = new BufferGeometry();
                    if (rowInfo.planesPosition.length > MAX_POINTS_FOR_CURVE_FACE) {
                        geometry.setAttribute('position', new Float32BufferAttribute(rowInfo.planesPosition, 3));
                    } else {
                        geometry.setFromPoints(ThreeUtils.generateRotationFaces(rowInfo.planesPosition, model.boundingBox));
                    }
                    // Fix Z-fighting
                    // https://sites.google.com/site/threejstuts/home/polygon_offset
                    // https://stackoverflow.com/questions/40328722/how-can-i-solve-z-fighting-using-three-js
                    const material = new MeshBasicMaterial({
                        color: 0x1890FF,
                        depthWrite: false,
                        transparent: true,
                        opacity: 0.3,
                        polygonOffset: true,
                        polygonOffsetFactor: -1,
                        polygonOffsetUnits: -5
                    });
                    const mesh = new Mesh(geometry, material);
                    mesh.userData = {
                        index: rowInfo.faceId
                    };
                    mesh.renderOrder = 9999999999;
                    group.userData = {
                        isRotationFace: true
                    };
                    group.add(mesh);
                });
                model.meshObject.add(group);
            }
            return tableResult;
        }
        return null;
    }

    rotateByPlane(targetPlane) {
        if (this.selectedModelArray.length === 1) {
            const model = this.selectedModelArray[0];
            model.rotateByPlane(targetPlane);
            model.stickToPlate();
            model.computeBoundingBox();
            const overstepped = this._checkOverstepped(model);
            model.setOversteppedAndSelected(overstepped, model.isSelected);
        }
        return this.getState();
    }

    resetSelectedModelConvexMeshGroup() {
        if (this.selectedModelArray.length === 1) {
            const model = this.selectedModelArray[0];
            for (let i = model.meshObject.children.length - 1; i >= 0; i--) {
                if (model.meshObject.children[i].userData.isRotationFace) {
                    model.meshObject.remove(model.meshObject.children[i]);
                }
            }
            for (let i = this.selectedModelConvexMeshGroup.children.length - 1; i >= 0; i--) {
                this.selectedModelConvexMeshGroup.remove(this.selectedModelConvexMeshGroup.children[i]);
            }
            this.selectedModelConvexMeshGroup = new Group();
            return this.selectedModelConvexMeshGroup;
        }
        return null;
    }

    _flattenGroups(modelsArray) {
        const ungroupedModels = [];
        modelsArray.forEach(model => {
            if (model instanceof ThreeGroup) {
                if (model.visible) {
                    const children = model.disassemble();
                    ungroupedModels.push(...children);
                }
            } else {
                ungroupedModels.push(model);
            }
        });
        return ungroupedModels;
    }

    recoveryGroup(group, ...models) {
        group.add(models);
        this.models = this.models.filter(model => {
            return !model.parent || model.parent.modelID !== group.modelID;
        });
        return this.getState();
    }

    group() {
        const selectedModelArray = this.selectedModelArray.slice(0);
        this.unselectAllModels();

        const group = new ThreeGroup({}, this);
        // check visible models or groups
        if (selectedModelArray.some(model => model.visible)) {
            // insert group to the first model position in selectedModelArray
            selectedModelArray.forEach(model => {
                if (model.parent && model.parent instanceof ThreeGroup) {
                    const index = model.parent.children.findIndex(subModel => subModel.modelID === model.modelID);
                    model.parent.children.splice(index, 1);
                    this.models.push(model);
                    ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject.parent);
                    model.parent.computeBoundingBox();
                    model.parent.updateGroupExtruder();
                }
            });

            const indexesOfSelectedModels = selectedModelArray.map((model) => {
                return this.models.indexOf(model);
            });
            const modelsToGroup = this._flattenGroups(selectedModelArray);
            group.modelName = this._createNewModelName(group);
            group.add(modelsToGroup);
            const insertIndex = Math.min(...indexesOfSelectedModels);
            this.models.splice(insertIndex, 0, group);
            this.models = this.models.filter(model => selectedModelArray.indexOf(model) === -1);

            this.object.add(group.meshObject);
            group.stickToPlate();
            group.meshObject.updateMatrix();
            group.computeBoundingBox();
            group.onTransform();
            this.addModelToSelectedGroup(group);
            this.updatePrimeTowerHeight();
        }
        return {
            newGroup: group,
            modelState: this.getState()
        };
    }

    canMerge() {
        return this.selectedModelArray?.length > 1 && !this.selectedModelArray.some(model => model instanceof ThreeGroup);
    }

    canGroup() {
        return this.selectedModelArray.some(model => {
            return model.visible && model.type !== 'primeTower';
        });
    }

    canUngroup() {
        return this.selectedModelArray.some(model => model instanceof ThreeGroup && model.visible);
    }

    ungroup({ autoStickToPlate } = { autoStickToPlate: true }) {
        const selectedModelArray = this.selectedModelArray.slice(0);
        this.unselectAllModels();
        // only visible groups can ungroup, others keep selected
        if (selectedModelArray.some(model => model instanceof ThreeGroup && model.visible)) {
            const ungroupedModels = [];
            selectedModelArray.forEach(model => {
                if (model instanceof ThreeGroup) {
                    if (model.visible) {
                        const insertIndex = this.models.indexOf(model);
                        this.models.splice(insertIndex, 1);
                        const children = model.disassemble();
                        ungroupedModels.push(...children);
                        this.models.splice(insertIndex, 0, ...children);
                    }
                } else {
                    ungroupedModels.push(model);
                }
            });

            ungroupedModels.forEach(model => {
                this.addModelToSelectedGroup(model);
                autoStickToPlate && model.stickToPlate();
            });
        }
        this.updatePrimeTowerHeight();
        return this.getState();
    }

    // prime tower
    initPrimeTower(initHeight = 0.1, transformation) {
        const model = new PrimeTowerModel(initHeight, this, transformation);
        return model;
    }

    updatePrimeTowerHeight() {
        let maxHeight = 0.1;
        const maxBoundingBoxHeight = this._bbox?.max.z;
        this.models.forEach(modelItem => {
            if (modelItem.headType === HEAD_PRINTING && modelItem.type !== 'primeTower' && !modelItem.supportTag) {
                const modelItemHeight = modelItem.boundingBox?.max.z - modelItem.boundingBox?.min.z;
                maxHeight = Math.max(maxHeight, modelItemHeight);
            }
        });
        if (typeof this.primeTowerHeightCallback === 'function') {
            this.primeTowerHeightCallback(Math.min(maxHeight, maxBoundingBoxHeight));
        }
    }

    // model support
    generateSupportMesh(geometry, parentMesh) {
        const material = new MeshBasicMaterial({
            side: DoubleSide,
            transparent: true,
            opacity: 0.5,
            color: 0x6485AB,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -5
        });
        const mesh = new Mesh(geometry, material);
        mesh.renderOrder = 99999;
        mesh.applyMatrix4(parentMesh.matrixWorld.clone().invert());
        return mesh;
    }

    filterModelsCanAttachSupport(models = this.models) {
        const modelsToAddSupport = [];
        this.traverseModels(models, (subModel) => {
            if (subModel instanceof ThreeModel && subModel.canAttachSupport && subModel.visible) {
                modelsToAddSupport.push(subModel);
            }
        });
        return modelsToAddSupport;
    }

    getModelsAttachedSupport(defaultSelectAllModels = true) {
        let models = [];
        if (this.selectedModelArray.length === 0) {
            if (defaultSelectAllModels) {
                this.selectAllModels();
                models = this.selectedModelArray;
            } else {
                models = this.models;
            }
        } else {
            models = this.selectedModelArray;
        }
        if (models.length > 0) {
            return this.filterModelsCanAttachSupport(models);
        }
        return [];
    }

    clearAllSupport() {
        const availModels = this.getModelsAttachedSupport(false);
        availModels.forEach(model => {
            model.meshObject.clear();
            model.supportFaceMarks = [];
            model.stickToPlate();
        });
    }

    startEditSupportArea() {
        const models = this.getModelsAttachedSupport();
        models.forEach((model) => {
            model.tmpSupportMesh = model.meshObject.children[0];
            model.meshObject.clear();
            // change color
            model.isEditingSupport = true;
            const colors = [];
            if (!model.supportFaceMarks || model.supportFaceMarks.length === 0) {
                const count = model.meshObject.geometry.getAttribute('position').count;
                model.supportFaceMarks = new Array(count / 3).fill(0);
            }

            const bufferGeometry = model.meshObject.geometry;
            const clone = bufferGeometry.clone();
            clone.applyMatrix4(model.meshObject.matrixWorld.clone());
            const normals = clone.getAttribute('normal').array;
            const positions = clone.getAttribute('position').array;
            const zUp = new Vector3(0, 0, 1);
            for (let i = 0, j = 0; i < normals.length; i += 9, j++) {
                const normal = new Vector3(normals[i], normals[i + 1], normals[i + 2]);
                const angleN = normal.angleTo(zUp) / Math.PI * 180;
                const averageZOfFace = (positions[i + 2] + positions[i + 5] + positions[i + 8]) / 3;
                // prevent to add marks to the faces attached to XOY plane
                if (angleN > (90 + EPSILON) && averageZOfFace > 0.01) {
                    model.supportFaceMarks[j] = model.supportFaceMarks[j] || AVAIL;
                }
            }
            model.supportFaceMarks.forEach((mark) => {
                switch (mark) {
                    case NONE: colors.push(...SUPPORT_UNAVAIL_AREA_COLOR, ...SUPPORT_UNAVAIL_AREA_COLOR, ...SUPPORT_UNAVAIL_AREA_COLOR); break;
                    case FACE: colors.push(...SUPPORT_ADD_AREA_COLOR, ...SUPPORT_ADD_AREA_COLOR, ...SUPPORT_ADD_AREA_COLOR); break;
                    case AVAIL: colors.push(...SUPPORT_AVAIL_AREA_COLOR, ...SUPPORT_AVAIL_AREA_COLOR, ...SUPPORT_AVAIL_AREA_COLOR); break;
                    default: break;
                }
            });
            model.meshObject.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
            model.originalGeometry = model.meshObject.geometry.clone();
            // this function call produce side effects on geometry, need to reset geometry, otherwise support will be incorrect
            model.meshObject.geometry.computeBoundsTree();
            model.meshObject.userData = {
                ...model.meshObject.userData,
                canSupport: true
            };
            model.setSelected();
        });
        this.modelChanged();

        if (this.brushMesh) {
            this.object.parent.add(this.brushMesh);
        }
    }

    finishEditSupportArea(shouldApplyChanges) {
        const models = this.getModelsAttachedSupport();
        this.object.parent.remove(this.brushMesh);
        models.forEach(model => {
            if (shouldApplyChanges) {
                const colors = model.meshObject.geometry.getAttribute('color').array;
                const supportFaceMarks = [];
                for (let i = 0, j = 0; i < colors.length; i += 9, j++) {
                    // determine the support face by checking RGB value
                    const isSupportArea = colors.slice(i, i + 9).some(color => {
                        return Math.abs(color - SUPPORT_ADD_AREA_COLOR[0]) < EPSILON;
                    });
                    supportFaceMarks[j] = isSupportArea ? FACE : NONE;
                }
                model.supportFaceMarks = supportFaceMarks;
            } else {
                // show original support mesh
                model.meshObject.add(model.tmpSupportMesh);
                model.tmpSupportMesh = null;
            }
            model.meshObject.geometry.disposeBoundsTree();
            model.meshObject.geometry.copy(model.originalGeometry);
            model.meshObject.geometry.deleteAttribute('color');
            model.isEditingSupport = false;
            model.setSelected();
        });
        this.modelChanged();
        return models;
    }

    setSupportBrushRadius(radius) {
        let position = new Vector3(0, 0, 0);
        if (this.brushMesh) {
            position = this.brushMesh.position.clone();
            this.object.parent.remove(this.brushMesh);
        }
        const brushGeometry = new SphereBufferGeometry(radius, 40, 40);
        const brushMaterial = new MeshStandardMaterial({
            color: 0xEC407A,
            roughness: 0.75,
            metalness: 0,
            transparent: true,
            opacity: 0.5,
            premultipliedAlpha: true,
            emissive: 0xEC407A,
            emissiveIntensity: 0.5,
        });
        this.brushMesh = new Mesh(brushGeometry, brushMaterial);
        this.brushMesh.name = 'brushMesh';
        this.brushMesh.position.copy(position);
        this.object.parent.add(this.brushMesh);
    }

    moveSupportBrush(raycastResult) {
        this.brushMesh.position.copy(raycastResult[0].point);
    }

    applySupportBrush(raycastResult, applySupportBrush) {
        this.moveSupportBrush(raycastResult);
        const target = raycastResult.find(result => result.object.userData.canSupport);
        if (target) {
            const targetMesh = target.object;
            const geometry = targetMesh.geometry;
            const bvh = geometry.boundsTree;
            if (bvh) {
                const inverseMatrix = new Matrix4();
                inverseMatrix.copy(targetMesh.matrixWorld).invert();

                const sphere = new Sphere();
                sphere.center.copy(this.brushMesh.position).applyMatrix4(inverseMatrix);
                sphere.radius = this.brushMesh.geometry.parameters.radius;

                const indices = [];
                const tempVec = new Vector3();
                bvh.shapecast({
                    intersectsBounds: box => {
                        const intersects = sphere.intersectsBox(box);
                        const { min, max } = box;
                        if (intersects) {
                            for (let x = 0; x <= 1; x++) {
                                for (let y = 0; y <= 1; y++) {
                                    for (let z = 0; z <= 1; z++) {
                                        tempVec.set(
                                            x === 0 ? min.x : max.x,
                                            y === 0 ? min.y : max.y,
                                            z === 0 ? min.z : max.z
                                        );
                                        if (!sphere.containsPoint(tempVec)) {
                                            return INTERSECTED;
                                        }
                                    }
                                }
                            }
                            return CONTAINED;
                        }
                        return intersects ? INTERSECTED : NOT_INTERSECTED;
                    },
                    intersectsTriangle: (tri, i, contained) => {
                        if (contained || tri.intersectsSphere(sphere)) {
                            const i3 = 3 * i;
                            indices.push(i3, i3 + 1, i3 + 2);
                        }
                        return false;
                    }
                });
                const colorAttr = geometry.getAttribute('color');
                const indexAttr = geometry.index;
                let color;
                if (applySupportBrush === 'add') {
                    color = SUPPORT_ADD_AREA_COLOR;
                } else if (applySupportBrush === 'remove') {
                    color = SUPPORT_AVAIL_AREA_COLOR;
                }
                for (let i = 0, l = indices.length; i < l; i++) {
                    const i2 = indexAttr.getX(indices[i]);
                    if (Math.abs(colorAttr.getX(i2) - SUPPORT_AVAIL_AREA_COLOR[0]) < EPSILON || Math.abs(colorAttr.getX(i2) - SUPPORT_ADD_AREA_COLOR[0]) < EPSILON) {
                        colorAttr.setX(i2, color[0]);
                        colorAttr.setY(i2, color[1]);
                        colorAttr.setZ(i2, color[2]);
                    }
                }
                colorAttr.needsUpdate = true;
            }
        }
    }

    checkIfOverrideSupport() {
        const availModels = this.getModelsAttachedSupport();
        return availModels.some(model => {
            if (model.supportFaceMarks) {
                return model.supportFaceMarks.indexOf(1) > -1;
            }
            return false;
        });
    }

    computeSupportArea(angle) {
        // group is not considered
        const availModels = this.getModelsAttachedSupport();
        availModels.forEach(model => {
            model.meshObject.updateMatrixWorld();
            const bufferGeometry = model.meshObject.geometry;
            const clone = bufferGeometry.clone();
            clone.applyMatrix4(model.meshObject.matrixWorld.clone());

            const positions = clone.getAttribute('position').array;
            const normals = clone.getAttribute('normal').array;

            // this will cause main thread stucked for a long time
            const supportFaceMarks = new Array(positions.length / 9).fill(NONE);
            // const downFaces = new Array(supportFaceMarks.length).fill(false);
            const normalVectors = new Array(supportFaceMarks.length).fill(false);
            // calculate faces
            const zDown = new Vector3(0, 0, -1);
            for (let i = 0, index = 0; i < normals.length; i += 9, index++) {
                const normal = new Vector3(normals[i], normals[i + 1], normals[i + 2]);
                normalVectors[index] = normal;

                const angleN = normal.angleTo(zDown) / Math.PI * 180;
                // make sure marks added to downward faces
                // if (angleN < 90) {
                //     downFaces[index] = true;
                // }
                const averageZOfFace = (positions[i + 2] + positions[i + 5] + positions[i + 8]) / 3;
                // prevent to add marks to the faces attached to XOY plane
                if ((90 - angleN) > (angle + EPSILON) && averageZOfFace > 0.01) {
                    supportFaceMarks[index] = FACE;
                }
            }
            // for (let i = 0; i < normalVectors.length; i++) {
            //     const normal = normalVectors[i];
            //     const angleN = normal.angleTo(zUp) / Math.PI * 180;
            //     console.log(angleN);
            //     if (angleN < 90) {
            //         downFaces[i] = true;
            //         if (angleN <= angle) {
            //             supportFaceMarks[i] = FACE;
            //         }
            //     }
            // }

            // calculate points
            // const points = new Map();
            // for (let i = 0, index = 0; i < positions.length; i += 3) {
            //     index = Math.floor(i / 9);
            //     const key = `${positions[i]}-${positions[i + 1]}-${positions[i + 2]}`;
            //     if (points.has(key)) {
            //         const value = points.get(key);
            //         value.faceIds.push(index);
            //     } else {
            //         points.set(key, {
            //             faceIds: [index],
            //             isSupport: true,
            //             normal: new Vector3(0, 0, 0)
            //         });
            //     }
            // }
            // for (let i = 0, index = 0; i < positions.length; i += 9, index++) {
            //     if (downFaces[index] && supportFaceMarks[index] === NONE) {
            //         const p1 = new Vector3(positions[i], positions[i + 1], positions[i + 2]);
            //         const p2 = new Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
            //         const p3 = new Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);

            //         const orderedPoints = ([p1, p2, p3].sort((a, b) => a.z - b.z));
            //         orderedPoints.forEach((point, j) => {
            //             const value = points.get(`${point.x}-${point.y}-${point.z}`);
            //             if (j === 0) {
            //                 value.normal.add(normalVectors[index]);
            //             } else {
            //                 value.isSupport = false;
            //             }
            //         });
            //     }
            // }
            // points.forEach((value) => {
            //     if (value.isSupport && ((value.normal.angleTo(zUp) / Math.PI * 180) > 90)) {
            //         value.faceIds.forEach(faceId => {
            //             supportFaceMarks[faceId] = POINT;
            //         });
            //     }
            // });

            // calculate lines
            // const lines = new Map<string, PointInfo>();
            // for (let i = 0, index = 0; i < positions.length; i += 9, index++) {
            //     const keyP1 = `${positions[i]}-${positions[i + 1]}-${positions[i + 2]}`;
            //     const keyP2 = `${positions[i + 3]}-${positions[i + 4]}-${positions[i + 5]}`;
            //     const keyP3 = `${positions[i + 6]}-${positions[i + 7]}-${positions[i + 8]}`;

            //     const line12 = [keyP1, keyP2];
            //     const line13 = [keyP1, keyP3];
            //     const line23 = [keyP2, keyP3];

            //     const edges = [line12, line13, line23];
            //     edges.forEach(line => {
            //         if (lines.has(line.join())) {
            //             const value = lines.get(key);
            //             value.faceIds.push(index);
            //         } else if (lines.has(line.reverse().join())) {

            //         } else {
            //             lines.set(key, {
            //                 faceIds: [index],
            //                 isSupport: true,
            //                 normal: new Vector3(0, 0, 0)
            //             });
            //         }
            //     });
            // }

            model.supportFaceMarks = supportFaceMarks;
        });
        return availModels;
    }
}

ModelGroup.prototype.MOCK_MODEL = {
    mock: true,
    sourceType: '',
    mode: '',
    config: {},
    visible: true,
    transformation: {
        rotationZ: 0,
        width: 0,
        height: 0,
        positionX: 0,
        positionY: 0
    }
};

export default ModelGroup;
