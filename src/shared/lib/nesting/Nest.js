import { Vector2 } from '../math/Vector2';
import { PolygonUtils, PolygonsUtils } from '../math/PolygonsUtils';
import AngleRange from './AngleRange';
import { Line, TYPE_SEGMENT } from '../math/Line';
import { isEqual } from '../utils';
import { polyDiff, polyIntersection, polyOffset, simplifyPolygons } from '../clipper/cLipper-adapter';
import * as ClipperLib from '../clipper/clipper';

const roundAndMulPoint = (point, n = 1) => {
    point.x = Math.round(point.x * n);
    point.y = Math.round(point.y * n);
};

const roundAndMulPolygon = (polygon, n = 1) => {
    for (let i = 0; i < polygon.length; i++) {
        roundAndMulPoint(polygon[i], n);
    }
};

const roundAndMulPolygons = (polygons, n) => {
    polygons.forEach(polygon => {
        roundAndMulPolygon(polygon, n);
    });
};

export class Part {
    position;

    polygons;

    area;

    absArea;

    center;

    angle;

    rotatePolygon;

    isPlace = false;

    modelID;

    constructor(polygons, center, modelID) {
        this.polygons = polygons;
        PolygonUtils.sort(this.polygons[0], false);
        for (let i = 1; i < this.polygons.length; i++) {
            PolygonUtils.sort(this.polygons[i], true);
        }
        this.area = Vector2.area(this.polygons[0]);
        this.absArea = Math.abs(this.area);
        this.center = center;
        this.modelID = modelID;
    }
}

export class Plate {
    polygon;

    area;

    absArea;

    constructor(polygon, sort = true) {
        PolygonUtils.sort(polygon, sort);
        this.polygon = polygon;
        this.area = Vector2.area(polygon);
        this.absArea = Math.abs(this.area);
    }
}

export class Nest {
    interval = 2;

    plates = [];

    parts = [];

    resultParts = [];

    rotate = 360;

    plateOffset = 10;

    offset = 0;

    minPartArea;

    constructor(options) {
        const {
            plates = [],
            parts = [],
            rotate = 360,
            limitEdge = 2,
            accuracy = 10,
            offset = 1
        } = options;

        this.rotate = rotate;
        this.limitEdge = limitEdge;
        this.accuracy = accuracy;
        this.offset = offset;

        for (let i = 0; i < parts.length; i++) {
            const polygons = parts[i].polygons;
            let simplyPolygons = PolygonsUtils.simplify(polygons, this.limitEdge);

            if (this.offset > 0) {
                simplyPolygons = polyOffset(simplyPolygons, this.offset);
            }

            roundAndMulPolygons(simplyPolygons, this.accuracy);
            roundAndMulPoint(parts[i].center, this.accuracy);
            this.parts.push(new Part(simplyPolygons, parts[i].center, parts[i].modelID));
        }

        this.sortParts();

        for (let i = 0; i < plates.length; i++) {
            const polygon = plates[i].polygon;
            const simplyPolygon = PolygonUtils.simplify(polygon, this.limitEdge);
            roundAndMulPolygon(simplyPolygon, this.accuracy);
            this.plates.push(new Plate(polygon));
        }
    }

    sortPolygon(polygon, clockwise) {
        if (clockwise && Vector2.area(polygon) > 0) {
            polygon.reverse();
        }
        if (!clockwise && Vector2.area(polygon) < 0) {
            polygon.reverse();
        }
    }

    calculateCenter(polygon) {
        let x = 0;
        let y = 0;
        for (let i = 0; i < polygon.length; i++) {
            x += polygon[i].x;
            y += polygon[i].y;
        }
        return {
            x: x / polygon.length,
            y: y / polygon.length
        };
    }

    sortParts() {
        this.parts.sort((part1, part2) => {
            return part2.absArea - part1.absArea;
        });
        let minPartArea = this.parts[0].absArea;
        for (let i = 1; i < this.parts.length; i++) {
            minPartArea = Math.min(minPartArea, this.parts[0].absArea);
        }

        this.minPartArea = minPartArea;
    }

    polygon2Vectors(polygon) {
        const vectors = [];
        for (let i = 0; i < polygon.length - 1; i++) {
            const p1 = polygon[i];
            const p2 = polygon[i + 1];
            const vt = Vector2.sub(p2, p1);
            vectors.push({
                vt: vt,
                sp: p1,
                ep: p2
            });
        }
        return vectors;
    }

