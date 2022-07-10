import { Polygon, Polygons } from '../../../shared/lib/clipper/Polygons';
import { Vector2 } from '../../../shared/lib/math/Vector2';
import { round } from '../../../shared/lib/utils';

const LARGEST_NEGLECTED_GAP_FIRST_PHASE = 0.01;

class SlicerLayer {
    slicerSegments = [];

    faceIdxToSegmentIdx = new Map();

    z = -1;

    polygons = new Polygons();

    openPolygons = new Polygons();

    polygonsPart = new Polygons();

    makePolygons() {
        this.makeBasicPolygonLoop();
        this.createPolygonsPart();

        this.slicerSegments = [];
        this.faceIdxToSegmentIdx.clear();
    }

    makeBasicPolygonLoop() {
        for (let startSegmentIdx = 0; startSegmentIdx < this.slicerSegments.length; startSegmentIdx++) {
            const slicerSegment = this.slicerSegments[startSegmentIdx];
            if (!slicerSegment.addedToPolygon) {
                this.makeBasicPolygon(startSegmentIdx);
            }
        }
        this.polygons.simplify();
        this.polygons.removeDegenerateVerts();
    }

    makeBasicPolygon(startSegmentIdx) {
        const polygon = new Polygon();
        polygon.add(this.slicerSegments[startSegmentIdx].start);

        for (let segmentIdx = startSegmentIdx; segmentIdx !== -1;) {
            const slicerSegment = this.slicerSegments[segmentIdx];

            polygon.path.push(slicerSegment.end);
            slicerSegment.addedToPolygon = true;

            segmentIdx = this.getNextSegmentIdx(slicerSegment, startSegmentIdx);

            if (segmentIdx === startSegmentIdx) {
                this.polygons.add(polygon);
                return;
            }
        }

        this.polygons.add(polygon);
        this.openPolygons.add(polygon);
    }

    getNextSegmentIdx(slicerSegment, startSegmentIdx) {
        let nextSegmentIdx = -1;
        const segmentEndedAtEdge = slicerSegment.endVertex;

        if (!segmentEndedAtEdge) {
            const faceToTry = slicerSegment.endOtherFaceIdx;
            if (faceToTry === undefined) {
                return -1;
            }
            return this.tryFaceNextSegmentIdx(slicerSegment, faceToTry, startSegmentIdx);
        } else {
            for (const connectedFace of segmentEndedAtEdge.c) {
                const resultSegmentIdx = this.tryFaceNextSegmentIdx(slicerSegment, connectedFace, startSegmentIdx);
                if (resultSegmentIdx === startSegmentIdx) {
                    return startSegmentIdx;
                } else if (resultSegmentIdx !== -1) {
                    nextSegmentIdx = resultSegmentIdx;
                }
            }
        }

        return nextSegmentIdx;
    }

    tryFaceNextSegmentIdx(slicerSegment, faceIdx, startSegmentIdx) {
        if (!this.faceIdxToSegmentIdx.has(faceIdx)) {
            return -1;
        }
        const segmentIdx = this.faceIdxToSegmentIdx.get(faceIdx);
        const p1 = this.slicerSegments[segmentIdx].start;
        const diff = Vector2.sub(slicerSegment.end, p1);

        if (Vector2.testLength(diff, LARGEST_NEGLECTED_GAP_FIRST_PHASE)) {
            if (segmentIdx === startSegmentIdx) {
                return startSegmentIdx;
            }
            if (this.slicerSegments[segmentIdx].addedToPolygon) {
                return -1;
            }
            return segmentIdx;
        }

        return -1;
    }

    createPolygonsPart() {
        this.polygonsPart = this.polygons.splitIntoParts();
    }
}

export class Slicer {
    slicerLayers = [];

    constructor(mesh, layerThickness, sliceLayerCount, initialLayerThickness) {
        this.buildLayersWithHeight(layerThickness, sliceLayerCount, initialLayerThickness);
        const zbbox = this.buildZHeightsForFaces(mesh);

        this.buildSegments(mesh, zbbox);

        this.makePolygons(mesh);
    }


