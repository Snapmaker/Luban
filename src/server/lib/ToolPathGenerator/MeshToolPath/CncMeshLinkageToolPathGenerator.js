import EventEmitter from 'events';
import { Vector2 } from '../../../../shared/lib/math/Vector2';
import { CutAngle } from '../../MeshProcess/CutAngles';
import { round } from '../../../../shared/lib/utils';
import { MeshProcess } from '../../MeshProcess/MeshProcess';
import { Slicer } from '../../MeshProcess/Slicer';
import ToolPath from '../../ToolPath';
import { Polygon } from '../../../../shared/lib/clipper/Polygons';

export default class CncMeshLinkageToolPathGenerator extends EventEmitter {
    constructor(modelInfo) {
        super();
        const { uploadName, gcodeConfig = {}, transformation = {}, materials = {}, toolParams = {} } = modelInfo;

        const { stepOver = 0.25, safetyHeight = 1, smoothY = true, stepDown, allowance } = gcodeConfig;
        const { isRotate, diameter } = materials;
        const { toolDiameter = 0, toolAngle = 0, toolShaftDiameter = 0 } = toolParams;

        this.modelInfo = modelInfo;
        this.uploadName = uploadName;
        this.transformation = transformation;
        this.gcodeConfig = gcodeConfig;
        this.allowance = allowance;

        this.density = 1 / stepOver;
        this.smoothY = smoothY;
        this.stepDown = stepDown;

        this.isRotate = isRotate;
        this.diameter = diameter;

        this.initialZ = diameter / 2 + safetyHeight;
        this.toolPath = new ToolPath({ isRotate, diameter: diameter });

        this.toolDiameter = toolDiameter;
        this.toolAngle = toolAngle;
        this.toolShaftDiameter = toolShaftDiameter;
    }

    _generateHullPolygonCutPath(convexHullPolygon) {
        let preIndex = 0;
        let nextIndex = 0;

        const getIndex = (index, len) => {
            return (index + len) % len;
        };

        const cutPath = [];

        let lastB = 0;

        for (let i = 0; i < convexHullPolygon.size(); i++) {
            const p = convexHullPolygon.get(i);
            preIndex = i - 1;
            while (Vector2.isEqual(convexHullPolygon.get(getIndex(preIndex, convexHullPolygon.size())), p)) {
                preIndex--;
            }
            nextIndex = i + 1;
            while (Vector2.isEqual(convexHullPolygon.get(getIndex(nextIndex, convexHullPolygon.size())), p)) {
                nextIndex++;
            }
            const pre = convexHullPolygon.get(getIndex(preIndex, convexHullPolygon.size()));
            const next = convexHullPolygon.get(getIndex(nextIndex, convexHullPolygon.size()));
            const an1 = Vector2.anglePoint(p, pre);
            const an2 = Vector2.anglePoint(p, next);
            const cutAngle = new CutAngle(an1, an2);
            const normal = cutAngle.getNormal();

            let b = 90 - normal;

            while (Math.abs(lastB - b) > 180) {
                b = lastB > b ? b + 360 : b - 360;
            }

            cutPath.push({
                x: p.x,
                y: p.y,
                cutAngle: cutAngle,
                normal: cutAngle.getNormal(),
                b: b
            });

            lastB = b;
        }

        return cutPath;
    }

    _lineToHash(p1, p2) {
        return p1.x * 1000000000 + p1.y * 1000000 + p2.x * 1000 + p2.y;
    }

    _testConsole(datas) {
        for (const data of datas) {
            this.toolPath.move0Z(data.z, 300);
            this.toolPath.move0Y(data.y, 300);
            this.toolPath.move0B(0, 300);

            const polygons = data.polygons;

            for (let j = 0; j < polygons.size(); j++) {
                const polygon = polygons.get(j);
                for (let i = 0; i < polygon.size(); i++) {
                    const point = polygon.get(i);

                    if (i === 0) {
                        this.toolPath.move0XZ(point.x, point.y, 300);
                    } else {
                        this.toolPath.move1XZ(point.x, point.y, 300);
                    }
                }
            }
        }
    }

