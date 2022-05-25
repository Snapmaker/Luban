import { v4 as uuid } from 'uuid';
import * as THREE from 'three';
import noop from 'lodash/noop';
import { MeshLambertMaterial, Object3D, ObjectLoader } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { Observable } from 'rxjs';
import {
    LOAD_MODEL_FROM_INNER
} from '../constants';
import ThreeUtils from '../three-extensions/ThreeUtils';
import ThreeGroup from './ThreeGroup';
import BaseModel, { ModelInfo, ModelTransformation, TSize } from './ThreeBaseModel';
import { machineStore } from '../store/local-storage';
import type ModelGroup from './ModelGroup';
import calculateSectionPoints from '../lib/calculate-section-points';
import workerManager from '../lib/manager/workerManager';

const materialOverstepped = new THREE.Color(0xa80006);

type TPoint = {
    x: number,
    y: number,
    z?: number
}

class ThreeModel extends BaseModel {
    public isThreeModel = true;

    public target: unknown = null;
    public originalPosition: TSize;
    public supportTag = false;
    public supportFaceMarks: number[] = [];
    public convexGeometry: THREE.Geometry;

    public originalGeometry: THREE.BufferGeometry;
    public tmpSupportMesh: Object3D;

    // declare public meshObject: THREE.Mesh;
    declare public meshObject: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial> & { uniformScalingState?: boolean };

    public isEditingSupport = false;
    public clippingGroup = new THREE.Group();

    private geometry: THREE.BufferGeometry;

    private processImageName: string;
    private _materialNormal: THREE.Color;
    private _materialSelected: THREE.Color;

