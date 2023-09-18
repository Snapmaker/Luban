import EventEmitter from 'events';
import _, { replace } from 'lodash';
import {
    Box3,
    Group,
    Intersection,
    Matrix4,
    Vector3
} from 'three';

import { HEAD_CNC, HEAD_LASER } from '../constants';
import i18n from '../lib/i18n';
import log from '../lib/log';
import { checkVector3NaN } from '../lib/numeric-utils';
import ThreeUtils from '../scene/three-extensions/ThreeUtils';
import { emitUpdateScaleEvent } from '../ui/components/SMCanvas/TransformControls';
import { ModelInfo as SVGModelInfo, TMode } from './BaseModel';
import SvgModel from './SvgModel';
import { ModelInfo, ModelTransformation } from './ThreeBaseModel';
import { ModelEvents } from './events';


const CUSTOM_EVENTS = {
    UPDATE: { type: 'update' }
};

const INDEXMARGIN = 0.02;

export const PLANE_MAX_HEIGHT = 999;

export const CLIPPING_LINE_COLOR = '#3B83F6';

type TModel = SvgModel

export type Model3D = Exclude<TModel, SvgModel>;

export type TDisplayedType = 'model' | 'gcode'

type TMaterials = {
    isRotate: boolean;
    diameter: number;
    length: number;
    fixtureLength: number;
    x: number;
    y: number;
    z: number;
}

type THeadType = typeof HEAD_LASER | typeof HEAD_CNC;

export interface SmartFillBrushOptions {
    // angle in degree
    angle: number;
}


class ModelGroup2D extends EventEmitter {
    public namesMap: Map<string, { number: number, count: number }> = new Map();
    public object: Group;
    public models: (TModel)[];
    public selectedModelArray: TModel[];
    public _bbox: Box3;
    public materials: TMaterials;
    private headType: THeadType;
    private clipboard: TModel[];
    private estimatedTime: number;
    private selectedGroup: Group;
    private selectedToolPathModelIDs: string[];
    private onDataChangedCallback: () => void;
    private series: string;
    private candidatePoints: {
        x: number;
        y: number;
    }[];


    public constructor(headType: THeadType) {
        super();

        this.headType = headType;
        this.object = new Group();
        this.object.name = 'Model Group';

        this.models = [];

        this.selectedGroup = new Group();
        this.selectedGroup.name = 'Selected Group';
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
        // The selectedToolPathModelIDs is used to generate the toolpath
        this.selectedToolPathModelIDs = [];
    }

    // TODO: save last value and compare changes
    public get selectedModelIDArray() {
        return this.selectedModelArray.map((m) => m.modelID);
    }

    // model factory
    public newModel(modelInfo: ModelInfo | SVGModelInfo) {
        return new SvgModel(modelInfo as unknown as SVGModelInfo, this);
    }

    public setDataChangedCallback(handler: () => void): void {
        this.onDataChangedCallback = handler;
    }

    public _getEmptyState() {
        return {
            mode: '',
            allModelIDs: [],
            hasModel: this.hasModel(),
            selectedModelIDArray: [] as string[],
            selectedModelArray: [] as TModel[],
            transformation: {} as ModelTransformation,
            estimatedTime: this.estimatedTime
        };
    }

    // public setUpdateHandler(handler) {
    //     this._updateView = handler;
    // }

    public onModelUpdate() {
        this.object.dispatchEvent(CUSTOM_EVENTS.UPDATE);
    }

    public getState() {
        const baseState = {
            allModelIDs: this.models.map((m) => m.modelID),
            selectedModelArray: this.selectedModelArray,
            selectedModelIDArray: this.selectedModelIDArray,
            estimatedTime: this.estimatedTime,
            hasModel: this.hasModel()
        };
        return baseState;
    }

    public getModel(modelID: string) {
        return this.models.find((d) => d.modelID === modelID);
    }

    public getModelByModelName(modelName: string, models: TModel[] = this.models) {
        return models.find((d) => {
            if (d.modelName === modelName) {
                return true;
            }
            return false;
        });
    }