    _generateSlicerLayerToolPath(slicerLayers, index, gcodeConfig) {
        const { jogSpeed = 300, workSpeed = 300, plungeSpeed = 300 } = gcodeConfig;

        const slicerLayer = slicerLayers[index];

        const polygonsPart = slicerLayer.polygonsPart;
        const convexHullPolygons = polygonsPart.convexHull();

        const diffPolygons = convexHullPolygons.diff(polygonsPart);
        const lineSet = new Set();
        diffPolygons.forEach(diffPolygon => {
            diffPolygon.forEachLine((p1, p2) => {
                lineSet.add(this._lineToHash(p1, p2));
            });
        });

        const convexHullPath = this._generateHullPolygonCutPath(convexHullPolygons.get(0));

        let lastPoint = null;

        const path = [];

        const gY = slicerLayer.z;

        for (let i = 0; i < convexHullPath.length; i++) {
            const point = convexHullPath[i];

            if (i === 0) {
                lastPoint = point;
                continue;
            }

            const gcodePoints = this._interpolatePoints(slicerLayers, index, lastPoint, point, diffPolygons, lineSet);

            if (gcodePoints.length === 0) {
                lastPoint = point;

                continue;
            }

            if (i === 1) {
                const { x, y } = Vector2.rotate(gcodePoints[0], gcodePoints[0].b);

                const gX = round(x, 3);
                const gZ = round(y, 3);

                path.push({ x: gX, y: gZ, b: gcodePoints[0].b });
            }

            for (let j = 1; j < gcodePoints.length; j++) {
                const gcodePoint = gcodePoints[j];
                const { x, y } = Vector2.rotate(gcodePoint, gcodePoint.b);
                const gX = round(x, 3);
                const gZ = round(y, 3);
                // this.toolPath.move1XZB(gX, gZ, gcodePoint.b, workSpeed);
                path.push({ x: gX, y: gZ, b: gcodePoint.b });
            }

            lastPoint = point;
        }

        const stepDownPaths = this._generateGocdePointsByStepDown(convexHullPath);

        stepDownPaths.push(path);

        let lastState = this.toolPath.getState();
        let circle = Math.round(lastState.B / 360);

        for (let i = 0; i < stepDownPaths.length; i++) {
            for (let j = 0; j < stepDownPaths[i].length; j++) {
                const p = stepDownPaths[i][j];

                lastState = this.toolPath.getState();

                let b = p.b + circle * 360;

                while (Math.abs(lastState.B - b) > 180) {
                    b = lastState.B > b ? b + 360 : b - 360;
                }
                circle = Math.round(b / 360);

                const { x, y } = p;
                const gX = round(x, 3);
                const gZ = round(y, 3);

                if (i === 0 && j === 0) {
                    this.toolPath.move0Z(this.initialZ, jogSpeed);
                    this.toolPath.move0B(b, jogSpeed);


                    this.toolPath.move0XY(gX, gY, jogSpeed);
                    this.toolPath.move1Z(gZ, plungeSpeed);
                } else if (j === 0) {
                    this.toolPath.move0B(b, jogSpeed);

                    this.toolPath.move0XY(gX, gY, jogSpeed);
                    this.toolPath.move1Z(gZ, plungeSpeed);
                } else {
                    if (p.g === 0) {
                        this.toolPath.move0XZB(gX, gZ, b, jogSpeed);
                    } else {
                        this.toolPath.move1XZB(gX, gZ, b, workSpeed);
                    }
                }
            }
        }
    }

