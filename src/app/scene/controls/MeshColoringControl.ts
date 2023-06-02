import {
    BufferGeometry,
    Camera,
    Color,
    Intersection,
    MOUSE,
    Matrix4,
    Mesh,
    Object3D,
    Raycaster,
    Sphere,
    SphereBufferGeometry,
    Vector3,
} from 'three';
import type { ExtendedTriangle } from 'three-mesh-bvh';
import { CONTAINED, INTERSECTED, NOT_INTERSECTED } from 'three-mesh-bvh';

import { BYTE_COUNT_COLOR_CLEAR_MASK } from '../../models/ThreeModel';
import log from '../../lib/log';
import ModelGroup, { BrushType } from '../../models/ModelGroup';
import Control, { Pointer } from '../../ui/components/SMCanvas/Control';


function getFacesInSphere(mesh: Mesh, faceIndex: number, brushPosition: Vector3, radius: number): number[] {
    const targetFaces = [faceIndex];

    const geometry = mesh.geometry as BufferGeometry;
    const indices = geometry.index;
    const normalAttribute = geometry.getAttribute('normal');
    const bvh = geometry.boundsTree;
    if (!bvh) {
        log.warn('boundsTree was not built, ignored.');
        return targetFaces;
    }

    const inverseMatrix = new Matrix4();
    inverseMatrix.copy(mesh.matrixWorld).invert();

    const sphere = new Sphere();
    sphere.center.copy(brushPosition).applyMatrix4(inverseMatrix);
    sphere.radius = radius;

    let index: number;
    const normal = new Vector3();
    const point = new Vector3();

    index = indices ? indices.getX(faceIndex * 3 + 0) : faceIndex * 3 + 0;
    const initialNormal = new Vector3().fromBufferAttribute(normalAttribute, index);

    bvh.shapecast({
        intersectsBounds: (box) => {
            const intersects = sphere.intersectsBox(box);
            const { min, max } = box;
            if (intersects) {
                for (let x = 0; x <= 1; x++) {
                    for (let y = 0; y <= 1; y++) {
                        for (let z = 0; z <= 1; z++) {
                            point.set(
                                x === 0 ? min.x : max.x,
                                y === 0 ? min.y : max.y,
                                z === 0 ? min.z : max.z
                            );
                            if (!sphere.containsPoint(point)) {
                                return INTERSECTED;
                            }
                        }
                    }
                }
                return CONTAINED;
            }
            return NOT_INTERSECTED;
        },
        intersectsTriangle: (triangle: ExtendedTriangle, triangleIndex: number, contained: boolean) => {
            if (contained || triangle.intersectsSphere(sphere)) {
                index = indices ? indices.getX(triangleIndex * 3) : triangleIndex * 3;
                normal.fromBufferAttribute(normalAttribute, index);

                const dot = normal.dot(initialNormal);
                if (dot >= 0) {
                    targetFaces.push(triangleIndex);
                }
            }
            return false;
        }
    });

    return targetFaces;
}

function getFacesConnectedSmoothly(mesh: Mesh, initialFaceIndices: number[], angle: number = 5): number[] {
    const targetFaces = [...initialFaceIndices];

    const geometry = mesh.geometry as BufferGeometry;
    const indices = geometry.index;
    const normalAttribute = geometry.getAttribute('normal');

    const adjacentFaceGraph = geometry.adjcentFaceGraph;
    if (!adjacentFaceGraph) {
        log.warn('adjacent face graph was not built, ignored.');
        return targetFaces;
    }

    let index: number;
    const normal = new Vector3();
    const currentNormal = new Vector3();

    // traverse neighboring faces
    const queue: number[] = [...initialFaceIndices];
    const visited: Set<number> = new Set();

    for (const faceIndex of queue) {
        visited.add(faceIndex);
    }

    while (queue.length > 0) {
        const faceIndex = queue.shift();

        index = indices ? indices.getX(faceIndex * 3 + 0) : faceIndex * 3 + 0;
        currentNormal.fromBufferAttribute(normalAttribute, index);

        const neighborFaces = adjacentFaceGraph.getAdjacentFaces(faceIndex);
        for (const nextFaceIndex of neighborFaces) {
            if (!visited.has(nextFaceIndex)) {
                index = indices ? indices.getX(nextFaceIndex * 3 + 0) : nextFaceIndex * 3 + 0;
                normal.fromBufferAttribute(normalAttribute, index);

                const angleRad = normal.angleTo(currentNormal);
                const angleDegree = angleRad * (180 / Math.PI);

                if (angleDegree <= angle) {
                    targetFaces.push(nextFaceIndex);
                    visited.add(nextFaceIndex);
                    queue.push(nextFaceIndex);
                }
            }
        }
    }

    return targetFaces;
}