    calculateTraceLines(anglePolygon, linesPolygon) {
        const linesVectors = this.polygon2Vectors(linesPolygon);

        const traceLines = [];
        for (let i = 0; i < anglePolygon.length - 1; i++) {
            const p1 = i === 0 ? anglePolygon[anglePolygon.length - 2] : anglePolygon[i - 1];
            const p2 = anglePolygon[i];
            const p3 = anglePolygon[i + 1];

            const angleVector1 = Vector2.sub(p1, p2);
            const angleVector2 = Vector2.sub(p3, p2);

            const angleStart = Vector2.angle(angleVector1) - 90;
            const angleEnd = Vector2.angle(angleVector2) + 90;

            const range = new AngleRange(angleStart, angleEnd);

            if (range.getRange() >= 180) {
                continue;
            }

            for (let j = 0; j < linesVectors.length; j++) {
                const vector = linesVectors[j];
                const angleVector = Vector2.angle(vector.vt) - 90;

                if (range.between(angleVector)) {
                    traceLines.push({
                        point: p2,
                        vector: vector
                    });
                }
            }
        }
        return traceLines;
    }

    generateTraceLine(platePolygon, partPolygon, center) {
        const traceLines = [];

        const traceLines1 = this.calculateTraceLines(partPolygon, platePolygon);

        // 1. part-angle is in contact with plate-edge
        for (let i = 0; i < traceLines1.length; i++) {
            const traceLine1 = traceLines1[i];

            const p1 = Vector2.add(Vector2.sub(traceLine1.vector.sp, traceLine1.point), center);
            const p2 = Vector2.add(Vector2.sub(traceLine1.vector.ep, traceLine1.point), center);

            traceLines.push({
                sp: p1,
                ep: p2
            });
        }

        const traceLines2 = this.calculateTraceLines(platePolygon, partPolygon);

        // 2. part-edge is in contact with plate-angle
        for (let i = 0; i < traceLines2.length; i++) {
            const traceLine2 = traceLines2[i];

            const p1 = Vector2.add(Vector2.sub(traceLine2.point, traceLine2.vector.sp), center);
            const p2 = Vector2.add(Vector2.sub(traceLine2.point, traceLine2.vector.ep), center);

            traceLines.push({
                sp: p1,
                ep: p2
            });
        }

        return traceLines;
    }

    processCollinear(traceLines) {
        const len = traceLines.length;
        for (let i = 0; i < len; i++) {
            const traceLine1 = traceLines[i];
            traceLine1.interPoints = [];
            const l1 = new Line(traceLine1.sp, traceLine1.ep, TYPE_SEGMENT);
            for (let j = 0; j < len; j++) {
                if (i === j) {
                    continue;
                }
                const traceLine2 = traceLines[j];
                const l2 = new Line(traceLine2.sp, traceLine2.ep, TYPE_SEGMENT);

                if (Line.lineParallel(l1, l2)) {
                    if (Line.pointInLine(l2.v0, l1)) {
                        traceLine1.interPoints.push(l2.v0);
                    }
                    if (Line.pointInLine(l2.v1, l1)) {
                        traceLine1.interPoints.push(l2.v1);
                    }
                } else {
                    const point = Line.intersectionPoint(l1.v0, l1.v1, l2.v0, l2.v1);
                    if (point !== null) {
                        // roundAndMulPoint(point);
                        traceLine1.interPoints.push(point);
                    }
                }
            }
        }
        const newTraceLines = [];
        for (let i = 0; i < len; i++) {
            const traceLine = traceLines[i];
            const sortDirection = traceLine.sp.x !== traceLine.ep.x ? traceLine.sp.x < traceLine.ep.x : traceLine.sp.y < traceLine.ep.y;
            traceLine.interPoints.sort((p1, p2) => {
                if (!isEqual(p1.x, p2.x)) {
                    return sortDirection ? p1.x - p2.x : p2.x - p1.x;
                }
                return sortDirection ? p1.y - p2.y : p2.y - p1.y;
            });
            let lastPoint = traceLine.sp;
            for (let j = 0; j < traceLine.interPoints.length; j++) {
                const point = traceLine.interPoints[j];
                if (Vector2.isEqual(lastPoint, point)) {
                    continue;
                }
                newTraceLines.push({
                    sp: lastPoint,
                    ep: point
                });
                lastPoint = point;
            }
            if (!Vector2.isEqual(lastPoint, traceLine.ep)) {
                newTraceLines.push({
                    sp: lastPoint,
                    ep: traceLine.ep
                });
            }
        }
        // Delete the same segment
        newTraceLines.sort((t1, t2) => {
            if (!isEqual(t1.sp.x, t2.sp.x)) {
                return t1.sp.x - t2.sp.x;
            }
            if (!isEqual(t1.sp.y, t2.sp.y)) {
                return t1.sp.y - t2.sp.y;
            }
            if (!isEqual(t1.ep.x, t2.ep.x)) {
                return t1.ep.x - t2.ep.x;
            }
            if (!isEqual(t1.ep.y, t2.ep.y)) {
                return t1.ep.y - t2.ep.y;
            }
            return 0;
        });

        const resTraceLines = [newTraceLines[0]];

        let lastTraceLine = newTraceLines[0];
        for (let i = 1; i < newTraceLines.length; i++) {
            if (Vector2.isEqual(lastTraceLine.sp, newTraceLines[i].sp) && Vector2.isEqual(lastTraceLine.ep, newTraceLines[i].ep)) {
                continue;
            }
            lastTraceLine = newTraceLines[i];
            resTraceLines.push(newTraceLines[i]);
        }

        return resTraceLines;
    }