    _interpolatePoints(slicerLayers, index, lastPoint, point, diffPolygons, lineSet) {
        const gcodePoints = [];
        const angle = Vector2.anglePoint(lastPoint, point);
        const lastPointRotate = {
            ...Vector2.rotate(lastPoint, -angle),
            b: lastPoint.b
        };

        const pointRotate = {
            ...Vector2.rotate(point, -angle),
            b: point.b
        };

        let segCount = Math.ceil(Math.abs(lastPointRotate.x - pointRotate.x) * this.density);
        segCount = Math.max(segCount, Math.ceil(Math.abs(lastPointRotate.b - pointRotate.b)));

        if (segCount <= 1) {
            gcodePoints.push(lastPoint);
            gcodePoints.push(point);
            return gcodePoints;
        }

        const isDiffPolygonsPoints = lineSet.has(this._lineToHash(lastPoint, point));

        let interpolatePoints = null;
        if (isDiffPolygonsPoints) {
            const hash = this._lineToHash(lastPoint, point);
            interpolatePoints = this._interpolateCurvePoints(slicerLayers, index, diffPolygons, lastPointRotate, pointRotate, hash, angle);
        } else {
            interpolatePoints = this._interpolateLinePoints(segCount, lastPointRotate, pointRotate);
        }

        if (!interpolatePoints) {
            return gcodePoints;
        }

        for (let i = 0; i < interpolatePoints.size(); i++) {
            const p = interpolatePoints.get(i);
            const { x, y } = Vector2.rotate(p, angle);
            gcodePoints.push({
                x: x,
                y: y,
                b: p.b
            });
        }

        return gcodePoints;
    }

    _interpolateLinePoints(segCount, lastPointRotate, pointRotate) {
        const interpolatePoints = new Polygon();

        interpolatePoints.add({
            ...lastPointRotate
        });

        for (let j = 1; j < segCount; j++) {
            interpolatePoints.add({
                x: lastPointRotate.x + (pointRotate.x - lastPointRotate.x) / segCount * j,
                y: lastPointRotate.y + (pointRotate.y - lastPointRotate.y) / segCount * j,
                b: lastPointRotate.b + (pointRotate.b - lastPointRotate.b) / segCount * j
            });
        }

        interpolatePoints.add({
            ...pointRotate
        });

        return interpolatePoints;
    }