function pickFacesConnectedSmoothly(avaiableFaceIndices: number[], mesh: Mesh, initialFaceIndex: number, angle: number = 5): number[] {
    const availableIndicesSet = new Set(avaiableFaceIndices);
    const targetFaces = [initialFaceIndex];

    const geometry = mesh.geometry as BufferGeometry;
    const indices = geometry.index;
    const normalAttribute = geometry.getAttribute('normal');

    const adjacentFaceGraph = geometry.adjcentFaceGraph;
    if (!adjacentFaceGraph) {
        log.warn('adjacent face graph was not built, ignored.');
        return targetFaces;
    }

    let index: number;
    const normal = new Vector3();
    const currentNormal = new Vector3();

    // traverse neighboring faces
    const queue: number[] = [initialFaceIndex];
    const visited: Set<number> = new Set();

    visited.add(initialFaceIndex);

    while (queue.length > 0) {
        const faceIndex = queue.shift();

        index = indices ? indices.getX(faceIndex * 3 + 0) : faceIndex * 3 + 0;
        currentNormal.fromBufferAttribute(normalAttribute, index);

        const neighborFaces = adjacentFaceGraph.getAdjacentFaces(faceIndex);
        for (const nextFaceIndex of neighborFaces) {
            if (!availableIndicesSet.has(nextFaceIndex)) {
                continue;
            }
            if (!visited.has(nextFaceIndex)) {
                index = indices ? indices.getX(nextFaceIndex * 3 + 0) : nextFaceIndex * 3 + 0;
                normal.fromBufferAttribute(normalAttribute, index);

                const angleRad = normal.angleTo(currentNormal);
                const angleDegree = angleRad * (180 / Math.PI);

                if (angleDegree <= angle) {
                    targetFaces.push(nextFaceIndex);
                    visited.add(nextFaceIndex);
                    queue.push(nextFaceIndex);
                }
            }
        }
    }

    return targetFaces;
}




const _raycaster = new Raycaster();
_raycaster.params.Line.threshold = 0.5;

export default class MeshColoringControl extends Control {
    private mode: string = 'mesh-coloring';

    private modelGroup: ModelGroup;
    private isPointerDown: boolean = false;

    private targetObject: Object3D = null;

    private faceExtruderMark: number;
    private faceColor: Color | null = null;


    public constructor(camera: Camera, modelGroup: ModelGroup) {
        super(camera);

        this.name = 'MeshColoringControl';

        this.modelGroup = modelGroup;
    }

    public setTargetObject(object: Object3D): void {
        this.targetObject = object;
    }

    public setBrushData(faceExtruderMark: number, color: Color): void {
        this.faceExtruderMark = faceExtruderMark;
        this.faceColor = color;
    }

    public isActive(mode: string): boolean {
        return mode === this.mode;
    }

    public onPointerDown(pointer: Pointer): boolean {
        switch (pointer.button) {
            case MOUSE.LEFT: {
                if (this.faceExtruderMark && this.faceColor) {
                    _raycaster.setFromCamera(pointer, this.camera);
                    _raycaster.firstHitOnly = true;

                    const intersections = _raycaster.intersectObject(this.targetObject, true);
                    if (intersections.length) {
                        this.isPointerDown = true;
                        this.colorIntersections(intersections);
                        return true;
                    }
                }
                break;
            }
            default:
                break;
        }

        return false;
    }

    public onPointerMove(pointer: Pointer): boolean {
        if (!this.isPointerDown) return false;

        switch (pointer.button) {
            case MOUSE.LEFT: {
                if (this.faceExtruderMark && this.faceColor) {
                    _raycaster.setFromCamera(pointer, this.camera);
                    _raycaster.firstHitOnly = true;

                    const intersections = _raycaster.intersectObject(this.targetObject, true);
                    if (intersections.length) {
                        this.colorIntersections(intersections);
                        return true;
                    }
                }
                break;
            }
            default:
                break;
        }

        return false;
    }