    processCollinearOnlyHVLines(traceLines) {
        const len = traceLines.length;
        const isBetween = (x, x1, x2) => {
            return (x < x1 && x > x2) || (x > x1 && x < x2);
        };
        const horizontalTraceLines = [];
        const verticalTraceLines = [];

        for (let i = 0; i < traceLines.length; i++) {
            const traceLine = traceLines[i];
            const isLHorizontal = traceLine.sp.y === traceLine.ep.y;
            traceLine.interPoints = [];
            if (isLHorizontal) {
                traceLine.maxX = Math.max(traceLine.sp.x, traceLine.ep.x);
                traceLine.minX = Math.min(traceLine.sp.x, traceLine.ep.x);
                horizontalTraceLines.push(traceLine);
            } else {
                traceLine.maxY = Math.max(traceLine.sp.y, traceLine.ep.y);
                traceLine.minY = Math.min(traceLine.sp.y, traceLine.ep.y);
                verticalTraceLines.push(traceLines[i]);
            }
        }

        horizontalTraceLines.sort((a, b) => {
            return a.sp.y - b.sp.y;
        });
        verticalTraceLines.sort((a, b) => {
            return a.sp.x - b.sp.x;
        });

        let si = 0;
        let ei = 0;
        for (let i = 0; i < horizontalTraceLines.length; i++) {
            for (let j = si; j < horizontalTraceLines.length; j++) {
                if (i === j) {
                    continue;
                }
                const traceLine1 = horizontalTraceLines[i];
                const traceLine2 = horizontalTraceLines[j];

                if (traceLine1.sp.y !== traceLine2.sp.y) {
                    ei = j;
                    break;
                }

                if (isBetween(traceLine2.sp.x, traceLine1.sp.x, traceLine1.ep.x)) {
                    traceLine1.interPoints.push(traceLine2.sp);
                }
                if (isBetween(traceLine2.ep.x, traceLine1.sp.x, traceLine1.ep.x)) {
                    traceLine1.interPoints.push(traceLine2.ep);
                }
            }
            if (ei === i + 1) {
                si = ei;
            }
        }

        si = 0;
        ei = 0;
        for (let i = 0; i < verticalTraceLines.length; i++) {
            for (let j = si; j < verticalTraceLines.length; j++) {
                if (i === j) {
                    continue;
                }
                const traceLine1 = verticalTraceLines[i];
                const traceLine2 = verticalTraceLines[j];

                if (traceLine1.sp.x !== traceLine2.sp.x) {
                    ei = j;
                    break;
                }

                if (isBetween(traceLine2.sp.y, traceLine1.sp.y, traceLine1.ep.y)) {
                    traceLine1.interPoints.push(traceLine2.sp);
                }
                if (isBetween(traceLine2.ep.y, traceLine1.sp.y, traceLine1.ep.y)) {
                    traceLine1.interPoints.push(traceLine2.ep);
                }
            }
            if (ei === i + 1) {
                si = ei;
            }
        }

        for (let i = 0; i < horizontalTraceLines.length; i++) {
            for (let j = 0; j < verticalTraceLines.length; j++) {
                const traceLine1 = horizontalTraceLines[i];
                const traceLine2 = verticalTraceLines[j];

                if (traceLine2.sp.x > traceLine1.maxX) {
                    break;
                }
                if (traceLine2.sp.x < traceLine1.minX) {
                    continue;
                }

                if (traceLine2.minY < traceLine1.sp.y && traceLine1.sp.y < traceLine2.maxY) {
                    const interPoint = {
                        x: traceLine2.sp.x,
                        y: traceLine1.sp.y
                    };
                    traceLine1.interPoints.push(interPoint);
                }
            }
        }

        for (let i = 0; i < verticalTraceLines.length; i++) {
            for (let j = 0; j < horizontalTraceLines.length; j++) {
                const traceLine1 = verticalTraceLines[i];
                const traceLine2 = horizontalTraceLines[j];

                if (traceLine2.sp.y > traceLine1.maxY) {
                    break;
                }
                if (traceLine2.sp.y < traceLine1.minY) {
                    continue;
                }

                if (traceLine2.minX < traceLine1.sp.x && traceLine1.sp.x < traceLine2.maxX) {
                    const interPoint = {
                        x: traceLine1.sp.x,
                        y: traceLine2.sp.y
                    };
                    traceLine1.interPoints.push(interPoint);
                }
            }
        }
        // for (let i = 0; i < len; i++) {
        //     const traceLine1 = traceLines[i];
        //     traceLine1.interPoints = [];
        //     const isLHorizontal1 = traceLine1.sp.y === traceLine1.ep.y;
        //     for (let j = 0; j < len; j++) {
        //         if (i === j) {
        //             continue;
        //         }
        //         const traceLine2 = traceLines[j];
        //         const isLHorizontal2 = traceLine2.sp.y === traceLine2.ep.y;
        //
        //         if (isLHorizontal1 && isLHorizontal2 && traceLine1.sp.y === traceLine2.sp.y) {
        //             if (isBetween(traceLine2.sp.x, traceLine1.sp.x, traceLine1.ep.x)) {
        //                 traceLine1.interPoints.push(traceLine2.sp);
        //             }
        //             if (isBetween(traceLine2.ep.x, traceLine1.sp.x, traceLine1.ep.x)) {
        //                 traceLine1.interPoints.push(traceLine2.ep);
        //             }
        //         }
        //
        //         if (!isLHorizontal1 && !isLHorizontal2 && traceLine1.sp.x === traceLine2.sp.x) {
        //             if (isBetween(traceLine2.sp.y, traceLine1.sp.y, traceLine1.ep.y)) {
        //                 traceLine1.interPoints.push(traceLine2.sp);
        //             }
        //             if (isBetween(traceLine2.ep.y, traceLine1.sp.y, traceLine1.ep.y)) {
        //                 traceLine1.interPoints.push(traceLine2.ep);
        //             }
        //         }
        //
        //         if (isLHorizontal1 && !isLHorizontal2) {
        //             if (isBetween(traceLine1.sp.y, traceLine2.sp.y, traceLine2.ep.y) && isBetween(traceLine2.sp.x, traceLine1.sp.x, traceLine1.ep.x)) {
        //                 const interPoint = {
        //                     x: traceLine2.sp.x,
        //                     y: traceLine1.sp.y
        //                 };
        //                 traceLine1.interPoints.push(interPoint);
        //             }
        //         }
        //
        //         if (!isLHorizontal1 && isLHorizontal2) {
        //             if (isBetween(traceLine1.sp.x, traceLine2.sp.x, traceLine2.ep.x) && isBetween(traceLine2.sp.y, traceLine1.sp.y, traceLine1.ep.y)) {
        //                 const interPoint = {
        //                     x: traceLine1.sp.x,
        //                     y: traceLine2.sp.y
        //                 };
        //                 traceLine1.interPoints.push(interPoint);
        //             }
        //         }
        //     }
        // }
        const newTraceLines = [];
        for (let i = 0; i < len; i++) {
            const traceLine = traceLines[i];
            const sortDirection = traceLine.sp.x !== traceLine.ep.x ? traceLine.sp.x < traceLine.ep.x : traceLine.sp.y < traceLine.ep.y;
            traceLine.interPoints.sort((p1, p2) => {
                if (!isEqual(p1.x, p2.x)) {
                    return sortDirection ? p1.x - p2.x : p2.x - p1.x;
                }
                return sortDirection ? p1.y - p2.y : p2.y - p1.y;
            });
            let lastPoint = traceLine.sp;
            for (let j = 0; j < traceLine.interPoints.length; j++) {
                const point = traceLine.interPoints[j];
                if (Vector2.isEqual(lastPoint, point)) {
                    continue;
                }
                newTraceLines.push({
                    sp: lastPoint,
                    ep: point
                });
                lastPoint = point;
            }
            if (!Vector2.isEqual(lastPoint, traceLine.ep)) {
                newTraceLines.push({
                    sp: lastPoint,
                    ep: traceLine.ep
                });
            }
        }
        // Delete the same segment
        newTraceLines.sort((t1, t2) => {
            if (!isEqual(t1.sp.x, t2.sp.x)) {
                return t1.sp.x - t2.sp.x;
            }
            if (!isEqual(t1.sp.y, t2.sp.y)) {
                return t1.sp.y - t2.sp.y;
            }
            if (!isEqual(t1.ep.x, t2.ep.x)) {
                return t1.ep.x - t2.ep.x;
            }
            if (!isEqual(t1.ep.y, t2.ep.y)) {
                return t1.ep.y - t2.ep.y;
            }
            return 0;
        });

        const resTraceLines = [newTraceLines[0]];

        let lastTraceLine = newTraceLines[0];
        for (let i = 1; i < newTraceLines.length; i++) {
            if (Vector2.isEqual(lastTraceLine.sp, newTraceLines[i].sp) && Vector2.isEqual(lastTraceLine.ep, newTraceLines[i].ep)) {
                continue;
            }
            lastTraceLine = newTraceLines[i];
            resTraceLines.push(newTraceLines[i]);
        }

        return resTraceLines;
    }