    _interpolateCurvePoints(slicerLayers, index, diffPolygons, lastPointRotate, pointRotate, hash, angle) {
        const segCount = Math.ceil(Math.abs(lastPointRotate.x - pointRotate.x) * 10);

        const interpolatePointsTmp = new Polygon();
        for (let j = 1; j < segCount; j++) {
            interpolatePointsTmp.add({
                x: lastPointRotate.x + (pointRotate.x - lastPointRotate.x) / segCount * j,
                y: null,
                b: lastPointRotate.b + (pointRotate.b - lastPointRotate.b) / segCount * j,
                minY: lastPointRotate.y + (pointRotate.y - lastPointRotate.y) / segCount * j
            });
        }

        diffPolygons.forEach(polygon => {
            polygon.forEachLine((p1, p2) => {
                if (this._lineToHash(p1, p2) === hash) {
                    return;
                }
                p1 = Vector2.rotate(p1, -angle);
                p2 = Vector2.rotate(p2, -angle);
                for (let i = 0; i < interpolatePointsTmp.size(); i++) {
                    const p = interpolatePointsTmp.get(i);
                    if ((p1.x <= p.x && p2.x >= p.x) || (p1.x >= p.x && p2.x <= p.x)) {
                        const y = this._calculateInterpolateY(p, p1, p2);
                        p.y = p.y === null ? y : Math.min(p.y, y);
                    }
                }
            });
        });

        const removeIndex = [];
        if (interpolatePointsTmp.size() >= 2) {
            let pre = lastPointRotate;
            let i = 0;
            let cur = interpolatePointsTmp.get(i);
            let next = interpolatePointsTmp.get(i + 1);
            while (i < interpolatePointsTmp.size()) {
                if (Vector2.pointInCommonLine(pre, cur, next) && Math.abs(next.x - pre.x) < 1 / this.density) {
                    removeIndex[i] = 1;
                } else {
                    pre = cur;
                }
                cur = next;
                i++;
                next = i === interpolatePointsTmp.size() - 1 ? pointRotate : interpolatePointsTmp.get(i + 1);
            }
        }

        const interpolateLinePoints = new Polygon();

        interpolateLinePoints.add({
            ...lastPointRotate
        });

        for (let i = 0; i < interpolatePointsTmp.size(); i++) {
            if (!removeIndex[i]) {
                const p = interpolatePointsTmp.get(i);
                interpolateLinePoints.add(p);
            }
        }

        interpolateLinePoints.add({
            ...pointRotate
        });

        // B interpolate
        const interpolatePoints = new Polygon();
        interpolatePoints.add(interpolateLinePoints.get(0));

        for (let i = 1; i < interpolateLinePoints.size(); i++) {
            const lastP = interpolateLinePoints.get(i - 1);
            const p = interpolateLinePoints.get(i);

            const bCount = Math.max(1, Math.ceil(Math.abs(lastP.b - p.b)));

            if (bCount > 1) {
                for (let j = 1; j < bCount; j++) {
                    interpolatePoints.add({
                        x: lastP.x + (p.x - lastP.x) / bCount * j,
                        y: lastP.y + (p.y - lastP.y) / bCount * j,
                        b: lastP.b + (p.b - lastP.b) / bCount * j
                    });
                }
            }

            interpolatePoints.add(p);
        }

        if (this.toolAngle < 60) {
            this._calculateCurveYCollisionArea(slicerLayers, index, interpolatePoints, angle);
            this._calculateXCollisionArea(interpolatePoints, angle);
        }

        return this._generateGocdePointsByStepDownFromCurvePoints(interpolatePoints);
    }

    _generateGocdePointsByStepDownFromCurvePoints(interpolatePoints) {
        if (this.stepDown < 0.05 || this.stepDown >= this.diameter) {
            return interpolatePoints;
        }
        const interpolatePointsStepDown = new Polygon();
        let update = true;
        let sort = false;
        let cutY = interpolatePoints.get(0).y;
        while (update || !sort) {
            update = false;
            sort = !sort;
            for (let i = sort ? 0 : interpolatePoints.size() - 1; sort ? i < interpolatePoints.size() : i >= 0; sort ? i++ : i--) {
                const p = interpolatePoints.get(i);
                if (cutY + this.stepDown > p.y) {
                    interpolatePointsStepDown.add({ x: p.x, y: p.y, b: p.b });
                } else {
                    interpolatePointsStepDown.add({ x: p.x, y: cutY + this.stepDown, b: p.b });
                    update = true;
                }
            }

            cutY += this.stepDown;
        }
        return interpolatePointsStepDown;
    }

    _normalAngle(a) {
        a %= 360;
        a = a > 180 ? a - 360 : a;
        a = a < -180 ? a + 360 : a;
        return a;
    }


    _calculateXCollisionArea(smoothPolygon, angle) {
        let update = true;
        while (update) {
            update = false;
            const len = smoothPolygon.size();
            for (let i = 1; i < len - 1; i++) {
                const preX = smoothPolygon.get(i - 1).x;
                const preY = smoothPolygon.get(i - 1).y;
                const curX = smoothPolygon.get(i).x;
                const b = smoothPolygon.get(i).b;
                const normal = 180 - angle;
                const cutAngle = this._normalAngle(b - normal + this.toolAngle / 2);
                if (cutAngle > 0) {
                    const tan = Math.tan(cutAngle / 180 * Math.PI);
                    const smoothY = preY + (Math.abs(curX - preX)) / tan;
                    if (smoothPolygon.get(i).y > smoothY) {
                        smoothPolygon.get(i).y = smoothY;
                        update = true;
                    }
                }
            }

            for (let i = len - 2; i >= 1; i--) {
                const preX = smoothPolygon.get(i + 1).x;
                const preY = smoothPolygon.get(i + 1).y;
                const curX = smoothPolygon.get(i).x;
                const b = smoothPolygon.get(i).b;
                const normal = 180 - angle;
                const cutAngle = this._normalAngle(normal - b + this.toolAngle / 2);
                if (cutAngle > 0) {
                    const tan = Math.tan(cutAngle / 180 * Math.PI);
                    const smoothY = preY + (Math.abs(curX - preX)) / tan;
                    if (smoothPolygon.get(i).y > smoothY) {
                        smoothPolygon.get(i).y = smoothY;
                        update = true;
                    }
                }
            }
        }
    }

