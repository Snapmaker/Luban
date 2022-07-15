import {
    Sphere, SphereBufferGeometry, MeshStandardMaterial, Vector3, Group, Matrix4, BufferGeometry, Mesh, Float32BufferAttribute, MeshBasicMaterial, Plane, Box3, Object3D,
    Intersection, BufferAttribute, DynamicDrawUsage, LineSegments, LineBasicMaterial, PlaneGeometry, NotEqualStencilFunc, ReplaceStencilOp, MeshPhongMaterial, Vector2, Shape, ShapeGeometry, FrontSide
} from 'three';
import EventEmitter from 'events';
import { CONTAINED, INTERSECTED, NOT_INTERSECTED } from 'three-mesh-bvh';
import { v4 as uuid } from 'uuid';
import _ from 'lodash';
import { Transfer } from 'threads';
import i18n from '../lib/i18n';

import { ModelInfo, ModelTransformation } from './ThreeBaseModel';
import { ModelInfo as SVGModelInfo, TMode, TSize } from './BaseModel';
import ThreeModel from './ThreeModel';
import SvgModel from './SvgModel';
import { EPSILON, SELECTEVENT, HEAD_PRINTING, HEAD_LASER, HEAD_CNC } from '../constants';

import ThreeUtils from '../three-extensions/ThreeUtils';
import ThreeGroup from './ThreeGroup';
import PrimeTowerModel from './PrimeTowerModel';
import { calculateUvVector } from '../lib/threejs/ThreeStlCalculation';
import { polyUnion } from '../../shared/lib/clipper/cLipper-adapter';
import { ModelEvents } from './events';
import { TPolygon } from './ClipperModel';
import { PolygonsUtils } from '../../shared/lib/math/PolygonsUtils';
import workerManager from '../lib/manager/workerManager';
// import ConvexGeometry from '../three-extensions/ConvexGeometry';

import { IResult as TBrimResult } from '../workers/plateAdhesion/generateBrim';
import { IResult as TRaftResult } from '../workers/plateAdhesion/generateRaft';
import { IResult as TSkirtResult } from '../workers/plateAdhesion/generateSkirt';

const CUSTOM_EVENTS = {
    UPDATE: { type: 'update' }
};

const INDEXMARGIN = 0.02;
const SUPPORT_AVAIL_AREA_COLOR = [0.5725490196078431, 0.32941176470588235, 0.8705882352941177];
const SUPPORT_ADD_AREA_COLOR = [0.2980392156862745, 0, 0.5098039215686274];
const SUPPORT_UNAVAIL_AREA_COLOR = [0.9, 0.9, 0.9];
const AVAIL = -1, NONE = 0, FACE = 1/* , POINT = 2, LINE = 3 */;
export const planeMaxHeight = 999;

const SECTION_COLOR = '#E9F3FE';
export const CLIPPING_LINE_COLOR = '#3B83F6';

type TModel = ThreeGroup | ThreeModel | SvgModel

type Model3D = Exclude<TModel, SvgModel>;

export type TDisplayedType = 'model' | 'gcode'

type TRotationAnalysisTable = {
    faceId: number;
    rate: number;
    area: string;
    plane: string;
    planesPosition: number[];
    supportVolume: string;
}

type TMaterials = {
    isRotate: boolean;
    diameter: number;
    length: number;
    fixtureLength: number;
    x: number;
    y: number;
    z: number;
}

type THeadType = typeof HEAD_PRINTING | typeof HEAD_LASER | typeof HEAD_CNC;

type TAdhesionConfig = {
    adhesionType: 'skirt' | 'brim' | 'raft' | 'none';
    skirtLineCount: number;
    skirtGap: number;
    brimGap: number;
    brimLineCount: number;
    brimWidth: number;
    skirtBrimLineWidth: number;
    raftMargin: number;
}

class ModelGroup extends EventEmitter {
    private namesMap: Map<string, number> = new Map();
    public object: Group;
    public grayModeObject: Group;
    public models: (TModel)[];
    public selectedModelArray: TModel[];
    public _bbox: Box3;
    public primeTower: PrimeTowerModel;
    public materials: TMaterials;
    private groupsChildrenMap: Map<ThreeGroup, (string | ThreeModel)[]> = new Map();
    private brushMesh: Mesh<SphereBufferGeometry, MeshStandardMaterial> = null;
    private sectionMesh: Mesh = null;
    private headType: THeadType;
    private clipboard: TModel[];
    private estimatedTime: number;
    private selectedGroup: Group;
    private selectedModelConvexMeshGroup: Group;
    private selectedToolPathModelIDs: string[];
    private onDataChangedCallback: () => void;
    private primeTowerHeightCallback: (height: number) => void;
    private series: string;
    public materialPrintTemperature: number;
    private candidatePoints: {
        x: number;
        y: number;
    }[];

    private displayedType: TDisplayedType = 'model';
    public clippingGroup = new Group();
    private clippingHeight: number;
    public localPlane = new Plane(new Vector3(0, 0, -1), planeMaxHeight);
    public clippingFaceGroup = new Group();
    public plateAdhesion = new Group();
    public clipping: 'true' | 'false' = 'true';
    private adhesionConfig: TAdhesionConfig;