    // eslint-disable-next-line no-unused-vars
    deleteOutTraceLine(traceLines, platePolygon, center) {
        const newTraceLines = [];

        for (let i = 0; i < traceLines.length; i++) {
            const traceLine = traceLines[i];
            const sp = traceLine.sp;
            const ep = traceLine.ep;

            if (Vector2.isEqual(sp, ep)) {
                continue;
            }

            if (!PolygonUtils.isPointInPolygon(sp, platePolygon) || !PolygonUtils.isPointInPolygon(ep, platePolygon)) {
                continue;
            }

            newTraceLines.push(traceLine);
        }
        return newTraceLines;
    }

    traverTraceLines(traceLines) {
        const newTraceLines = [];

        while (true) {
            if (traceLines.length === 0) {
                break;
            }

            const lowerIndex = this.searchLowerStartPointIndex(traceLines);
            const traceIndexSet = new Set();
            traceIndexSet.add(lowerIndex);
            const traceIndex = [lowerIndex];

            const traceIndexMap = new Map();

            for (let i = 0; i < traceLines.length; i++) {
                const traceLine = traceLines[i];
                const key = this.toPointHash(traceLine.sp);
                if (!traceIndexMap.has(key)) {
                    traceIndexMap.set(key, []);
                }
                traceIndexMap.get(key)
                    .push(i);
            }

            let currentPointIndex = lowerIndex;

            let circleCount = 0;
            while (true) {
                const nextIndexs = traceIndexMap.get(this.toPointHash(traceLines[currentPointIndex].ep));

                if (!nextIndexs) {
                    break;
                }

                const currentAngle = Vector2.anglePoint(traceLines[currentPointIndex].sp, traceLines[currentPointIndex].ep);
                let angle = 180;
                let nextPointIndex = -1;

                for (let i = 0; i < nextIndexs.length; i++) {
                    const index = nextIndexs[i];

                    const nextAngle = Vector2.anglePoint(traceLines[index].sp, traceLines[index].ep);
                    let diffAngle = nextAngle - currentAngle;

                    // if (diffAngle === -180) {
                    //     nextPointIndex = -1;
                    //     break;
                    // }

                    if (diffAngle > 180) {
                        diffAngle -= 360;
                    }
                    if (diffAngle < -180) {
                        diffAngle += 360;
                    }
                    if (diffAngle < angle) {
                        angle = diffAngle;
                        nextPointIndex = index;
                    }
                }

                if (nextPointIndex !== -1) {
                    currentPointIndex = nextPointIndex;
                    if (traceIndexSet.has(nextPointIndex)) {
                        circleCount++;
                        traceIndex.push(nextPointIndex);
                        if (circleCount >= 2) {
                            break;
                        }
                    } else {
                        circleCount = 0;
                        traceIndex.push(nextPointIndex);
                        traceIndexSet.add(nextPointIndex);
                    }
                } else {
                    break;
                }
            }

            let cycleIndex = -1;
            const lastIndex = traceIndex[traceIndex.length - 1];
            for (let i = 0; i < traceIndex.length - 1; i++) {
                const index = traceIndex[i];
                if (index === lastIndex) {
                    cycleIndex = i;
                    break;
                }
            }

            if (cycleIndex !== -1) {
                const traceCycleSet = new Set();
                for (let i = cycleIndex; i < traceIndex.length; i++) {
                    traceCycleSet.add(traceIndex[i]);
                }
                for (let i = 0; i < traceLines.length; i++) {
                    if (traceCycleSet.has(i)) {
                        newTraceLines.push(traceLines[i]);
                    }
                }

                // return newTraceLines;
            }

            const deleteSet = new Set();
            for (let i = 0; i < traceIndex.length; i++) {
                const index = traceIndex[i];
                // const indexs1 = traceIndexMap.get(this.toPointHash(traceLines[index].sp));
                // const indexs2 = traceIndexMap.get(this.toPointHash(traceLines[index].ep));
                deleteSet.add(index);
                // if (indexs1) {
                //     for (let j = 0; j < indexs1.length; j++) {
                //         deleteSet.add(indexs1[j]);
                //     }
                // }
                // if (indexs2) {
                //     for (let j = 0; j < indexs2.length; j++) {
                //         deleteSet.add(indexs2[j]);
                //     }
                // }
            }
            traceLines = traceLines.filter((v, i) => !deleteSet.has(i));

            if (newTraceLines.length > 0) {
                return [newTraceLines, traceLines];
            }
        }

        return [newTraceLines, traceLines];
    }

