import { Box3, DynamicDrawUsage, Plane } from 'three';
import * as THREE from 'three';
import { Observable, Subscription } from 'rxjs';
import { Transfer } from 'threads';
import { debounce } from 'lodash';
import type ThreeModel from './ThreeModel';
import type ModelGroup from './ModelGroup';
import { ModelTransformation } from './ThreeBaseModel';
import generateLine from '../lib/generate-line';
import { CLIPPING_LINE_COLOR, planeMaxHeight } from './ModelGroup';
import clippingPoolManager from '../lib/manager/ClippingPoolManager';

type TPoint = {
    x: number,
    y: number,
    z?: number
}

export type TPolygon = TPoint[][]

type TInfillPattern = 'lines' | 'grid' | 'triangles' | 'trihexagon' | 'cubic'

type TClippingConfig = {
    wallThickness: number;
    lineWidth: number;
    topLayers: number;
    bottomLayers: number;
    layerHeight: number;
    infillSparseDensity: number;
    infillPattern: TInfillPattern
}

class ClippingModel {
    private localPlane: Plane;
    private colliderBvhTransform: ModelTransformation;
    public clippingMap = new Map<number, TPolygon[]>();
    private innerWallMap = new Map<number, TPolygon[][]>();
    private skinMap = new Map<number, TPolygon[]>();
    private infillMap = new Map<number, TPolygon[]>();
    private clippingWorkerMap: Map<number, () => void> = new Map();
    private meshObjectGroup: THREE.Group;
    private modelGeometry: THREE.BufferGeometry;
    private modelBoundingBox: Box3
    private subscriber: Subscription;
    private model: ThreeModel
    private modelGroup: ModelGroup

    public group: THREE.Group = new THREE.Group();

    declare private modelMeshObject: THREE.Mesh;

    // private extraSkinWallCount = 1
    public clippingConfig: TClippingConfig = {
        bottomLayers: 1,
        infillSparseDensity: 15,
        layerHeight: 1,
        lineWidth: 0.4,
        topLayers: 1,
        wallThickness: 0.8,
        infillPattern: 'cubic'
    }

    private clippingWall: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private clippingSkin: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private clippingSkinArea: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private clippingInfill: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

    public constructor(model: ThreeModel, modelGroup: ModelGroup, localPlane: Plane) {
        this.model = model;
        this.modelMeshObject = model.meshObject;
        this.modelGeometry = this.modelMeshObject.geometry as unknown as THREE.BufferGeometry;
        this.modelGroup = modelGroup;
        this.modelBoundingBox = model.boundingBox;
        this.localPlane = localPlane;

        this.init();
    }

    public get busy() {
        return this.clippingWorkerMap.size !== 0;
    }

    private reCala = debounce(this.calaClippingWall)