    public onPointerUp(pointer: Pointer): boolean {
        if (pointer.button === MOUSE.LEFT) {
            this.isPointerDown = false;

            return true;
        } else {
            return false;
        }
    }

    /**
     * Apply brush, with extruder mark and corresponding color.
     */
    private colorIntersections(intersections: Intersection[]): void {
        const intersection = intersections.find((result) => result.object.userData.canSupport);
        if (!intersection) {
            return;
        }

        const modelGroup = this.modelGroup;
        const brushType = modelGroup.getBrushType();

        switch (brushType) {
            case BrushType.SphereBrush: {
                this.applyMeshColoringBrushSphereBrush(intersection, this.faceExtruderMark, this.faceColor);
                break;
            }
            case BrushType.SmartFillBrush: {
                this.applyMeshColoringBrushSmartFill(intersection, this.faceExtruderMark, this.faceColor);
                break;
            }
            default:
                break;
        }
    }

    private applyMeshColoringBrushSphereBrush(intersection: Intersection, faceExtruderMark: number, color: Color): void {
        const targetMesh = intersection.object as Mesh;
        const geometry = targetMesh.geometry as BufferGeometry;

        const targetFaceIndex = intersection.faceIndex;
        if (targetFaceIndex < 0) {
            return;
        }

        const brushOptions = this.modelGroup.getBrushOptions();
        const brushMesh = this.modelGroup.getBrushMesh();

        const angle = brushOptions.angle;

        const radius = (brushMesh.geometry as SphereBufferGeometry).parameters.radius;
        const brushPosition = brushMesh.position;

        const nearbyFaces = getFacesInSphere(targetMesh, targetFaceIndex, brushPosition, radius);
        const targetFaces = pickFacesConnectedSmoothly(nearbyFaces, targetMesh, targetFaceIndex, angle);

        const colorAttr = geometry.getAttribute('color');
        const byteCountAttribute = geometry.getAttribute('byte_count');
        const indices = geometry.index;

        let index: number;
        for (const faceIndex of targetFaces) {
            for (let k = 0; k < 3; k++) {
                index = indices ? indices.getX(faceIndex * 3 + k) : faceIndex * 3 + k;

                colorAttr.setXYZ(index, color.r, color.g, color.b);
            }

            if (byteCountAttribute) {
                const byteCount = byteCountAttribute.getX(faceIndex);
                byteCountAttribute.setX(faceIndex, (byteCount & BYTE_COUNT_COLOR_CLEAR_MASK) | faceExtruderMark);
            }
        }
        colorAttr.needsUpdate = true;
        byteCountAttribute.needsUpdate = true;
    }

    private applyMeshColoringBrushSmartFill(intersection: Intersection, faceExtruderMark: number, color: Color): void {
        const targetMesh = intersection.object as Mesh;
        const geometry = targetMesh.geometry as BufferGeometry;

        const targetFaceIndex = intersection.faceIndex;
        if (targetFaceIndex < 0) {
            return;
        }

        const brushOptions = this.modelGroup.getBrushOptions();
        const brushMesh = this.modelGroup.getBrushMesh();

        const angle = brushOptions.angle;
        const brushPosition = brushMesh.position;

        const indices = geometry.index;
        const colorAttr = geometry.getAttribute('color');
        const byteCountAttribute = geometry.getAttribute('byte_count');

        const nearbyFaces = getFacesInSphere(targetMesh, targetFaceIndex, brushPosition, 0.2);
        const targetFaces = getFacesConnectedSmoothly(targetMesh, nearbyFaces, angle);

        // color target faces
        let index: number;
        for (const faceIndex of targetFaces) {
            for (let k = 0; k < 3; k++) {
                index = indices ? indices.getX(faceIndex * 3 + k) : faceIndex * 3 + k;

                colorAttr.setXYZ(index, color.r, color.g, color.b);
            }

            if (byteCountAttribute) {
                const byteCount = byteCountAttribute.getX(faceIndex);
                byteCountAttribute.setX(faceIndex, (byteCount & BYTE_COUNT_COLOR_CLEAR_MASK) | faceExtruderMark);
            }
        }
        colorAttr.needsUpdate = true;
        byteCountAttribute.needsUpdate = true;
    }
}