    // eslint-disable-next-line no-unused-vars
    mergeTraceLines2Polygon(traceLines, platePolygon, center) {
        traceLines = this.processCollinear(traceLines);

        traceLines = this.deleteOutTraceLine(traceLines, platePolygon, center);

        const traceRings = [];
        let newTraceLines;

        while (true) {
            [newTraceLines, traceLines] = this.traverTraceLines(traceLines);
            if (newTraceLines.length > 0) {
                traceRings.push(newTraceLines.map(v => v));
            } else {
                break;
            }
        }

        return traceRings;
    }

    toPointHash(point) {
        return Math.round(point.x * 1000) * 10000000 + Math.round(point.y * 1000);
    }

    deleteNoRingSegments(traceLines) {
        const deleteIndex = new Set();

        let isDelete = true;

        while (isDelete) {
            isDelete = false;

            const traceMap = new Map();

            for (let i = 0; i < traceLines.length; i++) {
                if (deleteIndex.has(i)) {
                    continue;
                }
                const traceLine = traceLines[i];
                const spKey = this.toPointHash(traceLine.sp);
                const epKey = this.toPointHash(traceLine.ep);

                if (!traceMap.has(spKey)) {
                    traceMap.set(spKey, {
                        index: [i],
                        in: 1,
                        out: 0
                    });
                } else {
                    traceMap.get(spKey)
                        .index
                        .push(i);
                    traceMap.get(spKey).in++;
                }

                if (!traceMap.has(epKey)) {
                    traceMap.set(epKey, {
                        index: [i],
                        in: 0,
                        out: 1
                    });
                } else {
                    traceMap.get(epKey)
                        .index
                        .push(i);
                    traceMap.get(epKey).out++;
                }
            }

            for (const value of traceMap.values()) {
                if (value.in === 0 || value.out === 0) {
                    isDelete = true;
                    for (let i = 0; i < value.index.length; i++) {
                        deleteIndex.add(value.index[i]);
                    }
                }
            }
        }

        return traceLines.filter((v, i) => !deleteIndex.has(i));
    }

