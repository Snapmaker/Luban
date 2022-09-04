import { Box3, DynamicDrawUsage, Matrix4, Plane } from 'three';
import * as THREE from 'three';
import { debounce } from 'lodash';
import type ThreeModel from './ThreeModel';
import type ModelGroup from './ModelGroup';
// import { ModelTransformation } from './ThreeBaseModel';
import generateLine from '../lib/generate-line';
import { CLIPPING_LINE_COLOR, PLANE_MAX_HEIGHT } from './ModelGroup';
import { bufferToPoint } from '../lib/buffer-utils';
import workerManager from '../lib/manager/workerManager';

export type TPolygon = ArrayBuffer[]

type TInfillPattern = 'lines' | 'grid' | 'triangles' | 'trihexagon' | 'cubic'

export type TClippingConfig = {
    wallThickness: number;
    lineWidth: number;
    topLayers: number;
    bottomLayers: number;
    layerHeight: number;
    infillSparseDensity: number;
    infillPattern: TInfillPattern;
    magicSpiralize: boolean;
}

class ClippingModel {
    private localPlane: Plane;
    private colliderBvhMatrix: Matrix4;
    public clippingMap = new Map<number, TPolygon[]>();
    private innerWallMap = new Map<number, TPolygon[][]>();
    private skinMap = new Map<number, TPolygon[]>();
    private infillMap = new Map<number, TPolygon[]>();
    private meshObjectGroup: THREE.Group;
    private modelGeometry: THREE.BufferGeometry;
    private modelBoundingBox: Box3
    private model: ThreeModel
    private modelGroup: ModelGroup

    public busy = false
    public group: THREE.Group = new THREE.Group();

    declare private modelMeshObject: THREE.Mesh;

    // private extraSkinWallCount = 1
    public clippingConfig: TClippingConfig;

    private clippingWall: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private clippingSkin: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private clippingSkinArea: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private clippingInfill: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

    public constructor(model: ThreeModel, modelGroup: ModelGroup, localPlane: Plane, clippingConfig: TClippingConfig) {
        this.model = model;
        this.modelMeshObject = model.meshObject;
        this.modelGeometry = this.modelMeshObject.geometry as unknown as THREE.BufferGeometry;
        this.modelGroup = modelGroup;
        this.modelBoundingBox = model.boundingBox;
        this.localPlane = localPlane;
        this.clippingConfig = clippingConfig;

        this.init();
    }