    // TODO: Unify method return type, it causes unnecessary calculations.
    public getSelectedModelTransformation() {
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
                rotationZ: this.selectedGroup.rotation.z
            };
        } else {
            return {};
        }
    }

    public setModelVisibility(models: TModel[], visible: boolean) {
        models.forEach((model) => {
            model.visible = visible;
            model.meshObject.visible = visible;
        });

        // Make the reference of 'models' change to re-render
        this.models = [...this.models];
        return this.getState();
    }

    public hideSelectedModel(targetModels: TModel[] = null) {
        const models = targetModels || this.getSelectedModelArray();
        return this.setModelVisibility(models, false);
    }

    public showSelectedModel(targetModels: TModel[] = null) {
        const models = targetModels || this.getSelectedModelArray();

        return this.setModelVisibility(models, true);
    }

    public _removeSelectedModels() {
        const selectedArray = this.getSelectedModelArray<TModel>();
        selectedArray.forEach((selected) => {
            this.removeModel(selected);
        });
    }

    public removeModel(model: TModel) {
        if (model instanceof SvgModel) {
            model.meshObject.remove(model.modelObject3D);
            model.meshObject.remove(model.processObject3D);

            ThreeUtils.dispose(model.modelObject3D);
            ThreeUtils.dispose(model.processObject3D);
        }
        model.meshObject.removeEventListener('update', this.onModelUpdate);
        this.models = this.models.filter((item) => item !== model);
        this.updateModelNameMap(model.modelName, model.baseName, 'minus');
        this.modelChanged();
        this.selectedModelArray = this.selectedModelArray.filter((item) => item !== model);
        this.childrenChanged();
    }

    public updateModelNameMap(modelName: string, baseName: string, action: string) {
        let modelNumber: number | string = replace(modelName, baseName, '').replace('(', '').replace(')', '');
        modelNumber = modelNumber ? Number(modelNumber) : 1;
        const modelNameMap = this.namesMap.get(baseName);
        let tempNumber = modelNameMap.number || 0;
        let tempCount = modelNameMap.count || 0;
        switch (action) {
            case 'add':
                tempCount++;
                if (modelNumber - tempNumber <= 1) {
                    tempNumber += 1;
                } else {
                    tempNumber = modelNumber;
                }
                this.namesMap.set(baseName, {
                    count: tempCount,
                    number: tempNumber
                });
                break;
            case 'minus':
                tempCount--;
                if (modelNumber === tempNumber) {
                    tempNumber -= 1;
                }
                this.namesMap.set(baseName, {
                    count: tempCount,
                    number: tempCount === 0 ? 0 : tempNumber
                });
                break;
            default:
                break;
        }
    }

    /**
     * Remove selected models and reset selected state.
     */
    // todo, remove mesh obj in 2d
    public removeSelectedModel() {
        this._removeSelectedModels();
        this.unselectAllModels();
        return this.getState();
    }

    public _removeAllModels() {
        const models = this.getModels<TModel>();
        for (const model of models) {
            model.meshObject.removeEventListener('update', this.onModelUpdate);
            model.meshObject.parent && model.meshObject.parent.remove(model.meshObject);
        }
        this.models = [];
    }

    /**
     * Remove all models.
     */
    public removeAllModels() {
        this.unselectAllModels();
        this._removeAllModels();

        this.modelChanged();
        this.childrenChanged();
        return this._getEmptyState();
    }

    public bringSelectedModelToFront(model: TModel) {
        const selected = model || this.getSelectedModel();
        const sorted = this.getSortedModelsByPositionZ().filter((item) => item !== selected);
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].updateTransformation({ 'positionZ': (i + 1) * INDEXMARGIN });
        }
        selected.updateTransformation({ 'positionZ': (sorted.length + 1) * INDEXMARGIN });
    }

    // keep the origin order
    public sendSelectedModelToBack() {
        const selected = this.getSelectedModel<SvgModel>();
        const sorted = this.getSortedModelsByPositionZ().filter((model) => model !== selected);
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].updateTransformation({ 'positionZ': (i + 2) * INDEXMARGIN });
        }
        selected.updateTransformation({ 'positionZ': INDEXMARGIN });
    }

    public resetModelsPositionZByOrder() {
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].updateTransformation({ 'positionZ': (i + 1) * INDEXMARGIN });
        }
    }

    public getSortedModelsByPositionZ() {
        // bubble sort
        const sorted = this.getModels<SvgModel>();
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

    public arrangeAllModels2D() {
        const generateCandidatePoints = (minX, minY, maxX, maxY, step) => {
            const computeDis = (point) => {
                return point.x * point.x + point.y * point.y;
            };

            const quickSort = (origArray: { x: number, y: number }[]) => {
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
                    return [].concat(quickSort(left), pivot, quickSort(right)) as { x: number, y: number }[];
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

            return quickSort(points) as { x: number, y: number }[];
        };

        const setSuitablePosition = (modelGroup2D, newModel, candidatePoints) => {
            // if (modelGroup2D.children.length === 0) {
            if (modelGroup2D.models.length === 0) {
                newModel.meshObject.position.x = 0;
                newModel.meshObject.position.y = 0;
                newModel.transformation.positionX = 0;
                newModel.transformation.positionY = 0;
                return;
            }

            /**
             * check whether the model.bbox intersects the bbox of modelGroup2D.children
             */
            const intersect = (model) => {
                for (const m of modelGroup2D.models) {
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
                if (!intersect(newModel)) {
                    return;
                }
            }
        };
        if (!this.candidatePoints) {
            // TODO: replace with real machine size
            this.candidatePoints = generateCandidatePoints(-200, -200, 200, 200, 5);
        }
        const models = this.getModels<SvgModel>();
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

    public updateBoundingBox(bbox: Box3) {
        this._bbox = bbox;
        return this.getState();
    }

    public getModels<T>(filterKey = '') {
        const models = [];
        for (const model of this.models) {
            if (model.type === filterKey) {
                continue;
            } else {
                models.push(model);
            }
        }
        return models as T[];
    }

    public getVisibleValidModels() {
        return _.filter(this.models, (modelItem) => {
            return modelItem?.visible;
        });
    }

    public getVisibleModels() {
        return this.models.filter(model => {
            if (!model.visible) {
                return false;
            }
            return true;
        });
    }

    public selectedModelIsHidden() {
        return this.selectedModelArray.every(model => !model.visible);
    }

    // TODO: Refactor this.
    public setSeries(series: string) {
        this.series = series;
    }

    public getSelectedModelsForHotZoneCheck() {
        return this.getModels<Model3D>();
    }

    public calculateSelectedGroupPosition() {
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
    public addSelectedModels(modelArray: SvgModel[]) {
        this.selectedGroup = new Group();
        for (const model of modelArray) {
            if (!this.selectedModelArray.includes(model)) {
                if (!model) {
                    log.warn('missing model(s)');
                }
                model && this.selectedModelArray.push(model);
            }
        }
        this.selectedModelArray = [...this.selectedModelArray];
        const state = (() => {
            if (this.selectedModelArray.length > 0) {
                const modelState = this.getState();
                return modelState;
            } else {
                return this._getEmptyState();
            }
        })();
        this.emit(ModelEvents.ModelSelect, modelArray);
        this.modelChanged();

        return state;
    }

    public emptySelectedModelArray() {
        this.selectedModelArray = [];
        this.modelChanged();
    }

    // TODO: model or modelID, need rename this method and add docs
    // use for widget
    // If isMultiSelect is equal to true, it is mutually exclusive
    public selectModelById(modelID: string, isMultiSelect = false) {
        const selectModel = null;

        if (isMultiSelect) {
            if (selectModel) {
                const objectIndex = this.selectedGroup.children.indexOf(selectModel.meshObject);
                if (objectIndex === -1) {
                    let isModelAcrossGroup = false;
                    for (const selectedModel of this.selectedModelArray) {
                        if (selectedModel.parent !== selectModel.parent && (selectedModel.parent || selectModel.parent)) {
                            isModelAcrossGroup = true;
                            break;
                        }
                    }
                    if (isModelAcrossGroup) {
                        this.unselectAllModels();
                    }

                    if (selectModel.parent && this.selectedModelArray.length === selectModel.parent.children.length - 1) {
                        this.unselectAllModels();
                    }
                }
            }
        } else {
            this.unselectAllModels();
        }

        this.modelChanged();
        return this.getState();
    }

    // refresh selected group matrix
    public prepareSelectedGroup() {
        if (this.selectedModelArray.length === 1) {
            ThreeUtils.applyObjectMatrix(this.selectedGroup, new Matrix4().copy(this.selectedGroup.matrix).invert());
            ThreeUtils.liftObjectOnlyChildMatrix(this.selectedGroup);
            this.selectedGroup.uniformScalingState = this.selectedGroup.children[0].uniformScalingState;
        } else if (this.selectedModelArray.length > 1) {
            this.selectedGroup.uniformScalingState = true;
            const p = this.calculateSelectedGroupPosition();
            // set selected group position need to remove children temporarily
            const children = [...this.selectedGroup.children];
            children.map((obj) => ThreeUtils.removeObjectParent(obj));
            // only make the diff translation
            const oldPosition = new Vector3();
            this.selectedGroup.getWorldPosition(oldPosition);
            const matrix = new Matrix4().makeTranslation(p.x - oldPosition.x, p.y - oldPosition.y, p.z - oldPosition.z);
            ThreeUtils.applyObjectMatrix(this.selectedGroup, matrix);
            children.map((obj) => ThreeUtils.setObjectParent(obj, this.selectedGroup));
        }
    }

    public selectAllModels() {
        this.selectedModelArray = [];
        this.prepareSelectedGroup();
        this.modelChanged();

        return { // warning: this may not be correct
            selectedModelArray: this.selectedModelArray,
            selectedGroup: this.selectedGroup,
            selectedModelIDArray: this.selectedModelIDArray
        };
    }

    public unselectAllModels() {
        this.selectedModelArray = [];
    }

    public duplicateSelectedModel() {
        const modelsToCopy = this.selectedModelArray;
        if (modelsToCopy.length === 0) return this._getEmptyState();

        return this.paste(modelsToCopy);
    }

    /**
     * Copy action: copy selected models (simply save the objects without their current positions).
     */
    public copy() {
        this.clipboard = this.selectedModelArray.map(model => model.clone(this));
    }

    /**
     * Paste action: paste(duplicate) models in clipboard.
     */
    public paste(modelsToCopy = this.clipboard) {
        if (modelsToCopy.length === 0) return this._getEmptyState();

        // Unselect all models
        this.unselectAllModels();

        return this.getState();
    }

    public setMaterials(materials: TMaterials) {
        this.materials = materials;
    }

    // todo, remove it
    public getSelectedModel<T>() {
        if (this.selectedModelArray.length === 1) {
            return this.selectedModelArray[0] as unknown as T;
        }
        return {
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
        } as unknown as SvgModel;
    }

    public getSelectedModelArray<T>() {
        return this.selectedModelArray as unknown as T[];
    }

    public updateSelectedMode(mode: TMode, config: Record<string, string | number | boolean>) {
        if (this.selectedModelArray.length === 1) {
            const selectedModel = this.selectedModelArray[0] as SvgModel;
            selectedModel.processMode(mode, config);
        }
        return this._getEmptyState();
    }

    public async generateModel(modelInfo: ModelInfo | SVGModelInfo) {
        return new Promise((resolve, reject) => {
            this.addModel(modelInfo, resolve, reject);
        });
    }

    public onModelTransform() {
        try {
            this.selectedModelArray.forEach((model) => {
                model.onTransform();
            });
        } catch (error) {
            log.error('onModelTransform error:', error);
        }
    }

    public shouldApplyScaleToObjects(scaleX: number, scaleY: number, scaleZ: number) {
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
    public updateSelectedGroupTransformation(
        transformation: ModelTransformation,
        newUniformScalingState: boolean = this.selectedGroup.uniformScalingState,
        isAllRotate = false
    ) {
        const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, uniformScalingState } = transformation;
        const shouldUniformScale = newUniformScalingState;
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
            if (isAllRotate) {
                this.selectedGroup.rotation.x = rotationX;
            } else {
                if (this.selectedModelArray.length > 1) {
                    this.selectedGroup.children.forEach((meshItem) => {
                        meshItem.rotation.x = rotationX;
                    });
                } else {
                    this.selectedGroup.rotation.x = rotationX;
                }
            }
        }
        if (rotationY !== undefined) {
            if (isAllRotate) {
                this.selectedGroup.rotation.y = rotationY;
            } else {
                if (this.selectedModelArray.length > 1) {
                    this.selectedGroup.children.forEach((meshItem) => {
                        meshItem.rotation.y = rotationY;
                    });
                } else {
                    this.selectedGroup.rotation.y = rotationY;
                }
            }
        }
        if (rotationZ !== undefined) {
            if (isAllRotate) {
                this.selectedGroup.rotation.z = rotationZ;
            } else {
                if (this.selectedModelArray.length > 1) {
                    this.selectedGroup.children.forEach((meshItem) => {
                        meshItem.rotation.z = rotationZ;
                    });
                } else {
                    this.selectedGroup.rotation.z = rotationZ;
                }
            }
        }

        this.selectedGroup.updateMatrix();
        this.selectedGroup.shouldUpdateBoundingbox = false;
        this.modelChanged();
        return this.getState();
    }

    // model transformation triggered by controls
    // Note: the function is only useful for 3D object operations on Canvas
    public onModelAfterTransform() {
        const selectedModelArray = this.selectedModelArray;
        if (selectedModelArray.length > 1) {
            emitUpdateScaleEvent({
                scale: { x: 100, y: 100, z: 100 }
            });
        }
        this.unselectAllModels();
        // update model's boundingbox which has supports
        selectedModelArray.forEach((selected) => {
            selected.computeBoundingBox();
        });
        // after update transformation
        this.selectedGroup.shouldUpdateBoundingbox = true;

        this.prepareSelectedGroup();

        this.meshPositionChanged();

        if (selectedModelArray.length === 0) {
            return {};
        } else {
            return this.getState();
        }
    }

    public updateSelectedConfig(config: Record<string, string | number | boolean>) {
        if (this.selectedModelArray.length === 1) {
            (this.selectedModelArray[0] as SvgModel).updateConfig(config);
        }
    }

    public hideAllModelsObj3D() {
        this.object.visible = false;
    }

    public showAllModelsObj3D() {
        this.object.visible = true;
    }

    public hasModel() {
        return this.getModels<Model3D>().filter(v => v.visible).length > 0;
    }

    // include visible and hidden model
    public hasModelWhole() {
        return this.getModels();
    }

    // not include p1, p2
    public _getPositionBetween(p1: Vector3, p2: Vector3, step: number) {
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
        return positions as Vector3[];
    }

    public _getCheckPositions(p1: Vector3, p2: Vector3, p3: Vector3, p4: Vector3, step: number) {
        const arr1 = this._getPositionBetween(p1, p2, step);
        const arr2 = this._getPositionBetween(p2, p3, step);
        const arr3 = this._getPositionBetween(p3, p4, step);
        const arr4 = this._getPositionBetween(p4, p1, step);
        return [p1].concat(arr1, [p2], arr2, [p3], arr3, arr4, [p4]);
    }

    public _isBox3IntersectOthers(box3: Box3, box3Arr: Box3[]) {
        // check intersect with other box3
        for (const otherBox3 of box3Arr) {
            if (box3.intersectsBox(otherBox3)) {
                return true;
            }
        }
        return false;
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
     * @returns {TModel}
     */
    public addModel(modelInfo: ModelInfo | SVGModelInfo, resolve, reject) {
        if (!modelInfo.modelName) {
            const modelNameObj = this._createNewModelName({
                sourceType: modelInfo.sourceType as '3d' | '2d',
                mode: modelInfo?.mode as unknown as TMode,
                originalName: modelInfo.originalName,
                config: modelInfo.config as {
                    svgNodeName: string
                }
            });
            modelInfo.modelName = modelNameObj.name;
            modelInfo.baseName = modelNameObj.baseName;
        }

        const model = this.newModel(modelInfo);

        model.computeBoundingBox();

        if (checkVector3NaN(model.meshObject.position)) {
            reject && reject('err');
        } else {
            // add to group and select
            this.models.push(model);
            // todo, use this to refresh obj list
            this.models = [...this.models];
            this.object.add(model.meshObject);
        }

        this.emit(ModelEvents.AddModel, model);
        // refresh view
        this.modelChanged();
        resolve && resolve(model);
        return model;
    }

    public modelChanged() {
        if (typeof this.onDataChangedCallback === 'function') {
            this.onDataChangedCallback();
        }
    }

    /**
     * Notifying children of root group is changed.
     */
    public childrenChanged() {
        // children of root changed, thus can be regarded as mesh changed
        this.emit(ModelEvents.MeshChanged);
    }

    public meshChanged() {
        this.emit(ModelEvents.MeshChanged);
    }

    public meshPositionChanged() {
        this.emit(ModelEvents.MeshPositionChanged);
    }

    public modelAttributesChanged(attributeName: string): void {
        this.emit(ModelEvents.ModelAttribtuesChanged, attributeName);
    }

    public getSelectedModelByIntersect(intersect: Intersection) {
        if (intersect) {
            const model = this.models.find((d) => d.meshObject === intersect.object);
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
    public _createNewModelName(model: {
        sourceType: string,
        originalName: string,
        config?: { svgNodeName: string },
        mode?: unknown
    }) {
        let baseName = '';
        const { config } = model;
        const isText = (config && config.svgNodeName === 'text');
        const isShape = (model.mode === 'vector' && config && config.svgNodeName !== 'image');
        if (isText) {
            baseName = i18n._('key-2D/Model_basename-Text');
        } else if (isShape) {
            baseName = i18n._('key-2D/Model_basename-Shape');
        } else {
            baseName = model.originalName;
        }

        const value = this.namesMap.get(baseName) || {
            number: 0,
            count: 0
        };
        value.number += 1;
        value.count += 1;
        this.namesMap.set(baseName, value);

        let name = '';
        if (baseName === 'Text' || baseName === 'Shape') {
            name = `${baseName} ${value.number}`;
        } else {
            if (value.number === 1) {
                name = baseName;
            } else {
                name = `${baseName} (${value.number})`;
            }
        }
        return { name, baseName };
    }

    /**
     * Set selected modelIDs to create toolpath.
     * @param modelIDs
     */
    public setSelectedToolPathModelIDs(modelIDs: string[] = []) {
        this.selectedToolPathModelIDs = modelIDs.map((v) => v);
        this.modelChanged();
    }

    public addSelectedToolPathModelIDs(modelIDs: string[] = []) {
        for (const modelID of modelIDs) {
            this.selectedToolPathModelIDs.push(modelID);
        }
        this.modelChanged();
    }

    public removeSelectedToolPathModelIDs(modelIDs: string[] = []) {
        this.selectedToolPathModelIDs = this.selectedToolPathModelIDs.filter((v) => !_.includes(modelIDs, v));
        this.modelChanged();
    }

    public getSelectedToolPathModels() {
        return this.models.filter((model) => _.includes(this.selectedToolPathModelIDs, model.modelID));
    }

    public setAllSelectedToolPathModelIDs() {
        this.selectedToolPathModelIDs = this.models.map((v) => v.modelID);
        this.modelChanged();
    }

    public isSelectedModelAllVisible() {
        if (this.selectedModelArray.length === 0) {
            return false;
        }
        return this.selectedModelArray.every(model => {
            if (!model?.visible) {
                return false;
            }
            return true;
        });
    }
}

export default ModelGroup2D;