    private localPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 50);
    private colliderBvh: MeshBVH;
    private colliderBvhTransform: ModelTransformation;
    private clippingMap = new Map<number, TPoint[][]>();
    private innerWallMap = new Map<number, TPoint[][]>();
    private skinMap = new Map<number, TPoint[][]>();
    public infillMap = new Map<number, TPoint[][]>();
    private clippingWorkerMap: Map<number, () => void> = new Map();
    private meshObjectGroup: THREE.Group;
    private bvhGeometry: THREE.BufferGeometry;
    private sectionMesh: THREE.Mesh;
    private observable: Observable<Map<number, () => void>>;

    public constructor(modelInfo: ModelInfo, modelGroup: ModelGroup) {
        super(modelInfo, modelGroup);
        const { width, height, processImageName } = modelInfo;

        this.geometry = modelInfo.geometry || new THREE.PlaneGeometry(width, height) as unknown as THREE.BufferGeometry;
        let material = modelInfo.material || new THREE.MeshStandardMaterial({ color: 0xe0e0e0, visible: false });

        try {
            const objectLoader = new ObjectLoader();
            const json = JSON.parse(machineStore.get('scene'));
            const images = objectLoader.parseImages(json.images, noop);
            const textures = objectLoader.parseTextures(json.textures, images);
            const materials = objectLoader.parseMaterials(json.materials, textures);
            const newMaterial = Object.values(materials)[0] as THREE.MeshStandardMaterial;
            material = newMaterial;
            // this.localPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 5);
            material.clippingPlanes = [this.localPlane];

            // material.side = THREE.FrontSide;
            // material.stencilWrite = true;
            // material.stencilFail = THREE.DecrementWrapStencilOp;
            // material.stencilZFail = THREE.DecrementWrapStencilOp;
            // material.stencilZPass = THREE.DecrementWrapStencilOp;
            // plane is clipped by the other clipping planes

            this.modelModeMaterial = material;
            // Line version
            this.gcodeModeMaterial = new MeshLambertMaterial({
                color: '#2a2c2e',
                side: THREE.DoubleSide,
                depthWrite: false,
                transparent: true,
                opacity: 0.3,
                polygonOffset: true,
                polygonOffsetFactor: -5,
                polygonOffsetUnits: -0.1

            });
            // Linetube version, not remove
            // this.gcodeModeMaterial = new MeshLambertMaterial({
            //     color: '#2a2c2e',
            //     side: DoubleSide,
            //     depthWrite: false,
            //     transparent: true,
            //     opacity: 0.3,
            //     polygonOffset: true,
            //     polygonOffsetFactor: -1,
            //     polygonOffsetUnits: -5
            // });
        } catch (e) {
            console.warn('error', e);
        }
        if (modelInfo.geometry) {
            const clonedGeometry = modelInfo.geometry.clone();
            // share positions, normals, uvs, not geometry, so we can define colors for each geometry
            const position = modelInfo.geometry.getAttribute('position');
            const normal = modelInfo.geometry.getAttribute('normal');
            position && clonedGeometry.setAttribute('position', position);
            normal && clonedGeometry.setAttribute('normal', normal);
            this.geometry = clonedGeometry;
        } else {
            this.geometry = new THREE.PlaneGeometry(width, height) as unknown as THREE.BufferGeometry;
        }

        this.meshObject = new THREE.Mesh(this.geometry, material);
        this.meshObject.name = modelInfo?.uploadName;

        this.processImageName = processImageName;

        if (!this.transformation.width && !this.transformation.height) {
            this.transformation.width = width;
            this.transformation.height = height;
        }
        if (width && height) {
            this.transformation.scaleX = this.transformation.width / width;
            this.transformation.scaleY = this.transformation.height / height;
        }

        this.boundingBox = null;
        this.overstepped = false;
        this.convexGeometry = null;
        this.modelGroup = modelGroup;

        if (modelInfo.convexGeometry) {
            this.setConvexGeometry(modelInfo.convexGeometry);
        }

        this.updateTransformation(this.transformation);
        this.meshObject.addEventListener('update', this.modelGroup.onModelUpdate);
        if (modelInfo.loadFrom === LOAD_MODEL_FROM_INNER) {
            if (this.sourceType === '3d' && this.transformation.positionX === 0 && this.transformation.positionY === 0) {
                this.stickToPlate();
                const point = modelGroup._computeAvailableXY(this);
                this.meshObject.position.x = point.x;
                this.meshObject.position.y = point.y;
                this.transformation.positionX = point.x;
                this.transformation.positionY = point.y;
            }
        }


        this.updateMaterialColor(modelInfo.color ?? '#cecece');

        // create the collider and preview mesh
        this.bvhGeometry = this.geometry.clone();
        const inverseMatrix = new THREE.Matrix4();
        this.meshObject.updateMatrixWorld();
        inverseMatrix.copy(this.meshObject.matrixWorld);
        this.bvhGeometry.applyMatrix4(inverseMatrix);

        // this.bvhGeometry.translate(this.transformation.positionX, this.transformation.positionY, 0);
        this.colliderBvh = new MeshBVH(this.bvhGeometry, { maxLeafTris: 3 });
        // this.bvhGeometry.boundsTree = this.colliderBvh;
        this.geometry.boundsTree = this.colliderBvh;
        this.colliderBvhTransform = { ...this.transformation };

        // this.colliderMesh = new THREE.Mesh(this.bvhGeometry, new MeshLambertMaterial({
        //     color: '#FFFFF0',
        //     side: THREE.DoubleSide,
        //     depthWrite: false,
        //     transparent: true,
        //     opacity: 0.3,
        //     polygonOffset: true,
        //     polygonOffsetFactor: -5,
        //     polygonOffsetUnits: -0.1

        // }));
        // this.clippingGroup.add(this.colliderMesh);

        this.setSectionMesh();
        this.createPlaneStencilGroup();
        this.calaClippingMap();
    }

    public get visible() {
        return this.meshObject.visible;
    }

    public set visible(value: boolean) {
        this.meshObject.visible = value;
    }

    public setLocalPlane(height) {
        this.localPlane.constant = height;

        this.localPlane.coplanarPoint(this.sectionMesh.position);
        this.sectionMesh.lookAt(
            this.sectionMesh.position.x - this.localPlane.normal.x,
            this.sectionMesh.position.y - this.localPlane.normal.y,
            this.sectionMesh.position.z - this.localPlane.normal.z
        );
    }

    public setSectionMesh() {
        const planeGeom = new THREE.PlaneGeometry(100, 100);
        const planeMat = new THREE.MeshStandardMaterial({
            color: 0xE9F3FE,
            metalness: 0.1,
            roughness: 0.75,
            clippingPlanes: [],
            stencilWrite: true,
            stencilRef: 0,
            stencilFunc: THREE.NotEqualStencilFunc,
            stencilFail: THREE.ReplaceStencilOp,
            stencilZFail: THREE.ReplaceStencilOp,
            stencilZPass: THREE.ReplaceStencilOp
        });
        const sectionMesh = new THREE.Mesh(planeGeom, planeMat);
        sectionMesh.onAfterRender = (renderer) => {
            renderer.clearStencil();
        };

        const position = new THREE.Vector3();
        this.meshObject.getWorldPosition(position);
        sectionMesh.position.copy(position);

        this.localPlane.coplanarPoint(sectionMesh.position);
        sectionMesh.lookAt(
            sectionMesh.position.x - this.localPlane.normal.x,
            sectionMesh.position.y - this.localPlane.normal.y,
            sectionMesh.position.z - this.localPlane.normal.z
        );

        sectionMesh.renderOrder = 1;
        this.sectionMesh = sectionMesh;
        this.clippingGroup.add(sectionMesh);
    }

    public createPlaneStencilGroup() {
        const group = new THREE.Group();
        const baseMat = new THREE.MeshBasicMaterial();
        baseMat.depthWrite = false;
        baseMat.depthTest = false;
        baseMat.colorWrite = false;
        baseMat.stencilWrite = true;
        baseMat.stencilFunc = THREE.AlwaysStencilFunc;
        // const mesh0 = new THREE.Mesh(geometry, baseMat);

        // back faces
        const mat0 = baseMat.clone();
        mat0.side = THREE.BackSide;
        mat0.clippingPlanes = [this.localPlane];
        mat0.stencilFail = THREE.IncrementWrapStencilOp;
        mat0.stencilZFail = THREE.IncrementWrapStencilOp;
        mat0.stencilZPass = THREE.IncrementWrapStencilOp;
        const meshBackSide = new THREE.Mesh(this.geometry, mat0);
        group.add(meshBackSide);

        // front faces
        const mat1 = baseMat.clone();
        mat1.side = THREE.FrontSide;
        mat1.clippingPlanes = [this.localPlane];
        mat1.stencilFail = THREE.DecrementWrapStencilOp;
        mat1.stencilZFail = THREE.DecrementWrapStencilOp;
        mat1.stencilZPass = THREE.DecrementWrapStencilOp;
        const meshFrontSide = new THREE.Mesh(this.geometry, mat1);
        group.add(meshFrontSide);

        const inverseMatrix = new THREE.Matrix4();
        inverseMatrix.copy(this.meshObject.matrixWorld);

        const position = new THREE.Vector3();
        this.meshObject.getWorldPosition(position);

        group.position.copy(position);
        this.meshObjectGroup = group;
        this.clippingGroup.add(this.meshObjectGroup);
    }

    public async updateClippingMap() {
        let tags = ['rotationX', 'rotationY', 'rotationZ', 'scaleX', 'scaleY', 'scaleZ'];
        let re = tags.some((tag) => {
            return this.colliderBvhTransform[tag] !== this.transformation[tag];
        });
        if (re) {
            for (const [, terminate] of this.clippingWorkerMap.entries()) {
                terminate();
            }
            this.clippingWorkerMap.clear();
            this.updateBvhGeometry();
            this.calaClippingMap();
            return;
        }

        tags = ['positionX', 'positionY', 'positionZ'];
        re = tags.some((tag) => {
            return this.colliderBvhTransform[tag] !== this.transformation[tag];
        });
        if (re) {
            this.updateBvhGeometry();
            this.calaClippingMap();
        }
    }

    public updateBvhGeometry() {
        this.bvhGeometry = this.geometry.clone();
        const inverseMatrix = new THREE.Matrix4();
        this.meshObject.updateMatrixWorld();
        inverseMatrix.copy(this.meshObject.matrixWorld);
        this.bvhGeometry.applyMatrix4(inverseMatrix);

        // this.colliderMesh.geometry = this.bvhGeometry;
        // this.meshObjectGroup.applyMatrix4(inverseMatrix);

        this.colliderBvh = new MeshBVH(this.bvhGeometry, { maxLeafTris: 3 });
        // this.bvhGeometry.boundsTree = this.colliderBvh;
        this.geometry.boundsTree = this.colliderBvh;
        this.colliderBvhTransform = { ...this.transformation };
    }

    public async translateClippingMap() {
        if (this.clippingWorkerMap.size) {
            await new Promise<void>(async (resolve) => {
                const subscription = await Promise.resolve(this.observable.subscribe({
                    complete() {
                        subscription.unsubscribe();
                        resolve();
                    }
                }));
            });
        }
        this.observable = new Observable(subscriber => {
            for (const [index, vectors] of this.clippingMap.entries()) {
                this.clippingMap.delete(index);
                const { terminate } = workerManager.translatePolygons<TPoint[][]>([vectors, {
                    x: 10,
                    y: 10
                }], (res) => {
                    this.clippingMap.set(index, res);
                    this.clippingWorkerMap.delete(index);
                    subscriber.next(this.clippingWorkerMap);
                    if (this.clippingWorkerMap.size === 0) {
                        subscriber.complete();
                    }
                });
                this.clippingWorkerMap.set(index, terminate);
                subscriber.next(this.clippingWorkerMap);
            }
        });
        this.observable.subscribe();
    }

    public async calaClippingMap() {
        const now = new Date().getTime();
        this.clippingMap.clear();
        const height = this.boundingBox?.max.z - this.boundingBox?.min.z;
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
        for (let index = 0; index <= height; index = Number((index + 0.24).toFixed(2))) {
            plane.constant = index;
            const vectors = calculateSectionPoints(this.colliderBvh, plane, { x: 0, y: 0, z: 0 });
            // Intermediate state
            this.clippingMap.set(index, vectors as unknown as TPoint[][]);
        }

        this.observable = new Observable(subscriber => {
            for (const [index, vectors] of this.clippingMap.entries()) {
                this.clippingMap.delete(index);
                const actionID = Math.random().toFixed(4);
                const m = new Date().getTime();
                const { terminate } = workerManager.sortUnorderedLine<TPoint[][]>([vectors, actionID, m], (res) => {
                    this.clippingMap.set(index, res);
                    this.clippingWorkerMap.delete(index);
                    subscriber.next(this.clippingWorkerMap);
                    if (this.clippingWorkerMap.size === 0) {
                        subscriber.complete();
                    }
                });
                this.clippingWorkerMap.set(index, terminate);
                subscriber.next(this.clippingWorkerMap);
            }
        });
        this.observable.subscribe({
            complete: () => {
                console.log(`== >> calaClippingMap ${this.modelName} finished: layCount=${this.clippingMap.size}, cost=${new Date().getTime() - now}`);
                this.calaClippingWall();
            }
        });
    }

    public calaClippingWall() {
        const now = new Date().getTime();
        this.observable = new Observable(subscriber => {
            for (const [index, vectors] of this.clippingMap.entries()) {
                const { terminate } = workerManager.calaClippingWall<TPoint[][]>([index, vectors], (res) => {
                    this.innerWallMap.set(index, res);
                    this.clippingWorkerMap.delete(index);
                    subscriber.next(this.clippingWorkerMap);
                    if (this.clippingWorkerMap.size === 0) {
                        subscriber.complete();
                    }
                });
                this.clippingWorkerMap.set(index, terminate);
                subscriber.next(this.clippingWorkerMap);
            }
        });
        this.observable.subscribe({
            complete: () => {
                console.log(`== >> calaClippingWall ${this.modelName} finished: layCount=${this.clippingMap.size}, cost=${new Date().getTime() - now}`);
                this.calaClippingSkin();
            }
        });
    }

    public calaClippingSkin() {
        const now = new Date().getTime();
        this.observable = new Observable(subscriber => {
            for (const [index, vectors] of this.innerWallMap.entries()) {
                const otherLayers = [];
                let i = 5;
                while (i) {
                    otherLayers.push(this.innerWallMap.get(Number((index + 0.24 * i).toFixed(2))));
                    i--;
                }
                i++;
                while (i <= 5) {
                    otherLayers.push(this.innerWallMap.get(Number((index - 0.24 * i).toFixed(2))));
                    i++;
                }
                const { terminate } = workerManager.calaClippingSkin<{
                    skin: TPoint[][],
                    infill: TPoint[][]
                }>([index, vectors, otherLayers], (res) => {
                    this.skinMap.set(index, res.skin);
                    this.infillMap.set(index, res.infill);
                    this.clippingWorkerMap.delete(index);
                    subscriber.next(this.clippingWorkerMap);
                    if (this.clippingWorkerMap.size === 0) {
                        subscriber.complete();
                    }
                });
                this.clippingWorkerMap.set(index, terminate);
                subscriber.next(this.clippingWorkerMap);
            }
        });
        this.observable.subscribe({
            complete: () => {
                console.log(`== >> calaClippingSkin ${this.modelName} finished: layCount=${this.clippingMap.size}, cost=${new Date().getTime() - now}`);
            }
        });
    }

    public updateDisplayedType(value) {
        this.displayedType = value;
        this.setSelected(this.isSelected);
    }

    public updateModelName(newName: string) {
        this.modelName = newName;
    }

    public updateMaterialColor(color: string) {
        this._materialNormal = new THREE.Color(color);
        this._materialSelected = new THREE.Color(color);
        this.setSelected(this.isSelected);
    }

    public onTransform() {
        // const geometrySize = ThreeUtils.getGeometrySize(this.meshObject.geometry, true);
        const { uniformScalingState } = this.meshObject;

        let position, scale, rotation;
        if (this.parent) {
            if (this.modelGroup.isModelSelected(this)) {
                const { recovery } = this.modelGroup.unselectAllModels();
                position = this.meshObject.position.clone();
                scale = this.meshObject.scale.clone();
                rotation = this.meshObject.rotation.clone();
                recovery();
            } else {
                position = this.meshObject.position.clone();
                scale = this.meshObject.scale.clone();
                rotation = this.meshObject.rotation.clone();
            }
        } else {
            position = new THREE.Vector3();
            this.meshObject.getWorldPosition(position);
            scale = new THREE.Vector3();
            this.meshObject.getWorldScale(scale);
            const quaternion = new THREE.Quaternion();
            this.meshObject.getWorldQuaternion(quaternion);
            // TODO ts
            rotation = new THREE.Euler().setFromQuaternion(quaternion, undefined);
            // rotation = new THREE.Euler().setFromQuaternion(quaternion, undefined, false);
        }


        this.meshObjectGroup?.position.copy(position);
        this.meshObjectGroup?.scale.copy(scale);
        this.meshObjectGroup?.rotation.copy(rotation);

        // if (this.localPlane) {
        //     this.localPlane.position.copy(position);
        //     this.localPlane.scale.copy(scale);
        //     this.localPlane.rotation.copy(rotation);
        // }

        const transformation = {
            positionX: position.x,
            positionY: position.y,
            positionZ: position.z,
            rotationX: rotation.x,
            rotationY: rotation.y,
            rotationZ: rotation.z,
            scaleX: scale.x,
            scaleY: scale.y,
            scaleZ: scale.z,
            // width: geometrySize.x * scale.x,
            // height: geometrySize.y * scale.y,
            uniformScalingState
        };

        this.transformation = {
            ...this.transformation,
            ...transformation
        };
        return this.transformation;
    }

    public computeBoundingBox() {
        this.boundingBox = ThreeUtils.computeBoundingBox(this.meshObject);
    }

    // 3D
    public setConvexGeometry(convexGeometry: THREE.BufferGeometry) {
        if (convexGeometry instanceof THREE.BufferGeometry) {
            this.convexGeometry = new THREE.Geometry().fromBufferGeometry(convexGeometry);
            this.convexGeometry.mergeVertices();
        } else {
            this.convexGeometry = convexGeometry;
        }
    }

    public isModelInGroup() {
        return this.parent && this.parent instanceof ThreeGroup;
    }

    public stickToPlate() {
        if (this.sourceType !== '3d') {
            return;
        }
        if (this.isModelInGroup()) {
            this.parent.stickToPlate();
            return;
        }
        const revert = ThreeUtils.removeObjectParent(this.meshObject);

        this.computeBoundingBox();
        this.meshObject.position.z -= this.boundingBox.min.z;
        this.computeBoundingBox(); // update boundingbox after position changed
        this.onTransform();
        revert();
    }

    // 3D
    public setMatrix(matrix: THREE.Matrix4) {
        this.meshObject.updateMatrix();
        this.meshObject.applyMatrix4(new THREE.Matrix4().copy(this.meshObject.matrix).invert());
        this.meshObject.applyMatrix4(matrix);
        // attention: do not use Object3D.applyMatrix(matrix : Matrix4)
        // because applyMatrix is accumulated
        // anther way: decompose Matrix and reset position/rotation/scale
    }

    public setOversteppedAndSelected(overstepped: boolean, isSelected: boolean) {
        this.overstepped = overstepped;
        this.setSelected(isSelected);
    }

    public setSelected(isSelected?: boolean) {
        if (typeof isSelected === 'boolean') {
            this.isSelected = isSelected;
        }
        if (this.displayedType !== 'model') {
            this.meshObject.material = this.gcodeModeMaterial;
        } else {
            this.meshObject.material = this.modelModeMaterial;
            if (this.isEditingSupport) {
                // TODO: uniform material for setting triangle color and textures
                this.meshObject.material.color.set(0xffffff);
            } else if (this.overstepped === true) {
                this.meshObject.material = this.meshObject.material;
                this.meshObject.material.color.set(materialOverstepped);
            } else if (this.isSelected === true) {
                this.meshObject.material = this.meshObject.material;
                this.meshObject.material.color.set(this._materialSelected.clone());
            } else {
                this.meshObject.material = this.meshObject.material;
                this.meshObject.material.color.set(this._materialNormal.clone());
            }
        }

        // for indexed geometry
        if (this.type !== 'primeTower' && this.meshObject.geometry.getAttribute('color')) {
            this.meshObject.material.vertexColors = true;
            this.meshObject.material.needsUpdate = true;
        } else {
            this.meshObject.material.vertexColors = false;
            this.meshObject.material.needsUpdate = true;
        }
        // for support geometry
        if (this.supportTag) {
            this.meshObject.material.color.set(0xFFD700);
        }
    }

    /**
    * Note that you need to give cloned Model a new model name.
    *
    * @returns {ThreeModel}
    */
    public clone(modelGroup: ModelGroup = this.modelGroup) {
        const modelInfo = {
            ...this,
            loadFrom: LOAD_MODEL_FROM_INNER,
            material: this.meshObject.material
        } as unknown as ModelInfo;
        const clone = new ThreeModel(modelInfo, modelGroup);
        clone.originModelID = this.modelID;
        clone.modelID = uuid();
        this.meshObject.updateMatrixWorld();

        clone.setMatrix(this.meshObject.matrixWorld);
        // set proper material for new model
        clone.setSelected(false);

        return clone;
    }

    /**
    * Find the best fit direction, and rotate the model
    * step1. get big planes of convex geometry
    * step2. calculate area, support volumes of each big plane
    * step3. find the best fit plane using formula below
    */
    public autoRotate() {
        if (this.sourceType !== '3d' || !this.convexGeometry) {
            return;
        }

        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        this.meshObject.updateMatrixWorld();
        const geometry = this.meshObject.geometry;
        geometry.computeBoundingBox();
        const box3 = geometry.boundingBox;
        const x = (box3.max.x + box3.min.x) / 2;
        const y = (box3.max.y + box3.min.y) / 2;
        const z = (box3.max.z + box3.min.z) / 2;
        const center = new THREE.Vector3(x, y, z);
        center.applyMatrix4(this.meshObject.matrixWorld);
        // mirror operation on model may cause convex plane normal vector inverse, if it does, inverse it back
        const inverseNormal = (this.transformation.scaleX / Math.abs(this.transformation.scaleX) < 0);
        // TODO: how about do not use matrix to speed up
        const { planes, areas } = ThreeUtils.computeGeometryPlanes(this.convexGeometry, this.meshObject.matrixWorld, [], center, inverseNormal);
        const maxArea = Math.max.apply(null, areas);
        const bigPlanes = { planes: null, areas: [] };
        bigPlanes.planes = planes.filter((p, idx) => {
            // filter big planes, 0.1 can be change to improve perfomance
            const isBig = areas[idx] > maxArea * 0.1;
            isBig && bigPlanes.areas.push(areas[idx]);
            return isBig;
        });

        if (!bigPlanes.planes.length) return;

        const xyPlaneNormal = new THREE.Vector3(0, 0, -1);
        const objPlanes = ThreeUtils.computeGeometryPlanes(this.meshObject.geometry, this.meshObject.matrixWorld, bigPlanes.planes, center, false);

        let targetPlane;
        const minSupportVolume = Math.min.apply(null, objPlanes.supportVolumes);
        // if has a direction without support, choose it
        if (minSupportVolume < 1) {
            const idx = objPlanes.supportVolumes.findIndex((i) => i === minSupportVolume);
            targetPlane = objPlanes.planes[idx];
        }

        if (!targetPlane) {
            const rates = [];
            for (let idx = 0, len = bigPlanes.planes.length; idx < len; idx++) {
                // update rate formula to improve performance
                const areasFactor = objPlanes.areas[idx] / bigPlanes.areas[idx];
                let supportVolumesFactor = 0;
                if (objPlanes.supportVolumes[idx] !== 0) {
                    supportVolumesFactor = minSupportVolume / objPlanes.supportVolumes[idx];
                } else if (minSupportVolume === 0) {
                    supportVolumesFactor = 1;
                }
                rates.push(objPlanes.areas[idx] * areasFactor * supportVolumesFactor);
            }

            const maxRate = Math.max.apply(null, rates);
            const idx = rates.findIndex((r) => r === maxRate);
            targetPlane = bigPlanes.planes[idx];
        }
        // WARNING: applyQuternion DONT update Matrix...
        this.meshObject.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(targetPlane.normal, xyPlaneNormal));
        this.meshObject.updateMatrix();

        this.stickToPlate();
        this.onTransform();
        revertParent();
    }

    public rotateByPlane(targetPlane: THREE.Plane) {
        const xyPlaneNormal = new THREE.Vector3(0, 0, -1);
        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        this.meshObject.updateMatrixWorld();
        this.meshObject.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(targetPlane.normal, xyPlaneNormal));
        this.meshObject.updateMatrix();

        this.stickToPlate();
        this.onTransform();
        revertParent();
    }

    public analyzeRotation() {
        if (this.sourceType !== '3d' || !this.convexGeometry) {
            return null;
        }
        const geometry = this.meshObject.geometry;
        geometry.computeBoundingBox();
        const box3 = geometry.boundingBox;
        const x = (box3.max.x + box3.min.x) / 2;
        const y = (box3.max.y + box3.min.y) / 2;
        const z = (box3.max.z + box3.min.z) / 2;
        const center = new THREE.Vector3(x, y, z);
        center.applyMatrix4(this.meshObject.matrixWorld);

        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        this.meshObject.updateMatrixWorld();

        // mirror operation on model may cause convex plane normal vector inverse, if it does, inverse it back
        const inverseNormal = (this.transformation.scaleX / Math.abs(this.transformation.scaleX) < 0);
        // TODO: how about do not use matrix to speed up
        const { planes, areas, planesPosition } = ThreeUtils.computeGeometryPlanes(this.convexGeometry, this.meshObject.matrixWorld, [], center, inverseNormal);
        const maxArea = Math.max.apply(null, areas);
        const bigPlanes = { planes: null, areas: [], planesPosition: [] };
        bigPlanes.planes = planes.filter((p, idx) => {
            // filter big planes, 0.1 can be change to improve perfomance
            const isBig = areas[idx] > maxArea * 0.1;
            if (isBig) {
                bigPlanes.areas.push(areas[idx]);
                bigPlanes.planesPosition.push(planesPosition[idx]);
            }
            return isBig;
        });

        if (!bigPlanes.planes.length) return null;
        const objPlanes = ThreeUtils.computeGeometryPlanes(this.meshObject.geometry, this.meshObject.matrixWorld, bigPlanes.planes, center, false);
        revertParent();

        const minSupportVolume = Math.min.apply(null, objPlanes.supportVolumes);

        const rates = [];
        for (let idx = 0, len = bigPlanes.planes.length; idx < len; idx++) {
            // update rate formula to improve performance
            const areasFactor = objPlanes.areas[idx] / bigPlanes.areas[idx];
            let supportVolumesFactor = 0;
            if (objPlanes.supportVolumes[idx] !== 0) {
                supportVolumesFactor = minSupportVolume / objPlanes.supportVolumes[idx];
            } else if (minSupportVolume === 0) {
                supportVolumesFactor = 1;
            }
            rates.push(objPlanes.areas[idx] * areasFactor * supportVolumesFactor);
        }
        const result = {
            rates: rates,
            planes: objPlanes.planes,
            planesPosition: bigPlanes.planesPosition,
            areas: objPlanes.areas,
            supportVolumes: objPlanes.supportVolumes
        };
        return result;
    }

    public scaleToFit(size: TSize, offsetX: number, offsetY: number) {
        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        const modelSize = new THREE.Vector3();
        this.computeBoundingBox();
        this.boundingBox.getSize(modelSize);
        const scalar = ['x', 'y', 'z'].reduce((prev, key) => Math.min((size[key] - 5) / modelSize[key], prev), Number.POSITIVE_INFINITY);
        this.meshObject.scale.multiplyScalar(scalar);
        this.meshObject.position.set(offsetX, offsetY, 0);
        this.meshObject.updateMatrix();
        this.setSelected();
        this.stickToPlate();
        this.onTransform();
        revertParent();
    }

    public layFlat() {
        if (this.sourceType !== '3d') {
            return;
        }

        const positionX = this.meshObject.position.x;
        const positionY = this.meshObject.position.y;

        if (!this.convexGeometry) {
            return;
        }

        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        // Attention: the minY-vertex and min-angle-vertex must be in the same face
        // transform convexGeometry clone
        const convexGeometryClone = this.convexGeometry.clone();
        convexGeometryClone.computeVertexNormals();
        // this.updateMatrix();
        this.meshObject.updateMatrix();
        convexGeometryClone.applyMatrix4(this.meshObject.matrix);
        const faces = convexGeometryClone.faces;
        let minAngleFace = null;
        let minAngle = Math.PI;
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            const angle = face.normal.angleTo(new THREE.Vector3(0, 0, -1));
            if (angle < minAngle) {
                minAngle = angle;
                minAngleFace = face;
            }
        }


        const xyPlaneNormal = new THREE.Vector3(0, 0, -1);
        const vb2 = minAngleFace.normal;
        this.meshObject.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vb2, xyPlaneNormal));
        this.stickToPlate();
        this.meshObject.position.x = positionX;
        this.meshObject.position.y = positionY;
        this.meshObject.updateMatrix();

        this.onTransform();
        revertParent();
    }

    public getSerializableConfig() {
        const {
            modelID, limitSize, headType, sourceType, sourceHeight, sourceWidth, originalName, uploadName, mode,
            transformation, processImageName, supportTag, visible, extruderConfig, modelName
        } = this;

        return {
            modelID,
            limitSize,
            headType,
            sourceType,
            sourceHeight,
            sourceWidth,
            originalName,
            uploadName,
            mode,
            visible,
            transformation,
            processImageName,
            supportTag,
            extruderConfig,
            modelName
        };
    }
}

export default ThreeModel;
