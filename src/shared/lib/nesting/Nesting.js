import { Vector2 } from '../math/Vector2';
import { PolygonUtils } from '../math/PolygonsUtils';
import AngleRange from './AngleRange';
import { Line, TYPE_SEGMENT } from '../math/Line';
import { isEqual } from '../utils';
import { polyDiff, polyOffset, simplifyPolygons } from '../../../server/lib/clipper/cLipper-adapter';
import * as ClipperLib from '../../../server/lib/clipper/clipper';

const roundPoint = (point) => {
    point.x = Math.round(point.x);
    point.y = Math.round(point.y);
};

const roundPolygon = (polygon) => {
    for (let i = 0; i < polygon.length; i++) {
        roundPoint(polygon[i]);
    }
};

export class Part {
    position;

    polygons;

    outlinePolygon;

    interPolygon;

    area;

    absArea;

    center;

    angle;

    rotatePolygon;

    constructor(polygons) {
        this.polygons = polygons;
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

export class Nesting {
    currentPlate = null;

    interval = 2;

    plates = [];

    parts = [];

    resultParts = [];

    rotate = 360;

    plateOffset = 10;

    minPartArea;

    constructor(options) {
        const {
            plates = [],
            parts = [],
            rotate,
            interval
        } = options;

        this.plates = plates.map(v => v);
        this.rotate = rotate;
        this.interval = interval;
        this.parts = parts.map(v => v);
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

    initializeParts() {
        for (let i = 0; i < this.parts.length; i++) {
            const part = this.parts[i];
            part.outlinePolygon = part.polygons[0];
            if (part.polygons.length > 1) {
                part.interPolygon = part.polygons[1];
            }

            PolygonUtils.sort(part.outlinePolygon, false);

            part.area = Vector2.area(part.outlinePolygon);
            part.absArea = Math.abs(part.area);
        }

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
                    const point = Line.intersectionPoint(l1, l2);
                    if (point !== null) {
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

        // const isLess = (a, b) => {
        //     return a - b < -EPSILON;
        // };

        for (let i = 0; i < traceLines.length; i++) {
            const traceLine = traceLines[i];
            const sp = traceLine.sp;
            const ep = traceLine.ep;
            if (Vector2.isEqual(sp, ep)) {
                continue;
            }

            // if (isLess(sp.x, center.x) || isLess(ep.x, center.x) || isLess(sp.y, center.y) || isLess(ep.y, center.y)) {
            //     continue;
            // }

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

                    if (diffAngle === 180 || diffAngle === -180) {
                        nextPointIndex = -1;
                        break;
                    }

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

                return newTraceLines;
            }

            const deleteSet = new Set();
            for (let i = 0; i < traceIndex.length; i++) {
                const index = traceIndex[i];
                const indexs1 = traceIndexMap.get(this.toPointHash(traceLines[index].sp));
                const indexs2 = traceIndexMap.get(this.toPointHash(traceLines[index].ep));
                deleteSet.add(index);
                if (indexs1) {
                    for (let j = 0; j < indexs1.length; j++) {
                        deleteSet.add(indexs1[j]);
                    }
                }
                if (indexs2) {
                    for (let j = 0; j < indexs2.length; j++) {
                        deleteSet.add(indexs2[j]);
                    }
                }
            }
            traceLines = traceLines.filter((v, i) => !deleteSet.has(i));
        }

        return newTraceLines;
    }

    mergeTraceLines2Polygon(traceLines, platePolygon, center, i) {
        // traceLines = this.processCollinear(traceLines);
        traceLines = this.processCollinearOnlyHVLines(traceLines);

        // traceLines = this.deleteOutTraceLine(traceLines, platePolygon, center);

        // traceLines = this.deleteNoRingSegments(traceLines);

        traceLines = this.traverTraceLines(traceLines, i);

        return traceLines;
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
        const point = {
            x: nfpLines[0].sp.x,
            y: nfpLines[0].sp.y
        };
        let index = 0;

        for (let i = 0; i < nfpLines.length; i++) {
            const nfpLine = nfpLines[i];

            if (this.setMinPoint(point, nfpLine.sp)) {
                index = i;
            }
        }
        return index;
    }

    searchLowerPosition(nfpLines) {
        const point = {
            x: nfpLines[0].sp.x,
            y: nfpLines[0].sp.y
        };

        for (let i = 0; i < nfpLines.length; i++) {
            const nfpLine = nfpLines[i];

            this.setMinPoint(point, nfpLine.sp);
            this.setMinPoint(point, nfpLine.ep);
        }

        return point;
    }

    standardizedPolygon(rotatePolygon) {
        roundPolygon(rotatePolygon);
        const box = PolygonUtils.getBox(rotatePolygon);
        const movePolygon = PolygonUtils.move(rotatePolygon, {
            x: -box.min.x,
            y: -box.min.y
        });

        const resPolygon = [movePolygon[0]];

        for (let i = 1; i < movePolygon.length; i++) {
            const prePoint = movePolygon[i - 1];
            const curPoint = movePolygon[i];

            if (prePoint.x === curPoint.x || prePoint.y === curPoint.y) {
                resPolygon.push(curPoint);
                continue;
            }

            const dx = curPoint.x - prePoint.x;
            const dy = curPoint.y - prePoint.y;

            const t = Math.max(Math.abs(dx), Math.abs(dy));
            const firstX = (dx > 0 && dy > 0) || (dx < 0 && dy < 0);

            let lastX = 0;
            let lastY = 0;
            const interval = this.interval;
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
    }

    generateNFP(plate, part) {
        const result = {
            position: null,
            angle: 0,
            rotatePolygon: null,
            center: null
        };

        for (let i = 0; i < 180; i += this.rotate) {
            let rotatePolygon = i === 0 ? part.outlinePolygon : PolygonUtils.rotate(part.outlinePolygon, i);
            rotatePolygon = this.standardizedPolygon(rotatePolygon);

            const platePolygon = plate.polygon;
            const center = PolygonUtils.center(rotatePolygon);
            roundPoint(center);

            const traceLines = this.generateTraceLine(plate.polygon, rotatePolygon, center);

            for (let j = 0; j < traceLines.length; j++) {
                const traceLine = traceLines[j];
                if (traceLine.sp.x !== traceLine.ep.x && traceLine.sp.y !== traceLine.ep.y) {
                    console.error('error');
                }
            }

            const nfpLines = this.mergeTraceLines2Polygon(traceLines, platePolygon, center, i);

            if (!nfpLines || nfpLines.length === 0) {
                console.log('this polygon cant be put in');
                continue;
            }

            const lowerPoint = this.searchLowerPosition(nfpLines);

            if (result.position === null) {
                result.position = lowerPoint;
                result.angle = i;
                result.rotatePolygon = rotatePolygon;
                result.center = center;
            } else {
                if (this.setMinPoint(result.position, lowerPoint)) {
                    result.angle = i;
                    result.rotatePolygon = rotatePolygon;
                    result.center = center;
                }
            }
        }

        return result.position === null ? null : result;
    }

    resetCurrentPlate() {
        this.currentPlate = null;
        if (!this.plates || this.plates.length === 0) {
            return;
        }
        let maxIndex = -1;
        let maxArea = -1;

        for (let i = 0; i < this.plates.length; i++) {
            if (this.plates[i].absArea > maxArea) {
                maxArea = this.plates[i].absArea;
                maxIndex = i;
            }
        }

        this.currentPlate = this.plates.splice(maxIndex, 1)[0];
    }

    updateCurrentPlate(diffPlatePolygons) {
        const innerPolys = polyOffset(diffPlatePolygons, -this.plateOffset, ClipperLib.JoinType.jtMiter);
        const plates = [];

        if (!innerPolys || innerPolys.length === 0) {
            this.currentPlate.absArea = 0;
        } else {
            for (let i = 0; i < innerPolys.length; i++) {
                const outerPoly = polyOffset([innerPolys[i]], this.plateOffset, ClipperLib.JoinType.jtMiter)[0];
                const plate = new Plate(outerPoly);
                plates.push(plate);
            }

            plates.sort((a, b) => b.absArea - a.absArea);

            this.currentPlate = plates[0];
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

        res.rotatePolygon = PolygonUtils.move(res.rotatePolygon, Vector2.sub(res.position, res.center));

        const diffPlatePolygons = polyDiff([plate.polygon], [res.rotatePolygon]);

        this.updateCurrentPlate(diffPlatePolygons);

        if (part.interPolygon) {
            const innerPlate = new Plate(part.interPolygon);
            this.plates.push(innerPlate);
        }

        return res;
    }

    startNFP() {
        while (true) {
            this.resetCurrentPlate();

            for (let i = 0; i < this.parts.length; i++) {
                const part = this.parts[i];

                if (this.currentPlate.absArea < part.absArea) {
                    continue;
                }

                const res = this.partPlacement(this.currentPlate, part);

                if (res) {
                    part.position = res.position;
                    part.rotatePolygon = res.rotatePolygon;
                    part.angle = res.angle;
                    part.center = res.center;

                    this.resultParts.push(part);
                    this.parts.splice(i, 1);
                    i--;
                }
            }

            if (this.parts.length === 0 || this.plates.length === 0) {
                break;
            }
        }
    }

    start() {
        this.initializeParts();

        this.startNFP();
    }
}
