import EventEmitter from 'events';
import { Vector2 } from '../../../../shared/lib/math/Vector2';
import { CutAngle } from '../../MeshProcess/CutAngles';
import { round } from '../../../../shared/lib/utils';
import { MeshProcess } from '../../MeshProcess/MeshProcess';
import { Slicer } from '../../MeshProcess/Slicer';
import ToolPath from '../../ToolPath';
import { Polygon } from '../../MeshProcess/Polygons';

export default class CncMeshLinkageToolPathGenerator extends EventEmitter {
    constructor(modelInfo) {
        super();
        const { uploadName, gcodeConfig = {}, transformation = {}, materials = {}, toolParams = {} } = modelInfo;

        const { density = 5, smoothY = true } = gcodeConfig;
        const { isRotate, diameter } = materials;
        const { toolDiameter = 0, toolAngle = 0, toolShaftDiameter = 0 } = toolParams;

        this.modelInfo = modelInfo;
        this.uploadName = uploadName;
        this.transformation = transformation;
        this.gcodeConfig = gcodeConfig;

        this.density = density;

        this.isRotate = isRotate;
        this.diameter = diameter;

        this.initialZ = diameter / 2;
        this.toolPath = new ToolPath({ isRotate, diameter: diameter });

        this.toolDiameter = toolDiameter;
        this.toolAngle = toolAngle;
        this.toolShaftDiameter = toolShaftDiameter;

        this.smoothY = smoothY;
    }

    _generateHullPolygonCutPath(convexHullPolygon) {
        let preIndex = 0;
        let nextIndex = 0;

        const getIndex = (index, len) => {
            return (index + len) % len;
        };

        const cutPath = [];

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
            cutPath.push({
                x: p.x,
                y: p.y,
                cutAngle: cutAngle,
                normal: cutAngle.getNormal()
            });
        }

        return cutPath;
    }

    _lineToHash(p1, p2) {
        return p1.x * 1000000000 + p1.y * 1000000 + p2.x * 1000 + p2.y;
    }

    _generateSlicerLayerToolPath(slicerLayers, index) {
        const { jogSpeed = 300, workSpeed = 300, plungeSpeed = 300 } = this.gcodeConfig;
        const slicerLayer = slicerLayers[index];

        const polygonsPart = slicerLayer.polygonsPart;
        const convexHullPolygons = polygonsPart.convexHull();

        const gY = slicerLayer.z;

        const diffPolygons = convexHullPolygons.diff(polygonsPart);
        const lineSet = new Set();
        diffPolygons.forEach(diffPolygon => {
            diffPolygon.forEachLine((p1, p2) => {
                lineSet.add(this._lineToHash(p1, p2));
            });
        });

        const path = this._generateHullPolygonCutPath(convexHullPolygons.get(0));

        let lastPoint = null;

        for (let i = 0; i < path.length; i++) {
            const point = path[i];

            const lastState = this.toolPath.getState();

            let b = 90 - point.normal;

            while (Math.abs(lastState.B - b) > 180) {
                b = lastState.B > b ? b + 360 : b - 360;
            }

            point.b = b;

            if (i === 0) {
                this.toolPath.move0Z(this.initialZ, jogSpeed);
                this.toolPath.move0B(b, jogSpeed);

                lastPoint = point;

                continue;
            }

            const gcodePoints = this._interpolatePoints(slicerLayers, index, lastPoint, point, diffPolygons, lineSet);

            if (i === 1) {
                const { x, y } = Vector2.rotate(gcodePoints[0], gcodePoints[0].b);

                const gX = round(x, 3);
                const gZ = round(y, 3);
                this.toolPath.move0XY(gX, gY, jogSpeed);
                this.toolPath.move1Z(gZ, plungeSpeed);
            }

            for (let j = 1; j < gcodePoints.length; j++) {
                const gcodePoint = gcodePoints[j];
                const { x, y } = Vector2.rotate(gcodePoint, gcodePoint.b);
                const gX = round(x, 3);
                const gZ = round(y, 3);
                this.toolPath.move1XZB(gX, gZ, gcodePoint.b, workSpeed);
            }

            lastPoint = point;
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

        const segCount = Math.ceil(Math.abs(lastPointRotate.x - pointRotate.x) * this.density);

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

        for (let j = 1; j <= segCount; j++) {
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
        const segCount = Math.ceil(Math.abs(lastPointRotate.x - pointRotate.x) * 50);

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

        const interpolatePoints = new Polygon();

        interpolatePoints.add({
            ...lastPointRotate
        });

        for (let i = 0; i < interpolatePointsTmp.size(); i++) {
            if (!removeIndex[i]) {
                const p = interpolatePointsTmp.get(i);
                interpolatePoints.add(p);
            }
        }

        interpolatePoints.add({
            ...pointRotate
        });

        if (this.toolAngle < 60) {
            this._calculateCurveYCollisionArea(slicerLayers, index, interpolatePoints, angle);
            this._calculateXCollisionArea(interpolatePoints, angle);
        }


        return interpolatePoints;
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

    emitProgress(progress) {
        this.progress = progress;
        this.emit('progress', progress);
    }

    generateToolPathObj() {
        this.emitProgress(0);

        const { headType, mode } = this.modelInfo;

        const meshProcess = new MeshProcess(this.modelInfo);

        this.emitProgress(0.1);

        const mesh = meshProcess.mesh;

        mesh.addCoordinateSystem({ ySymbol: -1 });

        const { width, height } = meshProcess.getWidthAndHeight();
        meshProcess.mesh.resize({
            x: this.transformation.width / width,
            y: this.transformation.width / width,
            z: this.transformation.height / height
        });

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

        if (this.smoothY) {
            for (let i = 1; i < slicerLayers.length; i++) {
                const slicerLayer = slicerLayers[i];
                const tan = Math.tan(this.toolAngle / 2 / 180 * Math.PI);
                const offset = Math.abs(slicerLayer.z - slicerLayers[i - 1].z) / tan;
                const offsetPolygons = slicerLayers[i - 1].polygonsPart.padding(offset);
                offsetPolygons.addPolygons(slicerLayer.polygonsPart);
                slicerLayer.polygonsPart = offsetPolygons.splitIntoParts();
                this.emitProgress(0.2 * i / slicerLayers.length + 0.2);
            }

            for (let i = slicerLayers.length - 2; i >= 0; i--) {
                const slicerLayer = slicerLayers[i];
                const tan = Math.tan(this.toolAngle / 2 / 180 * Math.PI);
                const offset = Math.abs(slicerLayer.z - slicerLayers[i + 1].z) / tan;
                const offsetPolygons = slicerLayers[i + 1].polygonsPart.padding(offset);
                offsetPolygons.addPolygons(slicerLayer.polygonsPart);
                slicerLayer.polygonsPart = offsetPolygons.splitIntoParts();
                this.emitProgress(0.2 * (slicerLayers.length - i) / slicerLayers.length + 0.4);
            }
        }

        const p = this.progress;

        for (let i = 0; i < slicerLayers.length; i++) {
            this._generateSlicerLayerToolPath(slicerLayers, i);
            this.emitProgress((1 - p) * (i / slicerLayers.length) + p);
        }

        this.toolPath.spindleOff();

        const boundingBox = {
            max: {
                ...meshProcess.mesh.aabb.max
            },
            min: {
                ...meshProcess.mesh.aabb.min
            }
        };

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
    }
}