    private createLine(color) {
        const lineGeometry = new THREE.BufferGeometry();
        const linePosAttr = new THREE.BufferAttribute(new Float32Array(300000), 3, false);
        linePosAttr.setUsage(DynamicDrawUsage);
        lineGeometry.setAttribute('position', linePosAttr);
        const line = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({
            linewidth: 1,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -20
        }));
        line.material.color.set(color).convertSRGBToLinear();
        line.frustumCulled = false;
        line.visible = true;
        line.name = 'line';
        return line;
    }

    public init() {
        this.modelBoundingBox = this.model.boundingBox;
        this.colliderBvhTransform = { ...this.model.transformation };
        this.createPlaneStencilGroup();
        this.clippingWall = this.createLine(CLIPPING_LINE_COLOR);
        this.clippingSkin = this.createLine(CLIPPING_LINE_COLOR);
        this.clippingSkinArea = this.createLine(CLIPPING_LINE_COLOR);
        this.clippingInfill = this.createLine(CLIPPING_LINE_COLOR);
        this.reCala();

        this.group.add(this.clippingWall, this.clippingSkin, this.clippingSkinArea, this.clippingInfill);
        this.model.onTransform();
    }

    public createPlaneStencilGroup() {
        const group = new THREE.Group();
        const baseMat = new THREE.MeshBasicMaterial();
        baseMat.depthWrite = false;
        baseMat.depthTest = false;
        baseMat.colorWrite = false;
        baseMat.stencilWrite = true;
        baseMat.stencilFunc = THREE.AlwaysStencilFunc;

        // back faces
        const mat0 = baseMat.clone();
        mat0.side = THREE.BackSide;
        mat0.clippingPlanes = [this.localPlane];
        mat0.stencilFail = THREE.IncrementWrapStencilOp;
        mat0.stencilZFail = THREE.IncrementWrapStencilOp;
        mat0.stencilZPass = THREE.IncrementWrapStencilOp;
        const meshBackSide = new THREE.Mesh(this.modelGeometry, mat0);
        group.add(meshBackSide);

        // front faces
        const mat1 = baseMat.clone();
        mat1.side = THREE.FrontSide;
        mat1.clippingPlanes = [this.localPlane];
        mat1.stencilFail = THREE.DecrementWrapStencilOp;
        mat1.stencilZFail = THREE.DecrementWrapStencilOp;
        mat1.stencilZPass = THREE.DecrementWrapStencilOp;
        const meshFrontSide = new THREE.Mesh(this.modelGeometry, mat1);
        group.add(meshFrontSide);

        const position = new THREE.Vector3();

        group.position.copy(position);
        this.meshObjectGroup = group;
        this.group.add(this.meshObjectGroup);
    }

    public async updateClippingMap(transformation: ModelTransformation, boundingBox: Box3) {
        this.modelBoundingBox = boundingBox;
        let tags = ['rotationX', 'rotationY', 'rotationZ', 'scaleX', 'scaleY', 'scaleZ'];
        let re = tags.some((tag) => {
            return this.colliderBvhTransform[tag] !== transformation[tag];
        });
        if (re) {
            for (const [, terminate] of this.clippingWorkerMap.entries()) {
                terminate();
            }
            this.clippingWorkerMap.clear();
            this.updateBvhGeometry(transformation);
            this.reCala();
            return;
        }

        tags = ['positionX', 'positionY', 'positionZ'];
        re = tags.some((tag) => {
            return this.colliderBvhTransform[tag] !== transformation[tag];
        });
        if (re) {
            this.updateBvhGeometry(transformation);
            this.reCala();
        }
    }

    public updateBvhGeometry(transformation: ModelTransformation) {
        this.colliderBvhTransform = { ...transformation };
    }


    private cancalWorkers = () => {
        for (const [, cancel] of this.clippingWorkerMap) {
            cancel();
        }
        this.clippingWorkerMap.clear();
    }

    public async calaClippingWall() {
        this.modelGroup.clippingFinish(false);
        if (this.subscriber) {
            Promise.resolve(this.subscriber.unsubscribe());
            this.cancalWorkers();
            // stop worker pool
        }
        for (const [, terminate] of this.clippingWorkerMap.entries()) {
            terminate();
        }
        this.clippingWorkerMap.clear();
        this.clippingMap.clear();
        this.innerWallMap.clear();
        this.skinMap.clear();
        this.infillMap.clear();

        const modelMatrix = new THREE.Matrix4();
        this.modelMeshObject.updateMatrixWorld();
        modelMatrix.copy(this.modelMeshObject.matrixWorld);
        const wallCount = Math.max(1, Math.round((this.clippingConfig.wallThickness - this.clippingConfig.lineWidth) / this.clippingConfig.lineWidth) + 1);

        const observable = new Observable((subscriber) => {
            const seectionTask = clippingPoolManager.calculateSectionPoints({
                positionAttribute: Transfer(this.modelGeometry.getAttribute('position') as unknown as ArrayBuffer),
                modelMatrix,
                height: this.modelBoundingBox.max.z,
                layerHeight: this.clippingConfig.layerHeight
            }, ({ layerTop, vectors }) => {
                const now2 = new Date().getTime();
                const task = clippingPoolManager.sortUnorderedLine({
                    fragments: Transfer(vectors as unknown as ArrayBuffer),
                    layerHeight: layerTop,
                    innerWallCount: wallCount,
                    lineWidth: this.clippingConfig.lineWidth,
                    time: now2
                }, (res) => {
                    if (res) {
                        this.clippingMap.set(layerTop, res.outWall.send);
                        this.innerWallMap.set(layerTop, res.innerWall.send);
                    } else {
                        this.clippingMap.set(layerTop, [[]]);
                        this.innerWallMap.set(layerTop, [[]]);
                    }
                    this.clippingWorkerMap.delete(layerTop);
                    subscriber.next(this.clippingWorkerMap);
                    if (this.clippingWorkerMap.size === 0) {
                        // wall complete
                        subscriber.complete();
                    }
                });
                this.clippingWorkerMap.set(layerTop, task.terminate);
            }, () => {
                this.clippingWorkerMap.delete(0);
            });
            this.clippingWorkerMap.set(0, seectionTask.terminate);
        });
        const subscriber = observable.subscribe({
            complete: () => {
                this.calaClippingSkin();
            }
        });
        this.subscriber = subscriber;
    }

    public calaClippingSkin() {
        const wallCount = Math.max(1, Math.round((this.clippingConfig.wallThickness - this.clippingConfig.lineWidth) / this.clippingConfig.lineWidth) + 1);

        const observable = new Observable(subscriber => {
            const skinTask = clippingPoolManager.mapClippingSkinArea({
                innerWallMap: this.innerWallMap,
                innerWallCount: wallCount,
                lineWidth: this.clippingConfig.lineWidth,
                bottomLayers: this.clippingConfig.bottomLayers,
                topLayers: this.clippingConfig.topLayers,
                modelBoundingBox: this.modelBoundingBox,
                layerHeight: this.clippingConfig.layerHeight
            }, ({ otherLayers, layerTop }) => {
                const currentInnerWall = this.innerWallMap.get(layerTop) ? this.innerWallMap.get(layerTop)[wallCount - 1] : [];
                const task = clippingPoolManager.calaClippingSkin({
                    currentInnerWall,
                    otherLayers: otherLayers.send,
                    lineWidth: this.clippingConfig.lineWidth
                }, (res) => {
                    this.skinMap.set(layerTop, res.skin);
                    this.infillMap.set(layerTop, res.infill);
                    this.clippingWorkerMap.delete(layerTop);
                    subscriber.next(this.clippingWorkerMap);
                    if (this.clippingWorkerMap.size === 0) {
                        subscriber.complete();
                    }
                });
                this.clippingWorkerMap.set(layerTop, task.terminate);
            }, () => {
                this.clippingWorkerMap.delete(0);
            });
            this.clippingWorkerMap.set(0, skinTask.terminate);
        });
        this.subscriber = observable.subscribe({
            complete: () => {
                // emit modelGroup, to updatePlateAdhesion
                this.modelGroup.clippingFinish(true);
            }
        });
    }

    private getInfillConfig(clippingHeight: number) {
        switch (this.clippingConfig.infillPattern) {
            case 'lines':
                return [
                    {
                        anagle: Number(
                            (clippingHeight / this.clippingConfig.layerHeight).toFixed(0)
                        ) % 2 ? 135 : 45,
                        infillDistance: 1
                    }
                ];
            case 'grid':
                return [
                    { anagle: 45, infillDistance: 2 },
                    { anagle: 135, infillDistance: 2 }
                ];
            case 'triangles':
                return [
                    { anagle: 0, infillDistance: 3 },
                    { anagle: 60, infillDistance: 3 },
                    { anagle: 120, infillDistance: 3 }
                ];
            case 'trihexagon':
                return [
                    { anagle: 0, infillDistance: 3 },
                    { anagle: 60, infillDistance: 3 },
                    { anagle: 120, offset: 0.5, infillDistance: 3 }
                ];
            case 'cubic':
                return [
                    { anagle: 0, offset: 1.0 / Math.sqrt(2.0), infillDistance: 3 },
                    { anagle: 120, offset: 1.0 / Math.sqrt(2.0), infillDistance: 3 },
                    { anagle: 240, offset: 1.0 / Math.sqrt(2.0), infillDistance: 3 }
                ];
            default:
                return [];
        }
    }

    public generateLineInfill(clippingHeight: number, infillArea: TPolygon[]) {
        const arr = [];
        infillArea.forEach((polygon) => {
            polygon.forEach((vectors) => {
                for (let i = 0; i < vectors.length; i++) {
                    const begin = vectors[i];
                    const end = vectors[i + 1];
                    arr.push(begin, end);
                }
            });
        });

        const configs = this.getInfillConfig(clippingHeight);
        return configs.map((config) => {
            const infillDistance = this.clippingConfig.lineWidth * 100 / this.clippingConfig.infillSparseDensity * config.infillDistance;
            return generateLine([...arr], infillDistance, config.anagle, this.model.boundingBox, clippingHeight, config.offset);
        });
    }

    public updateClipperConfig(config: TClippingConfig) {
        if (
            this.clippingConfig.layerHeight !== config.layerHeight
            || this.clippingConfig.bottomLayers !== config.bottomLayers
            || this.clippingConfig.topLayers !== config.topLayers
            || this.clippingConfig.wallThickness !== config.wallThickness
            || this.clippingConfig.lineWidth !== config.lineWidth
        ) {
            this.clippingConfig = config;
            for (const [, terminate] of this.clippingWorkerMap.entries()) {
                terminate();
            }
            this.setLocalPlane(planeMaxHeight);
            this.clippingWorkerMap.clear();
            this.reCala();
        } else {
            this.clippingConfig = config;
            this.updateClippingInfill(this.localPlane.constant);
        }
    }

    public updateClippingSkin(clippingHeight: number) {
        if (clippingHeight > this.modelBoundingBox.max.z) {
            this.clippingSkin.visible = false;
            this.clippingSkinArea.visible = false;
            return;
        }
        const posAttr = this.clippingSkin.geometry.attributes.position;
        const posAttrArea = this.clippingSkinArea.geometry.attributes.position;
        const polygons = this.skinMap.get(clippingHeight);
        if (polygons && polygons.length > 0) {
            const arr = [];
            polygons.forEach((polygon) => {
                polygon.forEach((vectors) => {
                    for (let k = 0; k < vectors.length; k++) {
                        const begin = vectors[k];
                        const end = vectors[k + 1];
                        if (end) {
                            arr.push(begin, end);
                        }
                    }
                });
            });
            if (arr.length === 0) {
                this.clippingSkin.visible = false;
                this.clippingSkinArea.visible = false;
                return;
            }
            const skinLines = generateLine([...arr], 1, Number(
                (clippingHeight / this.clippingConfig.layerHeight).toFixed(0)
            ) % 2 ? 135 : 45, this.modelBoundingBox, clippingHeight);
            if (!skinLines.length) {
                return;
            }
            let i = 0;
            // skinArea
            arr.forEach((point) => {
                point && posAttrArea.setXYZ(i++, point.x, point.y, clippingHeight);
            });
            let j = 0;
            skinLines.forEach((point) => {
                posAttr.setXYZ(j, point.x, point.y, clippingHeight);
                j++;
            });
            this.clippingSkin.geometry.setDrawRange(0, j);
            this.clippingSkinArea.geometry.setDrawRange(0, i);
            this.clippingSkin.position.copy(this.localPlane.normal).multiplyScalar(-0.002);
            this.clippingSkinArea.position.copy(this.localPlane.normal).multiplyScalar(-0.002);
            posAttr.needsUpdate = true;

            posAttrArea.needsUpdate = true;

            this.clippingSkin.visible = true;
            this.clippingSkinArea.visible = true;
        } else {
            this.clippingSkin.visible = false;
            this.clippingSkinArea.visible = false;
        }
    }

    private setPointFromPolygon(posAttr, polygon, clippingHeight, temp) {
        polygon.forEach((paths) => {
            for (let i = 0; i < paths.length; i++) {
                const start = paths[i];
                const end = paths[i + 1];
                if (end) {
                    posAttr.setXYZ(temp.index++, start.x, start.y, clippingHeight);
                    posAttr.setXYZ(temp.index++, end.x, end.y, clippingHeight);
                }
            }
        });
    }

    private updateClippingWall(clippingHeight: number) {
        const posAttr = this.clippingWall.geometry.attributes.position;

        const polygons = this.clippingMap.get(clippingHeight);
        if (polygons && polygons.length > 0 && clippingHeight <= this.modelBoundingBox.max.z) {
            const temp = { index: 0 };
            polygons.forEach((polygon) => {
                this.setPointFromPolygon(posAttr, polygon, clippingHeight, temp);
            });

            const polygonss = this.innerWallMap.get(clippingHeight) || [];
            polygonss.forEach((_polygons) => {
                _polygons.forEach((polygon) => {
                    polygon.forEach((vectors) => {
                        for (let i = 0; i < vectors.length; i++) {
                            const begin = vectors[i];
                            const end = vectors[i + 1];
                            if (end) {
                                posAttr.setXYZ(temp.index++, begin.x, begin.y, clippingHeight);
                                posAttr.setXYZ(temp.index++, end.x, end.y, clippingHeight);
                            }
                        }
                    });
                });
            });

            this.clippingWall.geometry.setDrawRange(0, temp.index);
            this.clippingWall.position.copy(this.localPlane.normal).multiplyScalar(-0.002);

            posAttr.needsUpdate = true;
            this.clippingWall.visible = true;
        } else {
            this.clippingWall.visible = false;
        }
    }

    private updateClippingInfill(clippingHeight: number) {
        const posAttr = this.clippingInfill.geometry.attributes.position;
        const polygons = this.infillMap.get(clippingHeight);
        if (polygons && polygons.length !== 0 && clippingHeight <= this.modelBoundingBox.max.z) {
            const skinLines = this.generateLineInfill(clippingHeight, polygons);
            if (!skinLines.length) {
                this.clippingInfill.visible = false;
                return;
            }
            let j = 0;
            skinLines.forEach((skinLine) => {
                skinLine.forEach((point) => {
                    posAttr.setXYZ(j, point.x, point.y, clippingHeight);
                    j++;
                });
            });
            this.clippingInfill.geometry.setDrawRange(0, j);
            this.clippingInfill.position.copy(this.localPlane.normal).multiplyScalar(-0.002);
            posAttr.needsUpdate = true;
            this.clippingInfill.visible = true;
        } else {
            this.clippingInfill.visible = false;
        }
    }

    public setLocalPlane(height) {
        this.updateClippingWall(height);
        this.updateClippingSkin(height);
        this.updateClippingInfill(height);
    }

    public onTransform() {
        const position = new THREE.Vector3();
        this.modelMeshObject.getWorldPosition(position);
        const scale = new THREE.Vector3();
        this.modelMeshObject.getWorldScale(scale);
        const quaternion = new THREE.Quaternion();
        this.modelMeshObject.getWorldQuaternion(quaternion);
        const rotation = new THREE.Euler().setFromQuaternion(quaternion, undefined);

        this.meshObjectGroup?.position.copy(position);
        this.meshObjectGroup?.scale.copy(scale);
        this.meshObjectGroup?.rotation.copy(rotation);

        this.model.setLocalPlane(planeMaxHeight);
    }
}

export default ClippingModel;
