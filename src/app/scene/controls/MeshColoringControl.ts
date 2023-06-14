import { throttle } from 'lodash';
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
    Vector3
} from 'three';
import type { ExtendedTriangle } from 'three-mesh-bvh';
import { CONTAINED, INTERSECTED, NOT_INTERSECTED } from 'three-mesh-bvh';

import History from '../../core/History';
import log from '../../lib/log';
import type { ShortcutHandler } from '../../lib/shortcut';
import { PREDEFINED_SHORTCUT_ACTIONS, ShortcutHandlerPriority, ShortcutManager } from '../../lib/shortcut';
import ModelGroup, { BrushType } from '../../models/ModelGroup';
import { BYTE_COUNT_COLOR_CLEAR_MASK, BYTE_COUNT_COLOR_MASK } from '../../models/ThreeModel';
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

interface FaceInfo {
    index: number;
    color: Color;
    extruderMark: number;
}
interface ColorOperation {
    mesh: Mesh;
    faces: FaceInfo[];
    faceIndices: number[];
    faceColor: Color;
    faceExtruderMark: number;
}

const whiteColor = new Color(1, 1, 1);

const _raycaster = new Raycaster();
_raycaster.params.Line.threshold = 0.5;

export default class MeshColoringControl extends Control {
    private modelGroup: ModelGroup;
    private isPointerDown: boolean = false;

    private targetObject: Object3D = null;

    private faceExtruderMark: number;
    private faceColor: Color | null = null;

    private highlightedGeometry: BufferGeometry | null = null;
    private highlightedFaces: FaceInfo[];

    private shortcutHandler: ShortcutHandler;
    private history = new History<ColorOperation>(10);

    public constructor(camera: Camera, modelGroup: ModelGroup) {
        super(camera);

        this.name = 'MeshColoringControl';

        this.modelGroup = modelGroup;

        this.shortcutHandler = {
            title: 'MeshColoringControl',
            priority: ShortcutHandlerPriority.View,
            isActive: () => {
                return this.enabled;
            },
            shortcuts: {
                [PREDEFINED_SHORTCUT_ACTIONS.UNDO]: () => this.undo(),
                [PREDEFINED_SHORTCUT_ACTIONS.REDO]: () => this.redo(),
            }
        };

        // Add throttle to optimize performance on large geometry
        this.highlightIntersections = throttle(this.highlightIntersections, 200, { trailing: true });
    }

    public setEnabled(enabled: boolean): void {
        super.setEnabled(enabled);

        if (enabled) {
            ShortcutManager.register(this.shortcutHandler);
        } else {
            ShortcutManager.unregister(this.shortcutHandler);
        }

        this.clearHighlight();
        this.history.clear();
    }

    public setTargetObject(object: Object3D): void {
        this.targetObject = object;
    }

    public setBrushData(faceExtruderMark: number, color: Color): void {
        this.faceExtruderMark = faceExtruderMark;
        this.faceColor = color;
    }

    public onPointerHover(pointer: Pointer): boolean {
        if (!this.isEnabled()) {
            return false;
        }

        _raycaster.setFromCamera(pointer, this.camera);
        _raycaster.firstHitOnly = true;

        const intersections = _raycaster.intersectObject(this.targetObject, true);
        if (intersections.length) {
            // highlight brush spreaded faces
            this.highlightIntersections(intersections);

            // move brush
            const modelGroup = this.modelGroup;
            modelGroup.moveBrush(intersections);
            modelGroup.meshPositionChanged();
            return true;
        } else {
            this.highlightIntersections([]);
        }

        return false;
    }