    _calculateCurveYCollisionArea(slicerLayers, index, interpolatePoints, angle) {
        const tan = Math.tan(this.toolAngle / 2 / 180 * Math.PI);
        // const toolOffset = this.toolDiameter / 2 / tan;
        const toolOffset = 0;

        const calculateCurveYCollisionArea = (tmpIndex, sort) => {
            while (tmpIndex >= 0 && tmpIndex < slicerLayers.length) {
                const zOffset = Math.abs(slicerLayers[index].z - slicerLayers[tmpIndex].z);
                if (zOffset >= this.toolShaftDiameter / 2) {
                    break;
                }
                const offset = Math.max(zOffset / tan - toolOffset, 0);

                const polygonsPart = slicerLayers[tmpIndex].polygonsPart;

                polygonsPart.forEach(polygon => {
                    polygon.forEachLine((p1, p2) => {
                        p1 = Vector2.rotate(p1, -angle);
                        p2 = Vector2.rotate(p2, -angle);
                        for (let i = 0; i < interpolatePoints.size(); i++) {
                            const p = interpolatePoints.get(i);
                            if ((p1.x <= p.x && p2.x >= p.x) || (p1.x >= p.x && p2.x <= p.x)) {
                                const y = this._calculateInterpolateY(p, p1, p2) + offset;
                                if (y > p.minY) {
                                    p.y = p.y === null ? y : Math.min(p.y, y);
                                }
                            }
                        }
                    });
                });

                if (sort) {
                    tmpIndex++;
                } else {
                    tmpIndex--;
                }
            }
        };

        calculateCurveYCollisionArea(index + 1, true);
        calculateCurveYCollisionArea(index - 1, false);
    }

    _calculateYCollisionArea(slicerLayers, index, interpolatePoints, angle, lastPoint, point) {
        const tan = Math.tan(this.toolAngle / 2 / 180 * Math.PI);
        const toolOffset = this.toolDiameter / 2 / tan;

        const calculateYConvexCollisionArea = (tmpIndex, sort) => {
            while (tmpIndex >= 0 && tmpIndex < slicerLayers.length) {
                const zOffset = Math.abs(slicerLayers[index].z - slicerLayers[tmpIndex].z);
                if (zOffset >= this.toolShaftDiameter / 2) {
                    break;
                }
                const offset = Math.max(zOffset / tan - toolOffset, 0);

                const polygonsPart = slicerLayers[tmpIndex].polygonsPart;

                polygonsPart.forEach(polygon => {
                    const isPointInPolygon = polygon.isPointInPolygon(lastPoint) || polygon.isPointInPolygon(point);
                    if (!isPointInPolygon) {
                        return;
                    }
                    polygon.forEachLine((p1, p2) => {
                        p1 = Vector2.rotate(p1, -angle);
                        p2 = Vector2.rotate(p2, -angle);
                        for (let i = 0; i < interpolatePoints.size(); i++) {
                            const p = interpolatePoints.get(i);
                            if ((p1.x <= p.x && p2.x >= p.x) || (p1.x >= p.x && p2.x <= p.x)) {
                                const y = this._calculateInterpolateY(p, p1, p2);
                                p.y = p.y === null ? y + offset : Math.min(p.y, y + offset);
                            }
                        }
                    });
                });

                if (sort) {
                    tmpIndex++;
                } else {
                    tmpIndex--;
                }
            }
        };

        calculateYConvexCollisionArea(index + 1, true);
        calculateYConvexCollisionArea(index - 1, false);
    }