    buildLayersWithHeight(layerThickness, sliceLayerCount, initialLayerThickness) {
        if (initialLayerThickness === null || initialLayerThickness === undefined) {
            initialLayerThickness = layerThickness / 2;
        }

        this.slicerLayers[0] = new SlicerLayer();
        this.slicerLayers[0].z = initialLayerThickness;

        for (let i = 1; i < sliceLayerCount; i++) {
            this.slicerLayers[i] = new SlicerLayer();
            this.slicerLayers[i].z = initialLayerThickness + layerThickness * i;
        }
    }

    buildZHeightsForFaces(mesh) {
        const zHeights = [];
        for (const face of mesh.faces) {
            const v0 = mesh.vertices[face.vi[0]];
            const v1 = mesh.vertices[face.vi[1]];
            const v2 = mesh.vertices[face.vi[2]];

            const minZ = Math.min(v0.p.z, v1.p.z, v2.p.z);
            const maxZ = Math.max(v0.p.z, v1.p.z, v2.p.z);

            zHeights.push([minZ, maxZ]);
        }
        return zHeights;
    }

    buildSegments(mesh, zbbox) {
        for (let layerNr = 0; layerNr < this.slicerLayers.length; layerNr++) {
            const z = this.slicerLayers[layerNr].z;

            for (let faceIdx = 0; faceIdx < mesh.faces.length; faceIdx++) {
                if ((z < zbbox[faceIdx][0]) || (z > zbbox[faceIdx][1])) {
                    continue;
                }
                const face = mesh.faces[faceIdx];
                const v0 = mesh.vertices[face.vi[0]];
                const v1 = mesh.vertices[face.vi[1]];
                const v2 = mesh.vertices[face.vi[2]];
                const p0 = v0.p;
                const p1 = v1.p;
                const p2 = v2.p;

                let endEdgeIdx = -1;
                let seg;

                if (p0.z < z && p1.z >= z && p2.z >= z) {
                    seg = this.project2D(p0, p2, p1, z);
                    endEdgeIdx = 0;
                    if (p1.z === z) {
                        seg.endVertex = v1;
                    }
                } else if (p0.z > z && p1.z < z && p2.z < z) {
                    seg = this.project2D(p0, p1, p2, z);
                    endEdgeIdx = 2;
                } else if (p1.z < z && p0.z >= z && p2.z >= z) {
                    seg = this.project2D(p1, p0, p2, z);
                    endEdgeIdx = 1;
                    if (p2.z === z) {
                        seg.endVertex = v2;
                    }
                } else if (p1.z > z && p0.z < z && p2.z < z) {
                    seg = this.project2D(p1, p2, p0, z);
                    endEdgeIdx = 0;
                } else if (p2.z < z && p1.z >= z && p0.z >= z) {
                    seg = this.project2D(p2, p1, p0, z);
                    endEdgeIdx = 2;
                    if (p0.z === z) {
                        seg.endVertex = v0;
                    }
                } else if (p2.z > z && p1.z < z && p0.z < z) {
                    seg = this.project2D(p2, p0, p1, z);
                    endEdgeIdx = 1;
                } else {
                    // Not all cases create a segment, because a point of a face could create just a dot, and two touching faces
                    //  on the slice would create two segments
                    continue;
                }
                this.slicerLayers[layerNr].faceIdxToSegmentIdx.set(faceIdx, this.slicerLayers[layerNr].slicerSegments.length);
                seg.faceIndex = faceIdx;
                seg.endOtherFaceIdx = face.cf[endEdgeIdx];
                seg.addedToPolygon = false;
                this.slicerLayers[layerNr].slicerSegments.push(seg);
            }
        }
    }

    project2D(p0, p1, p2, z) {
        const seg = { start: {}, end: {} };

        seg.start.x = this.interpolate(z, p0.z, p1.z, p0.x, p1.x);
        seg.start.y = this.interpolate(z, p0.z, p1.z, p0.y, p1.y);
        seg.end.x = this.interpolate(z, p0.z, p2.z, p0.x, p2.x);
        seg.end.y = this.interpolate(z, p0.z, p2.z, p0.y, p2.y);

        return seg;
    }

    interpolate(x, x0, x1, y0, y1) {
        const dx01 = x1 - x0;
        const num = (y1 - y0) * (x - x0);
        return round(y0 + num / dx01, 3);
    }

    makePolygons(mesh) {
        for (const slicerLayer of this.slicerLayers) {
            slicerLayer.makePolygons(mesh);
        }
    }
}