    public onPointerDown(pointer: Pointer): boolean {
        if (!this.isEnabled()) {
            return false;
        }

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

    private mapFaceIndicesToFaceInfos(mesh: Mesh, faceIndices: number[]): FaceInfo[] {
        const geometry = mesh.geometry as BufferGeometry;

        const indices = geometry.index;
        const colorAttribute = geometry.getAttribute('color');
        const byteCountAttribute = geometry.getAttribute('byte_count');

        const getFaceExtruderMark = (faceIndex: number) => {
            const byteCount = byteCountAttribute.getX(faceIndex);
            const extruderMark = byteCount & BYTE_COUNT_COLOR_MASK;
            return extruderMark;
        };
        const getFaceColor = (faceIndex: number) => {
            const index = indices ? indices.getX(faceIndex * 3) : faceIndex * 3;

            return new Color(
                colorAttribute.getX(index),
                colorAttribute.getY(index),
                colorAttribute.getZ(index),
            );
        };

        return faceIndices.map((faceIndex) => {
            return {
                index: faceIndex,
                color: getFaceColor(faceIndex),
                extruderMark: getFaceExtruderMark(faceIndex),
            };
        });
    }

    private _setMeshFacesColor(geometry: BufferGeometry, faces: FaceInfo[], color: Color, faceExtruderMark: number = -1): void {
        const indices = geometry.index;
        const byteCountAttribute = geometry.getAttribute('byte_count');
        const colorAttribute = geometry.getAttribute('color');

        let index: number;
        for (const faceInfo of faces) {
            const faceIndex = faceInfo.index;

            if (byteCountAttribute && faceExtruderMark !== -1) {
                const byteCount = byteCountAttribute.getX(faceIndex);
                byteCountAttribute.setX(faceIndex, (byteCount & BYTE_COUNT_COLOR_CLEAR_MASK) | faceExtruderMark);
            }

            for (let k = 0; k < 3; k++) {
                index = indices ? indices.getX(faceIndex * 3 + k) : faceIndex * 3 + k;

                colorAttribute.setXYZ(index, color.r, color.g, color.b);
            }
        }

        if (faceExtruderMark !== -1) {
            byteCountAttribute.needsUpdate = true;
        }
        colorAttribute.needsUpdate = true;
    }

    private _restoreMeshFaces(geometry: BufferGeometry, faces: FaceInfo[], { restoreByteCount = true }): void {
        const indices = geometry.index;
        const byteCountAttribute = geometry.getAttribute('byte_count');
        const colorAttribute = geometry.getAttribute('color');

        if (!byteCountAttribute || !colorAttribute) {
            return;
        }

        let index: number;
        for (const faceInfo of faces) {
            const faceIndex = faceInfo.index;

            if (restoreByteCount) {
                const byteCount = byteCountAttribute.getX(faceIndex);
                byteCountAttribute.setX(faceIndex, (byteCount & BYTE_COUNT_COLOR_CLEAR_MASK) | faceInfo.extruderMark);
            }

            for (let k = 0; k < 3; k++) {
                index = indices ? indices.getX(faceIndex * 3 + k) : faceIndex * 3 + k;

                colorAttribute.setXYZ(index, faceInfo.color.r, faceInfo.color.g, faceInfo.color.b);
            }
        }

        if (restoreByteCount) {
            byteCountAttribute.needsUpdate = true;
        }
        colorAttribute.needsUpdate = true;
    }

    public clearHighlight(): void {
        if (this.highlightedGeometry && this.highlightedFaces) {
            this._restoreMeshFaces(this.highlightedGeometry, this.highlightedFaces, { restoreByteCount: false });
            this.highlightedGeometry = null;
            this.highlightedFaces = [];
        }
    }

    private highlightIntersections(intersections: Intersection[]): void {
        this.clearHighlight();

        const intersection = intersections.find((result) => result.object.userData.canSupport);
        if (!intersection) {
            return;
        }

        const modelGroup = this.modelGroup;
        const brushType = modelGroup.getBrushType();

        // Get faces by strategy
        let targetFaceIndices: number[] = [];
        // Once pointer down, we clear all highlighted faces
        if (!this.isPointerDown) {
            switch (brushType) {
                case BrushType.SphereBrush: {
                    targetFaceIndices = this.getFacesAffectedBySphereBrush(intersection);
                    break;
                }
                case BrushType.SmartFillBrush: {
                    targetFaceIndices = this.getFacesAffectedBySmartFillBrush(intersection);
                    break;
                }
                default:
                    break;
            }
        }

        if (!targetFaceIndices.length) {
            return;
        }

        const targetMesh = intersection.object as Mesh;
        const geometry = targetMesh.geometry as BufferGeometry;

        const targetFaces = this.mapFaceIndicesToFaceInfos(targetMesh, targetFaceIndices);

        const highlightColor = this.faceColor ? new Color(this.faceColor) : new Color('#F2FF6D');

        // special handling of white color, use #ddd to make a distinguish
        if (highlightColor.equals(whiteColor)) {
            highlightColor.set(new Color('#ddd'));
        } else {
            // Use linear to sRGB to make highlight color lighter than original color
            highlightColor.copyLinearToSRGB(highlightColor);
        }

        this._setMeshFacesColor(geometry, targetFaces, highlightColor);

        this.highlightedGeometry = geometry;
        this.highlightedFaces = targetFaces;

        modelGroup.meshPositionChanged();
    }

    /**
     * Apply brush, with extruder mark and corresponding color.
     */
    private colorIntersections(intersections: Intersection[]): void {
        this.clearHighlight();

        const intersection = intersections.find((result) => result.object.userData.canSupport);
        if (!intersection) {
            return;
        }

        const modelGroup = this.modelGroup;
        const brushType = modelGroup.getBrushType();

        // Get faces by strategy
        let targetFaceIndices: number[];
        switch (brushType) {
            case BrushType.SphereBrush: {
                targetFaceIndices = this.getFacesAffectedBySphereBrush(intersection);
                break;
            }
            case BrushType.SmartFillBrush: {
                targetFaceIndices = this.getFacesAffectedBySmartFillBrush(intersection);
                break;
            }
            default:
                break;
        }

        if (!targetFaceIndices.length) {
            return;
        }

        // color mesh
        const targetMesh = intersection.object as Mesh;
        const geometry = targetMesh.geometry as BufferGeometry;

        const byteCountAttribute = geometry.getAttribute('byte_count');

        // filter faces to be changed
        targetFaceIndices = targetFaceIndices.filter((faceIndex) => {
            const byteCount = byteCountAttribute.getX(faceIndex);
            const currentMark = byteCount & BYTE_COUNT_COLOR_MASK;

            return (currentMark !== this.faceExtruderMark);
        });

        if (!targetFaceIndices.length) {
            return;
        }

        const targetFaces = this.mapFaceIndicesToFaceInfos(targetMesh, targetFaceIndices);

        // actually change mesh
        this._setMeshFacesColor(geometry, targetFaces, this.faceColor, this.faceExtruderMark);

        // add history
        this.history.push({
            mesh: targetMesh,
            faces: targetFaces,
            faceIndices: targetFaceIndices,
            faceColor: this.faceColor,
            faceExtruderMark: this.faceExtruderMark,
        });
    }

    private getFacesAffectedBySphereBrush(intersection: Intersection): number[] {
        const targetMesh = intersection.object as Mesh;

        const targetFaceIndex = intersection.faceIndex;
        if (targetFaceIndex < 0) {
            return [];
        }

        const brushOptions = this.modelGroup.getBrushOptions();
        const brushMesh = this.modelGroup.getBrushMesh();

        const angle = brushOptions.angle;

        const radius = (brushMesh.geometry as SphereBufferGeometry).parameters.radius;
        const brushPosition = brushMesh.position;

        const nearbyFaces = getFacesInSphere(targetMesh, targetFaceIndex, brushPosition, radius);
        const targetFaces = pickFacesConnectedSmoothly(nearbyFaces, targetMesh, targetFaceIndex, angle);

        return targetFaces;
    }

    private getFacesAffectedBySmartFillBrush(intersection: Intersection): number[] {
        const targetMesh = intersection.object as Mesh;

        const targetFaceIndex = intersection.faceIndex;
        if (targetFaceIndex < 0) {
            return [];
        }

        const brushOptions = this.modelGroup.getBrushOptions();
        const brushMesh = this.modelGroup.getBrushMesh();

        const angle = brushOptions.angle;
        const brushPosition = brushMesh.position;

        const nearbyFaces = getFacesInSphere(targetMesh, targetFaceIndex, brushPosition, 0.2);
        const targetFaces = getFacesConnectedSmoothly(targetMesh, nearbyFaces, angle);

        return targetFaces;
    }

    private undo(): void {
        const colorOperation = this.history.back();

        if (!colorOperation) {
            return;
        }

        const geometry = colorOperation.mesh.geometry as BufferGeometry;

        this._restoreMeshFaces(geometry, colorOperation.faces, {
            restoreByteCount: true,
        });

        this.modelGroup.meshChanged();
    }

    private redo(): void {
        const colorOperation = this.history.forward();

        if (!colorOperation) {
            return;
        }

        const geometry = colorOperation.mesh.geometry as BufferGeometry;
        this._setMeshFacesColor(
            geometry,
            colorOperation.faces,
            colorOperation.faceColor,
            colorOperation.faceExtruderMark,
        );

        this.modelGroup.meshChanged();
    }
}
