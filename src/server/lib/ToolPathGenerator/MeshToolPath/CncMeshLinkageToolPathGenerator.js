import EventEmitter from 'events';
import { Vector2 } from '../../../../shared/lib/math/Vector2';
import { CutAngle } from '../../MeshProcess/CutAngles';
import { isEqual, round } from '../../../../shared/lib/utils';
import { MeshProcess } from '../../MeshProcess/MeshProcess';
import RotateToolPath from '../../ToolPath/RotateToolPath';
import { Slicer } from '../../MeshProcess/Slicer';

export default class CncMeshLinkageToolPathGenerator2 extends EventEmitter {
    constructor(modelInfo) {
        super();
        const { uploadName, gcodeConfig = {}, isRotate, diameter, transformation = {} } = modelInfo;

        const { density = 5, toolAngle = 20 } = gcodeConfig;

        this.modelInfo = modelInfo;
        this.uploadName = uploadName;
        this.transformation = transformation;
        this.gcodeConfig = gcodeConfig;

        this.density = density;

        this.isRotate = isRotate;
        this.diameter = diameter;

        this.initialZ = diameter / 2;
        this.toolPath = new RotateToolPath({ isRotate, radius: diameter / 2 });

        this.toolAngle = toolAngle;
    }

    _createToolPathPointCutAngle(p, polygon, start, end) {
        const cutAngle = new CutAngle();
        for (let i = start; i < end; i++) {
            const i1 = i % polygon.size();
            const i2 = (i + 1) % polygon.size();
            const p1 = polygon.path[i1];
            const p2 = polygon.path[i2];
            const a1 = Vector2.anglePoint(p, p1);
            const a2 = Vector2.anglePoint(p, p2);

            if (!isEqual(a1, a2) && !Vector2.isEqual(p, p1) && !Vector2.isEqual(p, p2)) {
                let startAngle, endAngle;
                if (Math.abs(a1 - a2) <= 180) {
                    startAngle = a1 <= a2 ? a1 : a2;
                    endAngle = a1 <= a2 ? a2 : a1;
                } else {
                    startAngle = a1 < a2 ? a2 : a1;
                    endAngle = a1 < a2 ? a1 : a2;
                }
                cutAngle.add(new CutAngle(startAngle, endAngle));
            }
        }
        return cutAngle;
    }

    _trySerachCutAngleIndex(cutAngle, cutAngles) {
        for (let i = 0; i < cutAngles.size(); i++) {
            if (cutAngle.isOverlap(cutAngles.get(i))) {
                return i;
            }
        }
        return -1;
    }

    _generateSlicerLayerCutPointPath(slicerLayer) {
        const polygonsPart = slicerLayer.polygonsPart;

        const polygons = polygonsPart.polygons;

        const convexHullPolygons = polygonsPart.convexHull();

        const diffPolygons = convexHullPolygons.diffPolygons(polygons);

        const path = convexHullPolygons.polygons[0].path;
        // eslint-disable-next-line no-unused-vars
        const resPaths = [];

        let preIndex = 0;
        let nextIndex = 0;

        const getIndex = (index, len) => {
            return (index + len) % len;
        };

        const resPath = [];

        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            preIndex = i - 1;
            while (Vector2.isEqual(path[getIndex(preIndex, path.length)], p)) {
                preIndex--;
            }
            nextIndex = i + 1;
            while (Vector2.isEqual(path[getIndex(nextIndex, path.length)], p)) {
                nextIndex++;
            }
            const pre = path[getIndex(preIndex, path.length)];
            const next = path[getIndex(nextIndex, path.length)];
            const an1 = Vector2.anglePoint(p, pre);
            const an2 = Vector2.anglePoint(p, next);
            const cutAngle = new CutAngle(an1, an2);
            resPath.push({
                x: p.x,
                y: p.y,
                cutAngle: cutAngle,
                normal: cutAngle.getNormal()
            });
        }

        resPaths.push(resPath);