    lessThanLowerPoint(point1, point2) {
        const len1 = Vector2.length2(point1);
        const len2 = Vector2.length2(point2);
        return len1 < len2;
    }

    setMinPoint(lowerPoint, point) {
        const lowerLen2 = lowerPoint.x * lowerPoint.x + lowerPoint.y * lowerPoint.y;
        const pointLen2 = point.x * point.x + point.y * point.y;
        // const lowerMin = Math.min(lowerPoint.x, lowerPoint.y);
        // const pointMin = Math.min(point.x, point.y);
        // if (lowerMin > pointMin) {
        //     lowerPoint.x = point.x;
        //     lowerPoint.y = point.y;
        //     return true;
        // }
        // if (isEqual(lowerPoint.y, point.y)) {
        //     if (lowerPoint.x > point.x) {
        //         lowerPoint.x = point.x;
        //         lowerPoint.y = point.y;
        //         return true;
        //     }
        // } else {
        //     if (lowerPoint.y > point.y) {
        //         lowerPoint.x = point.x;
        //         lowerPoint.y = point.y;
        //         return true;
        //     }
        // }
        if (lowerLen2 > pointLen2) {
            lowerPoint.x = point.x;
            lowerPoint.y = point.y;
            return true;
        }
        return false;
    }

    searchLowerStartPointIndex(nfpLines) {
        let point = nfpLines[0].sp;
        let index = 0;

        for (let i = 0; i < nfpLines.length; i++) {
            const nfpLine = nfpLines[i];

            if (this.lessThanLowerPoint(nfpLine.sp, point)) {
                point = nfpLine.sp;
                index = i;
            }
        }
        return index;
    }