    _calculateInterpolateY(p, p1, p2) {
        if (p2.x - p1.x === 0) {
            return Math.min(p2.y, p1.y);
        }
        return (p.x - p1.x) / (p2.x - p1.x) * (p2.y - p1.y) + p1.y;
    }

    _generateGocdePointsByStepDown(convexHullPath) {
        const stepDownPaths = [];

        if (this.stepDown < 0.05 || this.stepDown >= this.diameter) {
            return stepDownPaths;
        }

        let path = [];
        for (let i = 0; i < convexHullPath.length; i++) {
            const point = convexHullPath[i];

            if (i > 0) {
                const lastPoint = convexHullPath[i - 1];
                const segCount = Math.max(1, Math.ceil(Math.abs(convexHullPath[i].b - convexHullPath[i - 1].b)));
                for (let j = 1; j <= segCount; j++) {
                    const nX = lastPoint.x + (point.x - lastPoint.x) / segCount * j;
                    const nY = lastPoint.y + (point.y - lastPoint.y) / segCount * j;
                    const nb = lastPoint.b + (point.b - lastPoint.b) / segCount * j;

                    const { x, y } = Vector2.rotate({
                        x: nX,
                        y: nY
                    }, nb);

                    path.push({ x, y, b: nb });
                }
            } else {
                const { x, y } = Vector2.rotate(point, point.b);
                path.push({ x, y, b: point.b });
            }
        }

        const radiusSquare = this.diameter / 2 * this.diameter / 2;
        const initialZSquare = this.initialZ * this.initialZ;

        let update = true;
        while (update) {
            update = false;
            const pathTmp = [];
            for (let i = 0; i < path.length; i++) {
                const point = path[i];
                const nY = point.y + this.stepDown;
                const maxY = Math.sqrt(radiusSquare - point.x * point.x) || 0;

                const initZY = Math.sqrt(initialZSquare - point.x * point.x) || 0;
                if (nY > maxY) {
                    pathTmp.push({
                        g: 0,
                        x: point.x,
                        y: initZY,
                        b: point.b
                    });
                } else {
                    pathTmp.push({
                        x: point.x,
                        y: nY,
                        b: point.b
                    });
                    update = true;
                }
            }
            if (update) {
                stepDownPaths.push(pathTmp);
                path = pathTmp;
            }
        }

        stepDownPaths.reverse();

        return stepDownPaths;
    }

    emitProgress(progress) {
        this.progress = progress;
        this.emit('progress', progress);
    }