        return {
            paths: resPaths,
            diffPolygons: diffPolygons,
            convexHullPolygons: convexHullPolygons
        };
    }

    _mergePath(paths) {
        let i = 0;
        while (i < paths.length) {
            let merge = false;
            for (let j = i + 1; j < paths.length; j++) {
                const p1 = paths[i];
                const p2 = paths[j];

                const p1Start = p1[0];
                const p1End = p1[p1.length - 1];
                const p2Start = p2[0];
                const p2End = p2[p2.length - 1];

                if (Vector2.isEqual(p2Start, p1End) && p2Start.cutAngle.isOverlap(p1End.cutAngle)) {
                    paths[i] = p1.concat(p2);
                    paths.splice(j, 1);
                    merge = true;
                    break;
                } else if (Vector2.isEqual(p1Start, p2End) && p1Start.cutAngle.isOverlap(p2End.cutAngle)) {
                    paths[i] = p2.concat(p1);
                    paths.splice(j, 1);
                    merge = true;
                    break;
                }
            }
            if (!merge) {
                i++;
            }
        }
    }

    _lineToHash(p1, p2) {
        return p1.x * 1000000000 + p1.y * 1000000 + p2.x * 1000 + p2.y;
    }

    _generateSlicerLayerToolPath(slicerLayer, data) {
        const { jogSpeed = 300, workSpeed = 300, plungeSpeed = 300 } = this.gcodeConfig;
        const { paths, diffPolygons } = data;

        const gY = slicerLayer.z;

        const lineSet = new Set();

        for (const diffPolygon of diffPolygons.polygons) {
            diffPolygon.forEachLine((p1, p2) => {
                lineSet.add(this._lineToHash(p1, p2));
            });
        }

        for (let k = 0; k < paths.length; k++) {
            const path = paths[k];

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
                    const { x, y } = Vector2.rotate(point, b);
                    const gX = round(x, 3);
                    const gZ = round(y, 3);
                    this.toolPath.move0Z(this.initialZ, jogSpeed);
                    this.toolPath.move0B(b, jogSpeed);
                    this.toolPath.move0XY(gX, gY, jogSpeed);
                    this.toolPath.move1Z(gZ, plungeSpeed);

                    lastPoint = point;
                    continue;
                }

                let gPs = null;

                if (lineSet.has(this._lineToHash(lastPoint, point))) {
                    gPs = this._interpolateDiffPolygons(diffPolygons, lastPoint, point);
                } else {
                    gPs = this._interpolatePoints(lastPoint, point);
                }

                // gPs = this._interpolatePoints(lastPoint, point);

                for (const gP of gPs) {
                    const { x, y } = Vector2.rotate(gP, gP.b);
                    const gX = round(x, 3);
                    const gZ = round(y, 3);
                    this.toolPath.move1XYZB(gX, gY, gZ, gP.b, workSpeed);
                }

                lastPoint = point;
            }
        }


        // this.toolPath.move0Z(this.initialZ, 300);
        // this.toolPath.move0Y(slicerLayer.z + 10, 300);
        // this.toolPath.move0B(0, 300);
        //
        // const polygonsPart = slicerLayer.polygonsPart;
        //
        // for (let j = 0; j < polygonsPart.polygons.length; j++) {
        //     const path = polygonsPart.polygons[j].path;
        //     for (let i = 0; i < path.length; i++) {
        //         const point = path[i];
        //
        //         if (i === 0) {
        //             this.toolPath.move0XZ(point.x, point.y, 300);
        //         } else {
        //             this.toolPath.move1XZ(point.x, point.y, 300);
        //         }
        //     }
        // }
        //
        // this.toolPath.move0Z(this.initialZ, 300);
        // this.toolPath.move0Y(slicerLayer.z + 20, 300);
        // this.toolPath.move0B(0, 300);
        //
        // const convexHullPolygons = data.convexHullPolygons;
        //
        // for (let j = 0; j < convexHullPolygons.polygons.length; j++) {
        //     const path = convexHullPolygons.polygons[j].path;
        //     for (let i = 0; i < path.length; i++) {
        //         const point = path[i];
        //
        //         if (i === 0) {
        //             this.toolPath.move0XZ(point.x, point.y, 300);
        //         } else {
        //             this.toolPath.move1XZ(point.x, point.y, 300);
        //         }
        //     }
        // }
        //
        // this.toolPath.move0Z(this.initialZ, 300);
        // this.toolPath.move0Y(slicerLayer.z + 30, 300);
        // this.toolPath.move0B(0, 300);
        //
        // for (let j = 0; j < diffPolygons.polygons.length; j++) {
        //     const path = diffPolygons.polygons[j].path;
        //     for (let i = 0; i < path.length; i++) {
        //         const point = path[i];
        //
        //         if (i === 0) {
        //             this.toolPath.move0XZ(point.x, point.y, 300);
        //         } else {
        //             this.toolPath.move1XZ(point.x, point.y, 300);
        //         }
        //     }
        // }
    }

    _interpolateDiffPolygons(diffPolygons, lastPoint, point) {
        const hash = this._lineToHash(lastPoint, point);
        const angle = Vector2.anglePoint(lastPoint, point);

        const lastPointAngle = Vector2.rotate(lastPoint, -angle);
        const pointAngle = Vector2.rotate(point, -angle);

        const xArray = [];
        const yArray = [];
        const bArray = [];

        const segCount = Math.ceil(Math.abs(lastPointAngle.x - pointAngle.x) * this.density);

        for (let j = 1; j < segCount; j++) {
            xArray.push(lastPointAngle.x + (pointAngle.x - lastPointAngle.x) / segCount * j);
            bArray.push(lastPoint.b + (point.b - lastPoint.b) / segCount * j);
        }

        for (const diffPolygon of diffPolygons.polygons) {
            diffPolygon.forEachLine((p1, p2) => {
                if (this._lineToHash(p1, p2) === hash) {
                    return;
                }
                const p1Angle = Vector2.rotate(p1, -angle);
                const p2Angle = Vector2.rotate(p2, -angle);
                for (let i = 0; i < xArray.length; i++) {
                    const x = xArray[i];
                    if ((p1Angle.x <= x && p2Angle.x >= x) || (p1Angle.x >= x && p2Angle.x <= x)) {
                        const y = (x - p1Angle.x) / (p2Angle.x - p1Angle.x) * (p2Angle.y - p1Angle.y) + p1Angle.y;
                        yArray[i] = yArray[i] === undefined ? y : Math.min(yArray[i], y);
                    }
                }
            });
        }

        // Smooth
        const normalAngle = (a) => {
            a %= 360;
            a = a > 180 ? a - 360 : a;
            a = a < -180 ? a + 360 : a;
            return a;
        };
        let update = true;
        while (update) {
            update = false;
            const len = xArray.length;
            for (let i = 0; i < len; i++) {
                const preX = i === 0 ? lastPointAngle.x : xArray[i - 1];
                const preY = i === 0 ? lastPointAngle.y : yArray[i - 1];
                const curX = xArray[i];
                const b = bArray[i];
                const normal = 180 - angle;
                const cutAngle = normalAngle(b - normal + this.toolAngle / 2);
                if (cutAngle > 0 && cutAngle < 60) {
                    const smoothY = preY + (Math.abs(curX - preX)) / Math.tan(cutAngle / 180 * Math.PI);
                    if (yArray[i] > smoothY) {
                        yArray[i] = smoothY;
                        update = true;
                    }
                }
            }

            for (let i = len - 1; i >= 0; i--) {
                const preX = i === len - 1 ? pointAngle.x : xArray[i + 1];
                const preY = i === len - 1 ? pointAngle.y : yArray[i + 1];
                const curX = xArray[i];
                const b = bArray[i];
                const normal = 180 - angle;
                const cutAngle = normalAngle(normal - b + this.toolAngle / 2);
                if (cutAngle > 0 && cutAngle < 60) {
                    const smoothY = preY + (Math.abs(curX - preX)) / Math.tan(cutAngle / 180 * Math.PI);
                    if (yArray[i] > smoothY) {
                        yArray[i] = smoothY;
                        update = true;
                    }
                }
            }
        }

        const gPs = [];
        for (let i = 0; i < xArray.length; i++) {
            const { x, y } = Vector2.rotate({ x: xArray[i], y: yArray[i] }, angle);
            gPs.push({
                x: x,
                y: y,
                b: bArray[i]
            });
        }
        gPs.push(point);

        return gPs;
    }

    _interpolatePoints(lastPoint, point) {
        const gPs = [];

        const segCount = Math.max(Math.ceil(Math.abs(lastPoint.b - point.b) / 0.5), 1);

        for (let j = 1; j <= segCount; j++) {
            gPs.push({
                x: lastPoint.x + (point.x - lastPoint.x) / segCount * j,
                y: lastPoint.y + (point.y - lastPoint.y) / segCount * j,
                b: lastPoint.b + (point.b - lastPoint.b) / segCount * j
            });
        }

        return gPs;
    }

    // eslint-disable-next-line no-unused-vars
    _OptimizationPaths(paths) {

    }

    generateToolPathObj() {
        const { headType, mode } = this.modelInfo;

        const meshProcess = new MeshProcess(this.modelInfo);

        const mesh = meshProcess.mesh;

        mesh.offset({
            x: -(mesh.aabb.max.x + mesh.aabb.min.x) / 2,
            y: -(mesh.aabb.max.y + mesh.aabb.min.y) / 2,
            z: -mesh.aabb.min.z
        });

        const layerThickness = 1 / this.density;
        const initialLayerThickness = layerThickness / 2;
        const sliceLayerCount = Math.floor((mesh.aabb.length.z - initialLayerThickness) / layerThickness) + 1;

        const slicer = new Slicer(mesh, layerThickness, sliceLayerCount, initialLayerThickness);

        // eslint-disable-next-line no-unused-vars
        const { jogSpeed = 300, workSpeed = 300 } = this.gcodeConfig;

        this.toolPath.move0Z(this.initialZ, jogSpeed);

        this.toolPath.spindleOn({ P: 100 });

        const p = null;

        for (const slicerLayer of slicer.slicerLayers) {
            // if (slicerLayer.z < 27.8 || slicerLayer.z > 28.0) {
            //     continue;
            // }
            const paths = this._generateSlicerLayerCutPointPath(slicerLayer);
            this._generateSlicerLayerToolPath(slicerLayer, paths);
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
            diameter: this.diameter,
            paths: p
        };
    }
}