    searchLowerPosition(nfpLines) {
        let point = nfpLines[0].sp;

        for (let i = 0; i < nfpLines.length; i++) {
            const nfpLine = nfpLines[i];

            if (this.lessThanLowerPoint(nfpLine.sp, point)) {
                point = nfpLine.sp;
            }
            if (this.lessThanLowerPoint(nfpLine.ep, point)) {
                point = nfpLine.ep;
            }
        }

        return {
            x: point.x,
            y: point.y
        };
    }

    standardizedPolygons(rotatePolygons) {
        roundAndMulPolygons(rotatePolygons);
        const box = PolygonUtils.getBox(rotatePolygons[0]);
        const movePolygons = PolygonsUtils.move(rotatePolygons, {
            x: -box.min.x,
            y: -box.min.y
        });

        const standardizedPolygon = (standardPolygon, outer = true) => {
            const resPolygon = [standardPolygon[0]];

            for (let i = 1; i < standardPolygon.length; i++) {
                const prePoint = standardPolygon[i - 1];
                const curPoint = standardPolygon[i];

                if (prePoint.x === curPoint.x || prePoint.y === curPoint.y) {
                    resPolygon.push(curPoint);
                    continue;
                }

                const dx = curPoint.x - prePoint.x;
                const dy = curPoint.y - prePoint.y;

                const t = Math.max(Math.abs(dx), Math.abs(dy));
                let firstX = (dx > 0 && dy > 0) || (dx < 0 && dy < 0);
                if (!outer) {
                    firstX = !firstX;
                }

                let lastX = 0;
                let lastY = 0;
                const interval = this.limitEdge;
                for (let j = interval; j < t + interval; j += interval) {
                    const k = Math.min(j / t, 1);
                    const curX = Math.ceil(Math.round(k * dx * 1000) / 1000);
                    const curY = Math.ceil(Math.round(k * dy * 1000) / 1000);

                    if (firstX) {
                        if (curX !== lastX) {
                            resPolygon.push({
                                x: prePoint.x + curX,
                                y: prePoint.y + lastY
                            });
                            lastX = curX;
                        }
                        if (curY !== lastY) {
                            resPolygon.push({
                                x: prePoint.x + lastX,
                                y: prePoint.y + curY
                            });
                            lastY = curY;
                        }
                    } else {
                        if (curY !== lastY) {
                            resPolygon.push({
                                x: prePoint.x + lastX,
                                y: prePoint.y + curY
                            });
                            lastY = curY;
                        }
                        if (curX !== lastX) {
                            resPolygon.push({
                                x: prePoint.x + curX,
                                y: prePoint.y + lastY
                            });
                            lastX = curX;
                        }
                    }
                }
            }
            return simplifyPolygons([resPolygon])[0];
        };

        const resPolygons = [];
        for (let i = 0; i < movePolygons.length; i++) {
            resPolygons.push(standardizedPolygon(movePolygons[i], i % 2 === 0));
        }

        return resPolygons;
    }

    getRotatePolygons(polygons, i, center) {
        const rotatePolygons = PolygonsUtils.rotate(polygons, i, center);
        roundAndMulPolygons(rotatePolygons);

        const box = PolygonUtils.getBox(rotatePolygons[0]);
        const offset = {
            x: -box.min.x,
            y: -box.min.y
        };
        // const movePolygons = PolygonsUtils.move(rotatePolygons, {
        //     x: -box.min.x,
        //     y: -box.min.y
        // });
        return {
            rotatePolygons: PolygonsUtils.move(rotatePolygons, offset),
            rotateCenter: Vector2.add(center, offset)
        };
    }

    getCenter(polygon) {
        const center = PolygonUtils.center(polygon);
        // roundAndMulPoint(center);
        return center;
    }