    async generateToolPathObj() {
        this.emitProgress(0);

        const { headType, mode } = this.modelInfo;

        const meshProcess = new MeshProcess(this.modelInfo);

        this.emitProgress(0.1);

        const mesh = meshProcess.mesh;

        mesh.addCoordinateSystem({ y: '-y' });

        const { width, height } = meshProcess.getWidthAndHeight();
        if (this.transformation.width && this.transformation.height) {
            meshProcess.mesh.resize({
                x: this.transformation.width / width,
                y: this.transformation.width / width,
                z: this.transformation.height / height
            });
        }

        mesh.offset({
            x: -(mesh.aabb.max.x + mesh.aabb.min.x) / 2,
            y: -(mesh.aabb.max.y + mesh.aabb.min.y) / 2,
            z: -(mesh.aabb.max.z + mesh.aabb.min.z) / 2
        });

        const layerThickness = 1 / this.density;
        const initialLayerThickness = layerThickness / 2 + mesh.aabb.min.z;
        const sliceLayerCount = Math.floor((mesh.aabb.max.z - initialLayerThickness) / layerThickness) + 1;

        const slicer = new Slicer(mesh, layerThickness, sliceLayerCount, initialLayerThickness);

        this.emitProgress(0.2);

        const { jogSpeed = 300 } = this.gcodeConfig;

        this.toolPath.move0Z(this.initialZ, jogSpeed);

        this.toolPath.spindleOn({ P: 100 });

        const slicerLayers = slicer.slicerLayers;

        for (const slicerLayer of slicerLayers) {
            delete slicerLayer.polygons;
            delete slicerLayer.openPolygons;
        }

        if (this.allowance) {
            await this.modelInfo.taskAsyncFor(0, slicerLayers.length - 1, 1, (i) => {
                const slicerLayer = slicerLayers[i];
                const polygonsPart = slicerLayer.polygonsPart.offset(this.allowance);
                slicerLayer.polygonsPart = polygonsPart.splitIntoParts();
            });
        }

        if (this.toolAngle < 60 && this.smoothY) {
            await this.modelInfo.taskAsyncFor(1, slicerLayers.length - 1, 1, (i) => {
                const slicerLayer = slicerLayers[i];
                const tan = Math.tan(this.toolAngle / 2 / 180 * Math.PI);
                const offset = Math.abs(slicerLayer.z - slicerLayers[i - 1].z) / tan;
                const offsetPolygons = slicerLayers[i - 1].polygonsPart.offset(-offset);
                offsetPolygons.addPolygons(slicerLayer.polygonsPart);
                slicerLayer.polygonsPart = offsetPolygons.splitIntoParts();

                this.emitProgress(0.2 + (i / (slicerLayer.length - 1)) * 0.2);
            });

            await this.modelInfo.taskAsyncFor(slicerLayers.length - 2, 0, -1, (i) => {
                const slicerLayer = slicerLayers[i];
                const tan = Math.tan(this.toolAngle / 2 / 180 * Math.PI);
                const offset = Math.abs(slicerLayer.z - slicerLayers[i + 1].z) / tan;
                const offsetPolygons = slicerLayers[i + 1].polygonsPart.offset(-offset);
                offsetPolygons.addPolygons(slicerLayer.polygonsPart);
                slicerLayer.polygonsPart = offsetPolygons.splitIntoParts();
                this.emitProgress(0.4 + 0.2 * (slicerLayers.length - 2 - i) / (slicerLayers.length - 2));
            });
        }

        const p = this.progress;

        await this.modelInfo.taskAsyncFor(0, slicerLayers.length - 1, 1, (i) => {
            const isFirst = i === 0;

            this._generateSlicerLayerToolPath(slicerLayers, i, {
                ...this.gcodeConfig,
                workSpeed: isFirst ? this.gcodeConfig.workSpeed / 2 : this.gcodeConfig.workSpeed,
                plungeSpeed: isFirst ? this.gcodeConfig.plungeSpeed / 2 : this.gcodeConfig.plungeSpeed
            });
            this.emitProgress((1 - p) * (i / slicerLayers.length) + p);
        });

        this.toolPath.spindleOff();
        this.toolPath.resetB();

        const boundingBox = this.toolPath.boundingBox;

        return {
            headType: headType,
            mode: mode,
            movementMode: '',
            data: this.toolPath.commands,
            estimatedTime: this.toolPath.estimatedTime * 1.6,
            positionX: this.isRotate ? 0 : this.transformation.positionX,
            positionY: this.transformation.positionY,
            positionZ: this.transformation.positionZ,
            rotationB: this.isRotate ? this.toolPath.toB(this.transformation.positionX) : 0,
            boundingBox: boundingBox,
            isRotate: this.isRotate,
            diameter: this.diameter
        };
        // for (let i = 0; i < slicerLayers.length; i++) {
        //     this._generateSlicerLayerToolPath(slicerLayers, i);
        //     this.emitProgress((1 - p) * (i / slicerLayers.length) + p);
        // }
    }
}