    private createLine(color) {
        const lineGeometry = new THREE.BufferGeometry();
        const linePosAttr = new THREE.BufferAttribute(new Float32Array([]), 3, false);
        linePosAttr.setUsage(DynamicDrawUsage);
        lineGeometry.setAttribute('position', linePosAttr);
        const line = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({
            linewidth: 1,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -20
        }));
        line.material.color.set(color);
        line.frustumCulled = false;
        line.visible = true;
        line.name = 'line';
        return line;
    }

    public init() {
        this.group.remove(...this.group.children);

        this.modelMeshObject = this.model.meshObject;
        this.modelGeometry = this.modelMeshObject.geometry as unknown as THREE.BufferGeometry;
        this.modelBoundingBox = this.model.boundingBox;

        this.colliderBvhMatrix = this.model.meshObject.matrixWorld.clone();
        this.clippingWall = this.createLine(CLIPPING_LINE_COLOR);
        this.clippingSkin = this.createLine(CLIPPING_LINE_COLOR);
        this.clippingSkinArea = this.createLine(CLIPPING_LINE_COLOR);
        this.clippingInfill = this.createLine(CLIPPING_LINE_COLOR);
        this.startCala();

        this.createPlaneStencilGroup();
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

    public updateClippingMap(matrixWorld: Matrix4, boundingBox: Box3) {
        this.modelBoundingBox = boundingBox;
        if (this.colliderBvhMatrix.equals(matrixWorld)) {
            return false;
        }
        this.updateBvhMatrix(matrixWorld.clone());
        this.startCala();
        return true;
    }

    public updateBvhMatrix(transformation: Matrix4) {
        this.colliderBvhMatrix = transformation;
    }

    public clear = async () => {
        this.clippingMap.clear();
        this.innerWallMap.clear();
        this.skinMap.clear();
        this.infillMap.clear();
    }

    private startCala = () => {
        this.busy = true;
        this.calaClippingWall();
    }

    private calaClippingWall = debounce(() => {
        this.modelGroup.clippingFinish(false);
        this.clear();
        if (!workerManager.clipperWorkerEnable) {
            return;
        }
        this.model.computeBoundingBox();

        const modelMatrix = new THREE.Matrix4();
        this.modelMeshObject.updateMatrixWorld();
        modelMatrix.copy(this.modelMeshObject.matrixWorld);
        const wallCount = Math.max(1, Math.round((this.clippingConfig.wallThickness - this.clippingConfig.lineWidth) / this.clippingConfig.lineWidth) + 1);

        workerManager.calculateSectionPoints<{
            clippingMap: Map<number, TPolygon[]>,
            innerWallMap: Map<number, TPolygon[][]>,
            skinMap: Map<number, TPolygon[]>,
            infillMap: Map<number, TPolygon[]>
        }>({
            modelID: this.model.modelID,
            positionAttribute: this.modelGeometry.getAttribute('position') as unknown as { array: number[]; itemSize: number; normalized: boolean; },
            modelMatrix,
            wallCount,
            layerHeight: this.clippingConfig.layerHeight,
            modelName: this.model.modelName,
            boundingBox: this.model.boundingBox,
            clippingConfig: this.clippingConfig,
            modelBoundingBox: this.modelBoundingBox,
        }).then(({ clippingMap, innerWallMap, skinMap, infillMap }) => {
            this.busy = false;
            this.clippingMap = clippingMap;
            this.innerWallMap = innerWallMap;
            this.skinMap = skinMap;
            this.infillMap = infillMap;
            // emit modelGroup, to updatePlateAdhesion
            this.modelGroup.clippingFinish(true);
        }).catch(() => {
            // This calculation is cancelled
            this.clear();
            this.modelGroup.clippingFinish(false);
        });
    }, 1000)


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
                const points = bufferToPoint(vectors);
                for (let i = 0; i < points.length; i++) {
                    const begin = points[i];
                    const end = points[i + 1];
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
            this.setLocalPlane(PLANE_MAX_HEIGHT);
            this.startCala();
        } else if (this.clippingConfig.infillPattern !== config.infillPattern) {
            this.clippingConfig = config;
            this.updateClippingInfill(this.localPlane.constant);
        } else if (this.clippingConfig.magicSpiralize !== config.magicSpiralize) {
            this.setLocalPlane(this.localPlane.constant);
        }
    }

    public updateClippingSkin(clippingHeight: number) {
        if (this.clippingConfig.magicSpiralize || clippingHeight > this.modelBoundingBox.max.z) {
            this.clippingSkin.visible = false;
            this.clippingSkinArea.visible = false;
            return;
        }
        const posAttr = this.clippingSkin.geometry;
        const posAttrArea = this.clippingSkinArea.geometry;
        const polygons = this.skinMap.get(clippingHeight);
        const arr1 = [];
        const arr2 = [];
        if (polygons && polygons.length > 0) {
            const arr = [];
            polygons.forEach((polygon) => {
                polygon.forEach((vectors) => {
                    const points = bufferToPoint(vectors);
                    for (let k = 0; k < points.length; k++) {
                        const begin = points[k];
                        const end = points[k + 1];
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
                this.clippingSkin.visible = false;
                this.clippingSkinArea.visible = false;
                return;
            }
            // skinArea
            arr.forEach((point) => {
                point && arr1.push(point.x, point.y, clippingHeight);
            });
            skinLines.forEach((point) => {
                arr2.push(point.x, point.y, clippingHeight);
            });
            this.clippingSkin.position.copy(this.localPlane.normal).multiplyScalar(-0.002);
            this.clippingSkinArea.position.copy(this.localPlane.normal).multiplyScalar(-0.002);

            posAttr.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr1), 3));
            posAttrArea.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr2), 3));
            this.clippingSkin.updateMatrix();
            this.clippingSkinArea.updateMatrix();

            this.clippingSkin.visible = true;
            this.clippingSkinArea.visible = true;
        } else {
            this.clippingSkin.visible = false;
            this.clippingSkinArea.visible = false;
        }
    }

    private setPointFromPolygon(arr, polygon, clippingHeight) {
        polygon.forEach((buffer) => {
            const paths = bufferToPoint(buffer);
            for (let i = 0; i < paths.length; i++) {
                const start = paths[i];
                const end = paths[i + 1];
                if (end) {
                    arr.push(start.x, start.y, clippingHeight);
                    arr.push(end.x, end.y, clippingHeight);
                }
            }
        });
    }

    private updateClippingWall(clippingHeight: number) {
        const posAttr = this.clippingWall.geometry;
        const arr = [];
        const polygons = this.clippingMap.get(clippingHeight);
        if (polygons && polygons.length > 0 && clippingHeight <= this.modelBoundingBox.max.z) {
            polygons.forEach((polygon) => {
                this.setPointFromPolygon(arr, polygon, clippingHeight);
            });
            if (!this.clippingConfig.magicSpiralize) {
                const polygonss = this.innerWallMap.get(clippingHeight) || [];
                polygonss.forEach((_polygons) => {
                    _polygons.forEach((polygon) => {
                        polygon.forEach((vectors) => {
                            const points = bufferToPoint(vectors);
                            for (let i = 0; i < points.length; i++) {
                                const begin = points[i];
                                const end = points[i + 1];
                                if (end) {
                                    arr.push(begin.x, begin.y, clippingHeight);
                                    arr.push(end.x, end.y, clippingHeight);
                                }
                            }
                        });
                    });
                });
            }

            posAttr.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));

            this.clippingWall.position.copy(this.localPlane.normal).multiplyScalar(-0.002);
            this.clippingWall.updateMatrix();
            this.clippingWall.visible = true;
        } else {
            this.clippingWall.visible = false;
        }
    }

    private updateClippingInfill(clippingHeight: number) {
        const posAttr = this.clippingInfill.geometry;
        const arr = [];
        const polygons = this.infillMap.get(clippingHeight);
        if (!this.clippingConfig.magicSpiralize && polygons && polygons.length !== 0 && clippingHeight <= this.modelBoundingBox.max.z) {
            const skinLines = this.generateLineInfill(clippingHeight, polygons);
            if (!skinLines.length) {
                this.clippingInfill.visible = false;
                return;
            }
            skinLines.forEach((skinLine) => {
                skinLine.forEach((point) => {
                    arr.push(point.x, point.y, clippingHeight);
                });
            });
            posAttr.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
            this.clippingInfill.position.copy(this.localPlane.normal).multiplyScalar(-0.002);
            this.clippingInfill.updateMatrix();
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
        workerManager.stopCalculateSectionPoints(this.model.modelID);

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

        this.model.setLocalPlane(PLANE_MAX_HEIGHT);
    }
}

export default ClippingModel;