    generateNFP(plate, part) {
        let finalResult = null;

        for (let i = 0; i < 360; i += this.rotate) {
            const { rotatePolygons, rotateCenter } = this.getRotatePolygons(part.polygons, i, part.center);

            const traceLines = this.generateTraceLine(plate.polygon, rotatePolygons[0], rotateCenter);

            const nfpRings = this.mergeTraceLines2Polygon(traceLines, plate.polygon, rotateCenter);

            if (!nfpRings || nfpRings.length === 0) {
                continue;
            }

            let lowerPoint = null;

            for (let j = 0; j < nfpRings.length; j++) {
                const nfpLines = nfpRings[j];

                const lowerPointTmp = this.searchLowerPosition(nfpLines);

                const movePolygons = PolygonsUtils.move(rotatePolygons, Vector2.sub(lowerPointTmp, rotateCenter));
                const diffPolygons = polyDiff([movePolygons[0]], [plate.polygon]);

                if (diffPolygons && diffPolygons[0] && diffPolygons[0].length > 0) {
                    let area = 0;
                    for (let k = 0; k < diffPolygons.length; k++) {
                        area += Math.abs(PolygonUtils.area(diffPolygons[k]));
                    }

                    if (area > this.accuracy * this.accuracy) {
                        continue;
                    }
                }

                lowerPoint = lowerPointTmp;
            }

            if (lowerPoint === null) {
                continue;
            }

            const result = {
                position: lowerPoint,
                angle: i,
                center: rotateCenter,
                rotatePolygons: rotatePolygons
            };

            if (finalResult === null) {
                finalResult = result;
            } else if (this.lessThanLowerPoint(result.position, finalResult.position)) {
                finalResult = result;
            }
        }

        return finalResult;
    }

    sortPlates() {
        this.plates.sort((a, b) => {
            return b.absArea - a.absArea;
        });
    }

    updateCurrentPlate(currentPlate, diffPlatePolygons) {
        // const innerPolys = polyOffset(diffPlatePolygons, -this.plateOffset, ClipperLib.JoinType.jtMiter);
        const offsetPolys = polyOffset(diffPlatePolygons, -this.plateOffset, ClipperLib.JoinType.jtMiter);

        const innerPolys = [];

        for (let i = 0; i < offsetPolys.length; i++) {
            const offsetPoly = offsetPolys[i];
            const outerPoly = polyOffset([offsetPoly], this.plateOffset, ClipperLib.JoinType.jtMiter)[0];
            roundAndMulPolygon(outerPoly);
            const unionPolys = polyIntersection(diffPlatePolygons, [outerPoly]);
            innerPolys.push(unionPolys[0]);
        }

        const plates = [];

        if (!innerPolys || innerPolys.length === 0) {
            currentPlate.absArea = 0;
        } else {
            for (let i = 0; i < innerPolys.length; i++) {
                const outerPoly = innerPolys[i];
                const plate = new Plate(outerPoly);
                plates.push(plate);
            }

            currentPlate.polygon = plates[0].polygon;
            currentPlate.area = plates[0].area;
            currentPlate.asbArea = plates[0].absArea;

            for (let i = 1; i < plates.length; i++) {
                this.plates.push(plates[i]);
            }
        }
    }

    partPlacement(plate, part) {
        const res = this.generateNFP(plate, part);

        if (res === null) {
            return null;
        }

        roundAndMulPoint(res.position);

        res.rotatePolygons = PolygonsUtils.move(res.rotatePolygons, Vector2.sub(res.position, res.center));

        const diffPlatePolygons = polyDiff([plate.polygon], [res.rotatePolygons[0]]);

        this.updateCurrentPlate(plate, diffPlatePolygons);

        for (let i = 1; i < res.rotatePolygons.length; i++) {
            this.plates.push(new Plate(res.rotatePolygons[i]));
        }

        return res;
    }

    startNFP(onProgress) {
        for (let i = 0; i < this.parts.length; i++) {
            onProgress && onProgress(0.5 + i / this.parts.length / 2);
            const part = this.parts[i];

            if (part.isPlace) {
                continue;
            }

            this.sortPlates();
            for (let j = 0; j < this.plates.length; j++) {
                const plate = this.plates[j];

                if (plate.absArea < part.absArea) {
                    continue;
                }

                const res = this.partPlacement(plate, part);

                if (res) {
                    part.position = res.position;
                    part.rotatePolygons = res.rotatePolygons;
                    part.angle = res.angle;
                    part.center = res.center;
                    break;
                }
            }

            this.resultParts.push(part);
        }

        for (let i = 0; i < this.resultParts.length; i++) {
            const part = this.resultParts[i];
            if (!part.rotatePolygons) {
                continue;
            }
            roundAndMulPolygons(part.rotatePolygons, 1 / this.accuracy);
            roundAndMulPoint(part.center, 1 / this.accuracy);
            roundAndMulPoint(part.position, 1 / this.accuracy);
            part.area /= this.accuracy;
            part.absArea /= this.accuracy;
        }

        return this.resultParts;
    }

    start(onProgress) {
        return this.startNFP(onProgress);
    }
}