    public constructor(headType: THeadType) {
        super();

        this.headType = headType;
        this.object = new Group();
        this.grayModeObject = new Group();
        this.models = [];
        this.primeTower = new PrimeTowerModel(0.01, this);
        this.selectedGroup = new Group();
        this.selectedGroup.uniformScalingState = true;
        this.selectedGroup.boundingBox = [];
        this.selectedGroup.shouldUpdateBoundingbox = true;
        this.object.add(this.selectedGroup);
        this.object.add(this.primeTower.meshObject);
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

    // TODO: save last value and compare changes
    public get selectedModelIDArray() {
        return this.selectedModelArray.map((m) => m.modelID);
    }

    // model factory
    public newModel(modelInfo: ModelInfo | SVGModelInfo) {
        if (this.headType === HEAD_PRINTING) {
            return new ThreeModel(modelInfo as ModelInfo, this);
        } else {
            return new SvgModel(modelInfo as unknown as SVGModelInfo, this);
        }
    }

    public setDataChangedCallback(handler: () => void, update?: (height: number) => void) {
        this.onDataChangedCallback = handler;
        if (update) {
            this.primeTowerHeightCallback = update;
        }
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

    public getState(shouldCheckOverStep = true) {
        const baseState = {
            allModelIDs: this.models.map((m) => m.modelID),
            selectedModelArray: this.selectedModelArray,
            selectedModelIDArray: this.selectedModelIDArray,
            estimatedTime: this.estimatedTime,
            hasModel: this.hasModel()
        };
        if (this.headType === HEAD_PRINTING && shouldCheckOverStep) {
            return {
                ...baseState,
                isAnyModelOverstepped: this._checkAnyModelOversteppedOrSelected()
            };
        } else {
            return baseState;
        }
    }

    public getOverstepped(shouldCheckPrime) {
        return this._checkAnyModelOversteppedOrSelected(shouldCheckPrime);
    }

    /**
     * Note: for performance consideration, don't call this method in render.
     */
    public getBoundingBox() {
        return ThreeUtils.computeBoundingBox(this.object) as Box3;
    }

    /**
     * Note: get valid area
     */
    public getValidArea() {
        return this._bbox;
    }

    public getModel(modelID: string) {
        return this.models.find((d) => d.modelID === modelID);
    }

    public getModelByModelName(modelName: string, models: TModel[] = this.models) {
        return models.find((d) => {
            if (d.modelName === modelName) {
                return true;
            } else if (d instanceof ThreeGroup && d.children && d.children.length > 0) {
                return this.getModelByModelName(modelName, d.children);
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

    public getSelectedModelTransformationForPrinting() {
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
    public getSelectedModelBBoxDes() {
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

    // get selected TModel bounding box width & height & depth
    public getSelectedModelBBoxWHD() {
        const whd = new Vector3(0, 0, 0);
        ThreeUtils.computeBoundingBox(this.selectedGroup).getSize(whd);
        return {
            x: whd.x,
            y: whd.y,
            z: whd.z
        };
    }

    public getAllModelBBoxWHD() {
        const whd = new Vector3(0, 0, 0);
        ThreeUtils.computeBoundingBox(this.object).getSize(whd);
        return {
            x: whd.x,
            y: whd.y,
            z: whd.z
        };
    }

    public hasAnyModelVisible() {
        return this.getModels<TModel>().some((model) => model.visible);
    }

    public toggleModelsVisible(visible: boolean, models: TModel[]) {
        models.forEach((model) => {
            model.visible = visible;
            model.meshObject.visible = visible;
            if (model instanceof ThreeModel) {
                model.clipper.group.visible = visible;
            }
            if (model instanceof ThreeGroup) {
                model.traverse((subModel) => {
                    subModel.visible = visible;
                    subModel.meshObject.visible = visible;
                    subModel.clipper.group.visible = visible;
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
        this.updatePlateAdhesion();
        this.updateClippingPlane();
        return this.getState();
    }

    public hideSelectedModel(targetModels: TModel[] = null) {
        const models = targetModels || this.getSelectedModelArray();
        return this.toggleModelsVisible(false, models);
    }

    public showSelectedModel(targetModels: TModel[] = null) {
        const models = targetModels || this.getSelectedModelArray();
        return this.toggleModelsVisible(true, models);
    }

    public _removeSelectedModels() {
        const selectedArray = this.getSelectedModelArray<TModel>();
        selectedArray.forEach((selected) => {
            this.removeModel(selected);
        });
    }

    public recoverModelClippingGroup(model: TModel) {
        this.updateClippingPlane();
        if (model instanceof ThreeModel) {
            this.clippingGroup.add(model.clipper.group);
        } else if (model instanceof ThreeGroup) {
            model.children.forEach((m) => {
                this.recoverModelClippingGroup(m);
            });
        }
        this.updatePlateAdhesion();
    }

    public removeModel(model: TModel, loop = false) {
        this.updateClippingPlane();
        if (model instanceof PrimeTowerModel) return;
        if (!(model instanceof SvgModel)) {
            model.setSelected(false);
        }
        if (model instanceof ThreeGroup) {
            model.children.forEach((child) => {
                this.removeModel(child, true);
            });
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
        if (model instanceof SvgModel) {
            model.meshObject.remove(model.modelObject3D);
            model.meshObject.remove(model.processObject3D);
        }
        if (model instanceof ThreeModel) {
            this.clippingGroup && model.clipper && this.clippingGroup.remove(model.clipper.group);
        }
        model.meshObject.removeEventListener('update', this.onModelUpdate);
        if (model.parent instanceof ThreeGroup) {
            const groupIndex = this.models.findIndex((m) => m.modelID === (model.parent as ThreeGroup).modelID);
            const parentModel = this.models[groupIndex] as ThreeGroup;
            if (parentModel.children && parentModel.children.length === 1) {
                parentModel.onTransform();
                this.models.splice(groupIndex, 1);
            } else {
                parentModel.children = parentModel.children.filter((subModel) => subModel !== model);
                if (!loop) {
                    // When deleting a group, do not do stickToPlate again. To avoid updating the center point of the group
                    // Otherwise, the z-axis of the model in the group being deleted will be affected
                    this.stickToPlateAndCheckOverstepped(parentModel);
                }
                parentModel.updateGroupExtruder();
            }
            this.models = this.models.concat();
        } else {
            this.models = this.models.filter((item) => item !== model);
        }
        this.updatePlateAdhesion();
        this.modelChanged();
        model.sourceType === '3d' && this.updatePrimeTowerHeight();
    }


    /**
     * Remove selected models and reset selected state.
     */
    // todo, remove mesh obj in 2d
    public removeSelectedModel() {
        this._removeSelectedModels();
        this.unselectAllModels();
        this.updatePlateAdhesion();
        return this.getState();
    }

    public _removeAllModels() {
        const models = this.getModels<TModel>();
        for (const model of models) {
            model.meshObject.removeEventListener('update', this.onModelUpdate);
            model.meshObject.parent && model.meshObject.parent.remove(model.meshObject);
            if (model instanceof ThreeModel) {
                this.clippingGroup.remove(model.clipper.group);
                model.clipper = null;
            }
        }
        this.plateAdhesion.clear();
        this.object.remove(this.sectionMesh);
        this.sectionMesh = null;
        this.models = [];
    }

    /**
     * Remove all models.
     */
    public removeAllModels() {
        this.unselectAllModels();
        this._removeAllModels();

        this.modelChanged();
        this.updatePrimeTowerHeight();
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


    public setConvexGeometry(uploadName: string, convexGeometry: BufferGeometry) {
        // SvgModel
        const models = this.models.filter((m) => m instanceof ThreeModel && m.uploadName === uploadName);
        if (models.length) {
            for (let idx = 0; idx < models.length; idx++) {
                const model = models[idx] as ThreeModel;
                model.setConvexGeometry(convexGeometry);
            }
        }
        this.emit(ModelEvents.SetConvex);
    }

    public updateBoundingBox(bbox: Box3) {
        this._bbox = bbox;
        return this.getState();
    }

    public totalEstimatedTime() {
        let totalEstimatedTime_ = 0;
        for (const model of this.models) {
            if (!(model instanceof SvgModel)) {
                const estimatedTime_ = model.estimatedTime;
                if (typeof estimatedTime_ !== 'number' || !Number.isNaN(estimatedTime_)) {
                    totalEstimatedTime_ += estimatedTime_;
                }
            }
        }
        return totalEstimatedTime_;
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
            } else if (model instanceof ThreeGroup) {
                return model.children.every((subModel) => subModel.visible);
            }
            return true;
        });
    }

    public setSeries(series: string) {
        this.series = series;
    }

    public isOversteppedHotArea() {
        if (this.series !== 'A400') {
            return false;
        }

        const useHotMatialModels = [];
        const selectedModels = this.getSelectedModelArray<Model3D>();
        this.traverseModels(selectedModels, (model) => {
            if (model instanceof ThreeModel && model.materialPrintTemperature > 80) {
                useHotMatialModels.push(model);
            }
        });
        if (!useHotMatialModels.length) {
            return false;
        }

        return useHotMatialModels;
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
                    console.trace('modelGroup, addSelectedModels', model);
                    window.alert('blank');
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
                    if (this.selectedModelArray.length === 1 && this.selectedModelArray[0] instanceof PrimeTowerModel) {
                        this.unselectAllModels();
                    }
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

    public traverseModels(models: TModel[], callback: (model: ThreeModel) => void) {
        models.forEach((model) => {
            if (model instanceof ThreeGroup) {
                this.traverseModels(model.children, callback);
            }
            (typeof callback === 'function') && callback(model as unknown as ThreeModel);
        });
    }

    public findModelByID(modelID: string) {
        let model: TModel = null;
        this.traverseModels(this.models, (subModel) => {
            if (subModel.modelID === modelID) {
                model = subModel;
            }
        });
        return model;
    }

    public findModelByMesh(meshObject: Object3D) {
        for (const model of this.models.concat(this.primeTower)) {
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
    public selectMultiModel(intersect: Intersection, selectEvent: string) {
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
                    if (model instanceof PrimeTowerModel || this.selectedModelArray[0] instanceof PrimeTowerModel) {
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
        this.emit(ModelEvents.ModelSelect);
        return this.getState(false);
    }

    public addModelToSelectedGroup(...models: Model3D[]) {
        models.forEach((model) => {
            if (model.isSelected) return;
            if (model instanceof PrimeTowerModel && !model.visible) return;
            model.setSelected(true);
            ThreeUtils.applyObjectMatrix(this.selectedGroup, new Matrix4().copy(this.selectedGroup.matrix).invert());
            this.selectedModelArray = [...this.selectedModelArray, model];

            ThreeUtils.setObjectParent(model.meshObject, this.selectedGroup);
            this.prepareSelectedGroup();
        });
    }

    public removeModelFromSelectedGroup(model: TModel) {
        if (model instanceof SvgModel) return;
        if (!this.selectedGroup.children.find((obj) => obj === model.meshObject)) return;

        model.setSelected(false);
        ThreeUtils.applyObjectMatrix(this.selectedGroup, new Matrix4().copy(this.selectedGroup.matrix).invert());
        let parent = this.object;
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
        this.getModels<Model3D>().forEach((model) => {
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

    public unselectAllModelsInGroup(group: ThreeGroup) {
        this.selectedModelArray = [];
        group.children.forEach((model) => {
            this.removeModelFromSelectedGroup(model);
        });
    }

    public unselectAllModels() {
        const cancelSelectedModels = this.selectedModelArray.slice(0) as Model3D[];
        this.selectedModelArray = [];
        if (this.headType === HEAD_PRINTING) {
            this.models.concat(this.primeTower).forEach((model) => {
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
                cancelSelectedModels.forEach((model) => {
                    this.addModelToSelectedGroup(model);
                });
            }
        };
    }

    public arrangeAllModels() {
        const models = this.getModels<Model3D>('primeTower');
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

    public duplicateSelectedModel(modelID) {
        this.updateClippingPlane();
        const modelsToCopy = this.selectedModelArray;
        if (modelsToCopy.length === 0) return this._getEmptyState();

        // Unselect all models
        this.unselectAllModels();

        const newModels = modelsToCopy.map((model) => {
            let newModel;

            if (model instanceof ThreeModel || model instanceof ThreeGroup) {
                newModel = model.clone(this) as Model3D;
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
                newModel = model.clone(this) as SvgModel;
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
            return newModel;
        });
        if (this.headType === HEAD_PRINTING) {
            this.traverseModels(newModels, (model: ThreeModel) => {
                model.onTransform();
                model.initClipper(this.localPlane);
            });
        }

        return this.getState();
    }

    /**
     * Copy action: copy selected models (simply save the objects without their current positions).
     */
    public copy() {
        this.clipboard = this.selectedModelArray.filter((model) => !(model instanceof PrimeTowerModel)).map(model => model.clone(this));
    }

    /**
     * Paste action: paste(duplicate) models in clipboard.
     */
    public paste() {
        this.updateClippingPlane();
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
                newModel.onTransform();
                newModel.modelID = uuid();

                this.models.push(newModel);
                this.object.add(newModel.meshObject);
                this.addModelToSelectedGroup(newModel);
                this.updatePrimeTowerHeight();
                if (newModel instanceof ThreeModel) {
                    newModel.initClipper(this.localPlane);
                } else if (newModel instanceof ThreeGroup) {
                    newModel.children.forEach((subModel) => {
                        (subModel as ThreeModel).initClipper(this.localPlane);
                    });
                }
            }
        });

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

    public isModelSelected(model: ThreeModel) {
        return this.selectedGroup.children.includes(
            model.meshObject
        );
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

    public generateModel(modelInfo: ModelInfo | SVGModelInfo) {
        this.addModel(modelInfo);
        return this.getState();
    }

    public layFlatSelectedModel() {
        const selected = this.getSelectedModelArray();
        if (selected.length === 0) {
            return null;
        }
        selected.forEach((item) => {
            if (!(item instanceof SvgModel) && item instanceof ThreeModel) {
                item.layFlat();
                item.computeBoundingBox();
            }
        });
        return this.getState();
    }

    public scaleToFitFromModel(size: TSize, offsetX = 0, offsetY = 0, models: TModel[]) {
        models.forEach((model) => {
            if (!(model instanceof SvgModel)) {
                model.scaleToFit(size, offsetX, offsetY);
                model.computeBoundingBox();
            }
        });

        return this.getState();
    }

    private async stopClipper() {
        const selected = this.getSelectedModelArray<Model3D>();
        const promises = [];
        this.traverseModels(selected, (model) => {
            if (model instanceof ThreeModel && model.clipper) {
                promises.push(
                    model.clipper.clear()
                );
            }
        });
        await Promise.all(promises);
    }

    public async scaleToFitSelectedModel(size: TSize, offsetX = 0, offsetY = 0) {
        const selected = this.getSelectedModelArray<Model3D>();
        if (selected.length === 0) {
            return null;
        }
        await this.stopClipper();
        this.scaleToFitFromModel(size, offsetX, offsetY, selected);
        this.prepareSelectedGroup();
        return this.getState();
    }

    public resetSelectedModelTransformation() {
        const selected = this.getSelectedModelArray<Model3D>();
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

    public onModelTransform() {
        try {
            this.selectedModelArray.forEach((model) => {
                if (model.parent && model.parent instanceof ThreeGroup) {
                    model.parent.children.forEach((subModel) => {
                        subModel.onTransform();
                    });
                } else {
                    model.onTransform();
                }
            });
        } catch (error) {
            console.trace('onModelTransform error', error);
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

    public updateModelsPositionBaseFirstModel(models: ThreeModel[]) {
        if (models && models.length > 0) {
            const firstModel = models[0];
            const otherModels = models.filter((d) => d.meshObject !== firstModel.meshObject);
            this.selectModelById(firstModel.modelID);
            this.updateSelectedGroupTransformation({ positionZ: firstModel.originalPosition.z });
            otherModels.forEach((model) => {
                const newPosition = {
                    positionX: model.originalPosition.x - firstModel.originalPosition.x + firstModel.transformation.positionX,
                    positionY: model.originalPosition.y - firstModel.originalPosition.y + firstModel.transformation.positionY,
                    positionZ: model.originalPosition.z
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
            positionY: newPosition.y
        };
    }

    public updateModelPositionByPosition(modelID: string, position: TSize) {
        if (modelID) {
            const model = this.models.find((d) => d.modelID === modelID);
            this.selectModelById(model.modelID);
            this.updateSelectedGroupTransformation({
                positionX: position.x,
                positionY: position.y,
                positionZ: position.z
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
    public updateSelectedGroupTransformation(
        transformation: ModelTransformation,
        newUniformScalingState: boolean = this.selectedGroup.uniformScalingState,
        isAllRotate = false
    ) {
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

    // on 3dp scale
    public updateSelectedGroupModelsVectorUv() {
        this.selectedGroup.children.forEach((mesh) => {
            if (mesh.geometry) {
                const newUv = calculateUvVector(this.selectedGroup.scale, mesh);
                mesh.geometry.setAttribute('uv', newUv);
            }
        });
    }

    public onModelBeforeTransform() {
        this.updateClippingPlane(planeMaxHeight);
        this.emit(ModelEvents.ClippingHeightReset, true);

        this.stopClipper();
        this.plateAdhesion.clear();
    }

    // model transformation triggered by controls
    // Note: the function is only useful for 3D object operations on Canvas
    public onModelAfterTransform(shouldStickToPlate = true) {
        const selectedModelArray = this.selectedModelArray;
        const { recovery } = this.unselectAllModels();
        // update model's boundingbox which has supports
        selectedModelArray.forEach((selected) => {
            if (selected.sourceType === '3d' && shouldStickToPlate) {
                this.stickToPlateAndCheckOverstepped(selected);
                if (selected.parent && selected.parent instanceof ThreeGroup) {
                    this.stickToPlateAndCheckOverstepped(selected.parent);
                    selected.parent.computeBoundingBox();
                }
            }
            selected.computeBoundingBox();
        });
        this.selectedGroup.shouldUpdateBoundingbox = false;

        this.prepareSelectedGroup();
        this.updatePrimeTowerHeight();
        this.calaClippingMap();
        recovery();

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

    public arrangeOutsidePlate(model: Model3D, size: TSize) {
        model.computeBoundingBox();
        const x = size.x / 2 + (model.boundingBox.max.x - model.boundingBox.min.x) / 2;
        let y = -size.y / 2;
        const stepCount = 1;

        const modelBox3Clone = model.boundingBox.clone();
        modelBox3Clone.translate(new Vector3(x, y, 0));
        const box3Arr = [];
        for (const m of this.getModels<Model3D>()) {
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

    public _computeAvailableXY(model: Model3D, arrangedModels?: Model3D[]) {
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

    public _checkAnyModelOversteppedOrSelected(shouldCheckPrime = false) {
        let isAnyModelOverstepped = false;
        const primeTower = this.primeTower;
        for (const model of this.getModels<Model3D>().concat(primeTower)) {
            if (model.sourceType === '3d' && model.visible) {
                const overstepped = this._checkOverstepped(model);
                model.setOversteppedAndSelected(overstepped, model.isSelected);
                isAnyModelOverstepped = (isAnyModelOverstepped || overstepped);
            }
        }
        if (shouldCheckPrime) {
            const overstepped = this._checkOverstepped(primeTower);
            primeTower.setOversteppedAndSelected(overstepped, primeTower.isSelected);
            isAnyModelOverstepped = (isAnyModelOverstepped || overstepped);
        }
        return isAnyModelOverstepped;
    }

    public _checkOverstepped(model: Model3D) {
        let isOverstepped = false;
        // TODO: Using 'computeBoundingBox' here will make it's boundingBox uncorrect
        // model.computeBoundingBox();
        isOverstepped = this._bbox && model.boundingBox && !this._bbox.containsBox(model.boundingBox);
        return isOverstepped;
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
    public addModel(modelInfo: ModelInfo | SVGModelInfo, immediatelyShow = true) {
        if (modelInfo.headType === HEAD_PRINTING && modelInfo.isGroup) {
            const group = new ThreeGroup(modelInfo, this);
            group.updateTransformation(modelInfo.transformation);
            this.groupsChildrenMap.set(group, modelInfo.children.map((item) => {
                return item.modelID;
            }));
            return group as ThreeGroup;
        }
        if (!modelInfo.modelName) {
            modelInfo.modelName = this._createNewModelName({
                sourceType: modelInfo.sourceType as '3d' | '2d',
                mode: modelInfo?.mode as unknown as TMode,
                originalName: modelInfo.originalName,
                config: modelInfo.config as {
                    svgNodeName: string
                }
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

        if (model instanceof ThreeModel && model.sourceType === '3d') {
            if (modelInfo.parentModelID) {
                // Updating groupsChildrenMap value to 'model'
                this.groupsChildrenMap.forEach((subModelIDs, group) => {
                    if (modelInfo.parentModelID === group.modelID) {
                        const newSubModelIDs = subModelIDs.map((id) => {
                            if (id === model.modelID) {
                                return model;
                            }
                            return id;
                        });
                        this.groupsChildrenMap.set(group, newSubModelIDs);
                    }
                });
            } else {
                if (immediatelyShow) {
                    // add to group and select
                    model.stickToPlate();
                    this.models.push(model);
                    // todo, use this to refresh obj list
                    this.models = [...this.models];
                    this.object.add(model.meshObject);

                    this.selectModelById(model.modelID);
                }
            }
            if (model.parentUploadName) {
                this.updateSelectedGroupTransformation(
                    {
                        positionX: model.originalPosition.x,
                        positionY: model.originalPosition.y,
                        positionZ: model.originalPosition.z,
                    }
                );
            }
        } else {
            // add to group and select
            this.models.push(model);
            // todo, use this to refresh obj list
            this.models = [...this.models];
            this.object.add(model.meshObject);
        }

        if (immediatelyShow) {
            this.emit(ModelEvents.AddModel, model);
            // refresh view
            this.modelChanged();
            modelInfo.sourceType === '3d' && this.updatePrimeTowerHeight();
        }
        return model;
    }

    public addGroup(modelInfo: ModelInfo, modelsInGroup: Model3D[]) {
        const group = new ThreeGroup(modelInfo, this);
        group.modelName = this._createNewModelName(group);

        modelsInGroup.forEach((model) => {
            if (model.parent && model.parent instanceof ThreeGroup) {
                const index = model.parent.children.findIndex((subModel) => subModel.modelID === model.modelID);
                model.parent.children.splice(index, 1);
                this.models.push(model);
                ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject.parent);
                model.parent.computeBoundingBox();
                model.parent.updateGroupExtruder();
            }
        });

        const indexesOfSelectedModels = modelsInGroup.map((model) => {
            return this.models.indexOf(model);
        });
        const modelsToGroup = this._flattenGroups(modelsInGroup);
        group.modelName = this._createNewModelName(group);
        group.add(modelsToGroup);
        const insertIndex = Math.min(...indexesOfSelectedModels);
        this.models.splice(insertIndex, 0, group);
        this.models = this.getModels<Model3D>().filter((model) => modelsInGroup.indexOf(model) === -1);

        this.object.add(group.meshObject);
        group.stickToPlate();
        group.meshObject.updateMatrix();
        group.computeBoundingBox();
        group.onTransform();
        this.addModelToSelectedGroup(group);
        this.updatePrimeTowerHeight();

        this.emit(ModelEvents.AddModel, group);
    }

    /**
     * deprecated
     */
    public hasSupportModel() {
        return !!this.getModels<Model3D>().find((i) => i instanceof ThreeModel && i.supportFaceMarks.length > 0);
    }

    /**
     * deprecated
     */
    public isSupportSelected() {
        return this.selectedModelArray.length === 1 && this.selectedModelArray.every((model) => {
            return model instanceof ThreeModel && model.supportFaceMarks.length > 0;
        });
    }

    public isPrimeTowerSelected() {
        return this.selectedModelArray.length === 1 && this.selectedModelArray[0] instanceof PrimeTowerModel;
    }

    public modelChanged() {
        if (typeof this.onDataChangedCallback === 'function') {
            this.onDataChangedCallback();
        }
    }

    // todo
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
        if (model.sourceType === '3d') {
            if (model instanceof ThreeGroup) {
                baseName = model.originalName || 'Group';
            } else {
                baseName = model.originalName || 'Model';
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

        const count = this.namesMap.get(baseName) || 1;
        this.namesMap.set(baseName, count + 1);

        let name = '';
        if (baseName === 'Text' || baseName === 'Shape') {
            name = `${baseName} ${count}`;
        } else {
            if (count === 1) {
                if (model instanceof ThreeGroup) {
                    name = `${baseName} ${count}`;
                } else {
                    name = baseName;
                }
            } else {
                if (model instanceof ThreeGroup) {
                    name = `${baseName} ${count}`;
                } else {
                    name = `${baseName} (${count})`;
                }
            }
        }
        return name;
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

    public setDisplayType(displayedType: TDisplayedType) {
        this.getModels<Model3D>().forEach((model) => {
            model.updateDisplayedType(displayedType);
            if (model instanceof ThreeModel && model.clipper) {
                model.clipper.group.visible = (displayedType === 'model' && model.visible);
            }
        });
        this.displayedType = displayedType;
        if (this.displayedType === 'gcode') {
            this.plateAdhesion.visible = false;
        } else {
            this.plateAdhesion.visible = true;
        }
    }

    public stickToPlateAndCheckOverstepped(model: Model3D) {
        model.computeBoundingBox();
        model.stickToPlate();
        const overstepped = this._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }

    public async analyzeSelectedModelRotationAsync() {
        return new Promise((resolve, reject) => {
            if (this.selectedModelArray.length === 1) {
                const model = this.selectedModelArray[0] as Model3D;
                if (model instanceof ThreeGroup) {
                    const result = this.analyzeSelectedModelRotation();
                    resolve(result);
                } else {
                    if (!model.convexGeometry) {
                        this.once(ModelEvents.SetConvex, () => {
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

    public analyzeSelectedModelRotation() {
        if (this.selectedModelArray.length === 1) {
            const model = this.selectedModelArray[0] as ThreeGroup;
            const rotationInfo = model.analyzeRotation();
            const tableResult: TRotationAnalysisTable[] = [];
            // todo
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

    public rotateByPlane(targetPlane: Plane) {
        if (this.selectedModelArray.length === 1) {
            const model = this.selectedModelArray[0] as Model3D;
            model.rotateByPlane(targetPlane);
            model.stickToPlate();
            model.computeBoundingBox();
            const overstepped = this._checkOverstepped(model);
            model.setOversteppedAndSelected(overstepped, model.isSelected);
        }
        return this.getState();
    }

    public resetSelectedModelConvexMeshGroup() {
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

    public _flattenGroups(modelsArray: Model3D[]) {
        const ungroupedModels: ThreeModel[] = [];
        modelsArray.forEach((model) => {
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

    public recoveryGroup(group: ThreeGroup, ...models: Model3D[]) {
        group.add(models);
        this.models = this.getModels<Model3D>().filter((model) => {
            return !model.parent || model.parent.modelID !== group.modelID;
        });
        this.recoverModelClippingGroup(group);
        return this.getState();
    }

    public group() {
        const selectedModelArray = this.selectedModelArray.slice(0) as Model3D[];
        this.unselectAllModels();

        const group = new ThreeGroup({}, this);
        // check visible models or groups
        if (selectedModelArray.some((model) => model.visible)) {
            // insert group to the first model position in selectedModelArray
            selectedModelArray.forEach((model) => {
                if (model.parent && model.parent instanceof ThreeGroup) {
                    const index = model.parent.children.findIndex((subModel) => subModel.modelID === model.modelID);
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
            this.models = this.getModels<Model3D>().filter((model) => selectedModelArray.indexOf(model) === -1);

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

    public canMerge() {
        return this.selectedModelArray?.length > 1 && !this.selectedModelArray.some((model) => model instanceof ThreeGroup);
    }

    public canGroup() {
        return this.selectedModelArray.some((model) => {
            return model?.visible;
        });
    }

    public canUngroup() {
        return this.selectedModelArray.some((model) => model instanceof ThreeGroup && model.visible);
    }

    public ungroup(params: { autoStickToPlate: boolean } = { autoStickToPlate: true }) {
        const { autoStickToPlate } = params;
        const selectedModelArray = this.selectedModelArray.slice(0);
        this.unselectAllModels();
        // only visible groups can ungroup, others keep selected
        if (selectedModelArray.some((model) => model instanceof ThreeGroup && model.visible)) {
            const ungroupedModels = [];
            selectedModelArray.forEach((model) => {
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

            ungroupedModels.forEach((model) => {
                this.addModelToSelectedGroup(model);
                autoStickToPlate && model.stickToPlate();
            });
        }
        this.updatePrimeTowerHeight();
        return this.getState();
    }

    // for model simplify, only select a visible model.
    public canSimplify() {
        if (this.selectedModelArray.length === 1) {
            const model = this.selectedModelArray[0];
            if (model instanceof ThreeModel && model.visible) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    public canRepair() {
        if (this.models.length === 0) {
            return false;
        }
        if (this.selectedModelArray.length === 1 && !this.selectedModelArray[0].visible) {
            return false;
        }
        return true;
    }

    // prime tower
    public initPrimeTower(initHeight = 0.1, transformation: ModelTransformation) {
        return new PrimeTowerModel(initHeight, this, transformation);
    }

    public updatePrimeTowerHeight() {
        let maxHeight = 0.1;
        const maxBoundingBoxHeight = this._bbox?.max.z;
        this.getModels<Model3D>().forEach((modelItem) => {
            if (modelItem.headType === HEAD_PRINTING) {
                const modelItemHeight = modelItem.boundingBox?.max.z - modelItem.boundingBox?.min.z;
                maxHeight = Math.max(maxHeight, modelItemHeight);
            }
        });
        if (typeof this.primeTowerHeightCallback === 'function') {
            this.primeTowerHeightCallback(Math.min(maxHeight, maxBoundingBoxHeight));
        }
    }

    public filterModelsCanAttachSupport(models: TModel[] = this.models) {
        const modelsToAddSupport: ThreeModel[] = [];
        this.traverseModels(models, (subModel) => {
            if (subModel instanceof ThreeModel && subModel.visible) {
                modelsToAddSupport.push(subModel);
            }
        });
        return modelsToAddSupport;
    }

    public getModelsAttachedSupport(defaultSelectAllModels = true) {
        if (defaultSelectAllModels) {
            return this.filterModelsCanAttachSupport(this.models);
        } else {
            return this.filterModelsCanAttachSupport(this.selectedModelArray);
        }
    }

    public clearAllSupport(models: ThreeModel[]) {
        models.forEach((model) => {
            model.meshObject.clear();
            model.supportFaceMarks = [];
            model.stickToPlate();
        });
    }

    public startEditSupportArea() {
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

    public finishEditSupportArea(shouldApplyChanges: boolean) {
        const models = this.getModelsAttachedSupport();
        this.object.parent.remove(this.brushMesh);
        models.forEach((model) => {
            if (shouldApplyChanges) {
                const colors = model.meshObject.geometry.getAttribute('color').array as number[];
                const supportFaceMarks = [];
                for (let i = 0, j = 0; i < colors.length; i += 9, j++) {
                    // determine the support face by checking RGB value
                    const isSupportArea = colors.slice(i, i + 9).some((color) => {
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

    public setSupportBrushRadius(radius: number) {
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
            emissiveIntensity: 0.5
        });
        this.brushMesh = new Mesh(brushGeometry, brushMaterial);
        this.brushMesh.name = 'brushMesh';
        this.brushMesh.position.copy(position);
        this.object.parent.add(this.brushMesh);
    }

    public moveSupportBrush(raycastResult: Intersection[]) {
        this.brushMesh.position.copy(raycastResult[0].point);
    }

    public applySupportBrush(raycastResult: Intersection[], flag: 'add' | 'remove') {
        this.moveSupportBrush(raycastResult);
        const target = raycastResult.find((result) => result.object.userData.canSupport);
        if (target) {
            const targetMesh = target.object as Mesh;
            const geometry = targetMesh.geometry as BufferGeometry;
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
                    intersectsBounds: (box) => {
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
                        if (contained || (tri as unknown as {
                            intersectsSphere: (sphere: Sphere) => boolean
                        }).intersectsSphere(sphere)) {
                            const i3 = 3 * i;
                            indices.push(i3, i3 + 1, i3 + 2);
                        }
                        return false;
                    }
                });
                const colorAttr = geometry.getAttribute('color');
                const indexAttr = geometry.index;
                let color;
                if (flag === 'add') {
                    color = SUPPORT_ADD_AREA_COLOR;
                } else if (flag === 'remove') {
                    color = SUPPORT_AVAIL_AREA_COLOR;
                }
                for (let i = 0, l = indices.length; i < l; i++) {
                    const i2 = indexAttr.getX(indices[i]);
                    if (
                        Math.abs(colorAttr.getX(i2) - SUPPORT_AVAIL_AREA_COLOR[0]) < EPSILON
                        || Math.abs(colorAttr.getX(i2) - SUPPORT_ADD_AREA_COLOR[0]) < EPSILON
                    ) {
                        colorAttr.setX(i2, color[0]);
                        colorAttr.setY(i2, color[1]);
                        colorAttr.setZ(i2, color[2]);
                    }
                }
                colorAttr.needsUpdate = true;
            }
        }
    }

    public checkIfOverrideSupport() {
        const selectedAvailModels = this.getModelsAttachedSupport(false);
        const availModels = selectedAvailModels.length > 0 ? selectedAvailModels : this.getModelsAttachedSupport();
        return availModels.some((model) => {
            if (model.supportFaceMarks) {
                return model.supportFaceMarks.indexOf(1) > -1;
            }
            return false;
        });
    }

    public computeSupportArea(models: ThreeModel[], angle: number) {
        // group is not considered
        models.forEach((model) => {
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
            model.supportFaceMarks = supportFaceMarks;
        });
        return models;
    }

    public isSelectedModelAllVisible() {
        if (this.selectedModelArray.length === 0) {
            return false;
        }
        return this.selectedModelArray.every(model => {
            if (!model?.visible) {
                return false;
            } else if (model instanceof ThreeGroup) {
                return model.children.every((subModel) => subModel.visible);
            }
            return true;
        });
    }

    private getThreeModels() {
        const models: ThreeModel[] = [];
        this.traverseModels(this.models, (model) => {
            if (model instanceof ThreeModel) {
                models.push(model);
            }
        });
        return models;
    }

    public updatePlateAdhesion(config?: TAdhesionConfig) {
        if (config) {
            // init
            if (!this.adhesionConfig) {
                this.adhesionConfig = config;
                return;
            }
            // 判断是否需要更新
            let needUpdate = false;
            for (const [, key] of Object.keys(this.adhesionConfig).entries()) {
                needUpdate = needUpdate || this.adhesionConfig[key] !== config[key];
            }
            if (needUpdate) {
                this.adhesionConfig = config;
                this.clippingFinish(true);
            }
            return;
        }
        if (!this.adhesionConfig) {
            return;
        }
        this.plateAdhesion.clear();
        if (this.adhesionConfig.adhesionType === 'none') {
            return;
        }
        let paths = [];
        this.getThreeModels().filter((model) => {
            return model.visible && model.clipper;
        }).forEach((model) => {
            const polygonss = model.clipper.clippingMap.get(model.clipper.clippingConfig.layerHeight) || [];
            polygonss && polygonss.forEach((polygons) => {
                const _paths = (() => {
                    const res = PolygonsUtils.simplify(polygons, 0.2);
                    if (this.adhesionConfig.adhesionType === 'skirt') {
                        return res;
                    } else {
                        return PolygonsUtils.simplify(res, 0.2);
                    }
                })();
                if (paths.length === 0) {
                    paths = _paths;
                } else {
                    paths = polyUnion(paths, _paths);
                }
            });
        });
        if (paths.length === 0) {
            return;
        }
        switch (this.adhesionConfig.adhesionType) {
            case 'skirt':
                this.generateSkirt(paths);
                break;
            case 'brim':
                this.generateBrim(paths);
                break;
            case 'raft':
                this.generateRaft(paths);
                break;
            default:
                break;
        }
    }

    public generateSkirt(polygons: TPolygon[]) {
        workerManager.generatePlateAdhesion({
            adhesionType: 'skirt',
            polygons: Transfer(polygons as unknown as ArrayBuffer),
            skirtGap: this.adhesionConfig.skirtGap,
            skirtBrimLineWidth: this.adhesionConfig.skirtBrimLineWidth,
            skirtLineCount: this.adhesionConfig.skirtLineCount
        }, (res: TSkirtResult) => {
            if (this.models.length === 0) {
                return;
            }
            const positionObject = res.send;
            const linePosAttr = new BufferAttribute(
                positionObject.array,
                positionObject.itemSize,
                positionObject.normalized
            );
            const lineGeometry = new BufferGeometry();
            lineGeometry.setAttribute('position', linePosAttr);
            linePosAttr.setUsage(DynamicDrawUsage);

            const line = new LineSegments(lineGeometry, new LineBasicMaterial({
                linewidth: 2,
                side: FrontSide
            }));
            line.material.color.set(CLIPPING_LINE_COLOR).convertSRGBToLinear();
            line.frustumCulled = false;
            line.visible = true;
            this.plateAdhesion.add(line);
            this.onModelUpdate();
            // generateSkirt finish
        });
    }

    public generateBrim(polygons: TPolygon[]) {
        workerManager.generatePlateAdhesion({
            adhesionType: 'brim',
            polygons,
            skirtBrimLineWidth: this.adhesionConfig.skirtBrimLineWidth,
            brimLineCount: this.adhesionConfig.brimLineCount
        }, (res: TBrimResult) => {
            if (this.models.length === 0) {
                return;
            }
            const positionObject = res.linePosAttr.send;
            const linePosAttr = new BufferAttribute(
                positionObject.array,
                positionObject.itemSize,
                positionObject.normalized
            );
            const lineGeometry = new BufferGeometry();
            lineGeometry.setAttribute('position', linePosAttr);
            linePosAttr.setUsage(DynamicDrawUsage);

            const line = new LineSegments(lineGeometry, new LineBasicMaterial({
                linewidth: 2,
                side: FrontSide
            }));
            line.geometry.setDrawRange(0, res.length);
            line.material.color.set(CLIPPING_LINE_COLOR).convertSRGBToLinear();
            line.frustumCulled = false;
            line.visible = true;
            this.plateAdhesion.add(line);
            this.onModelUpdate();
            // generateBrim finish
        });
    }

    public generateRaft(polygons: TPolygon[]) {
        workerManager.generatePlateAdhesion({
            adhesionType: 'raft',
            polygons,
            raftMargin: this.adhesionConfig.raftMargin,
            skirtBrimLineWidth: this.adhesionConfig.skirtBrimLineWidth
        }, (arr: TRaftResult) => {
            if (this.models.length === 0) {
                return;
            }
            arr.send.forEach((vectors) => {
                const points = [];
                for (let i = 0; i < vectors.length; i++) {
                    points.push(new Vector2(vectors[i].x, vectors[i].y));
                }
                const RaftShape = new Shape(points);
                const geometry = new ShapeGeometry(RaftShape);

                const mesh = new Mesh(geometry, new MeshPhongMaterial({
                    color: '#3B83F6',
                    side: FrontSide
                }));
                mesh.position.setZ(0.02);
                this.plateAdhesion.add(mesh);
                // generateRaft finish
            });
            this.onModelUpdate();
        });
    }

    public calaClippingMap() {
        this.getThreeModels().forEach((model) => {
            model.updateClippingMap();
        });
    }

    public setSectionMesh() {
        if (!this.sectionMesh) {
            const planeGeom = new PlaneGeometry();
            const planeMat = new MeshStandardMaterial({
                color: SECTION_COLOR,
                metalness: 0.1,
                roughness: 0.75,
                clippingPlanes: [],
                stencilWrite: true,
                stencilRef: 0,
                stencilFunc: NotEqualStencilFunc,
                stencilFail: ReplaceStencilOp,
                stencilZFail: ReplaceStencilOp,
                stencilZPass: ReplaceStencilOp,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 20
            });
            this.sectionMesh = new Mesh(planeGeom, planeMat);
            this.sectionMesh.name = 'clippingSection';
            this.sectionMesh.frustumCulled = false;

            this.sectionMesh.onAfterRender = (renderer) => {
                renderer.clearStencil();
            };
            this.object.add(this.sectionMesh);
        }

        this.sectionMesh.geometry = new PlaneGeometry(planeMaxHeight, planeMaxHeight);
        const position = new Vector3();
        this.object.getWorldPosition(position);
        this.sectionMesh.position.copy(position);
        this.sectionMesh.position.setZ(planeMaxHeight);

        this.updateClippingPlane();
    }

    public updateClippingPlane(height?: number) {
        if (!height) {
            this.emit(ModelEvents.ClippingHeightReset);
        }
        !height && (height = planeMaxHeight);
        this.clippingHeight = height;

        this.sectionMesh?.position?.setZ(height);
        this.getThreeModels().filter((model) => {
            return model.visible && model.clipper;
        }).forEach((model) => {
            model.setLocalPlane(this.clippingHeight);
        });
        this.localPlane.constant = height;
    }

    public hasClipped() {
        let flag = true;
        this.traverseModels(this.models, (model) => {
            if (model instanceof ThreeModel && model.clipper?.busy) {
                flag = false;
            }
        });
        return flag;
    }

    public clippingFinish(finished: boolean) {
        if (finished) {
            const allDone = this.hasClipped();
            if (allDone) {
                this.updatePlateAdhesion();
                this.updateClippingPlane(this.localPlane.constant);
                this.models = [...this.models];
            }
        } else {
            this.clipping = 'true';
            this.plateAdhesion.clear();
            this.onModelUpdate();
            this.updateClippingPlane();
        }
    }

    public setTransformMode(value: string) {
        if (value) {
            this.updateClippingPlane(planeMaxHeight);
            this.emit(ModelEvents.ClippingHeightReset, true);
        }
    }
}

export default ModelGroup;
