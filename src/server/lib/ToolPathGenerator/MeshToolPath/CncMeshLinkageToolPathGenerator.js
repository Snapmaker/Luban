import EventEmitter from 'events';
import { Vector2 } from '../../../../shared/lib/math/Vector2';
import { Polygon, Polygons } from '../../MeshProcess/Polygons';
import { CutAngle, CutAngles } from '../../MeshProcess/CutAngles';
import { isEqual, round } from '../../../../shared/lib/utils';
import { MeshProcess } from '../../MeshProcess/MeshProcess';
import RotateToolPath from '../../ToolPath/RotateToolPath';

export default class CncMeshLinkageToolPathGenerator extends EventEmitter {
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

    _interpolatePoints(p1, p2, interval) {
        const v = Vector2.sub(p2, p1);
        const d = Vector2.length(v);
        const nV = Vector2.divScale(v, d);
        const n = Math.floor(d / interval) - 1;

        const points = [];

        for (let i = 1; i <= n; i++) {
            const p = Vector2.add(p1, Vector2.mulScale(nV, i * interval));
            points.push(p);
        }

        return points;
    }

    _interpolatePolygons(polygons) {
        const nPolygons = new Polygons();
        for (const polygon of polygons.polygons) {
            const nPolygon = new Polygon();
            for (let i = 0; i < polygon.path.length - 1; i++) {
                const p1 = polygon.path[i];
                const p2 = polygon.path[i + 1];

                const points = this._interpolatePoints(p1, p2, 1 / this.density);

                nPolygon.add(p1);

                for (const point of points) {
                    nPolygon.add(point);
                }

                if (i === polygon.path.length - 2) {
                    nPolygon.add(p2);
                }
            }

            nPolygons.add(nPolygon);
        }

        return nPolygons;
    }

    _createToolPathPointCutAngle(p, polygon, start, end) {
        const cutAngle = new CutAngle();
        for (let i = start; i < end; i++) {
            const i1 = i % polygon.size();
            const i2 = (i + 1) % polygon.size();
            const p1 = polygon.path[i1];
            const p2 = polygon.path[i2];
            const a1 = Vector2.angle(Vector2.sub(p1, p));
            const a2 = Vector2.angle(Vector2.sub(p2, p));

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
        const nPolygonsPart = this._interpolatePolygons(slicerLayer.polygonsPart);

        const paths = [];

        let zero = 0;
        let noZero = 0;

        for (const polygon of nPolygonsPart.polygons) {
            let path = [];
            let lastPoint = null;
            let lastCutAngles = null;
            let lastCutAngleIndex = -1;

            for (let i = 0; i < polygon.size(); i++) {
                const cutAngles = new CutAngles();
                const point = polygon.path[i];
                for (const polygon2 of nPolygonsPart.polygons) {
                    if (polygon === polygon2) {
                        const cutAngle = this._createToolPathPointCutAngle(point, polygon2, i + 1, i + polygon2.size() - 1);
                        cutAngles.add(cutAngle);
                    } else {
                        const cutAngle = this._createToolPathPointCutAngle(point, polygon2, 0, polygon2.size() - 1);
                        cutAngles.add(cutAngle);
                    }
                }

                cutAngles.not();

                cutAngles.removeLessThanAngle(this.toolAngle);
                cutAngles.offset({ left: this.toolAngle / 2, right: this.toolAngle / 2 });

                if (cutAngles.size() === 0) {
                    zero++;
                    continue;
                }

                noZero++;

                if (path.length === 0) {
                    if (lastPoint === null) {
                        lastPoint = point;
                        lastCutAngles = cutAngles;
                        lastCutAngleIndex = 0;
                    } else {
                        for (let j = 0; j < lastCutAngles.size(); j++) {
                            const index = this._trySerachCutAngleIndex(lastCutAngles.get(j), cutAngles);
                            if (index !== -1) {
                                path.push({ x: lastPoint.x, y: lastPoint.y, normal: lastCutAngles.get(j).getNormal(), cutAngle: lastCutAngles.get(j) });
                                path.push({ x: point.x, y: point.y, normal: cutAngles.get(index).getNormal(), cutAngle: cutAngles.get(index) });
                                lastPoint = point;
                                lastCutAngles = cutAngles;
                                lastCutAngleIndex = index;
                                break;
                            }
                        }

                        if (path.length === 0) {
                            // path.push({ x: lastPoint.x, y: lastPoint.y, normal: lastCutAngles.get(lastCutAngleIndex).getNormal(), cutAngle: lastCutAngles.get(lastCutAngleIndex) });
                            // paths.push(path);
                            path = [];
                            lastPoint = point;
                            lastCutAngles = cutAngles;
                            lastCutAngleIndex = 0;
                        }
                    }
                } else {
                    const index = this._trySerachCutAngleIndex(lastCutAngles.get(lastCutAngleIndex), cutAngles);
                    if (index !== -1) {
                        path.push({ x: point.x, y: point.y, normal: cutAngles.get(index).getNormal(), cutAngle: cutAngles.get(index) });
                        lastPoint = point;
                        lastCutAngles = cutAngles;
                        lastCutAngleIndex = index;
                    } else {
                        paths.push(path);
                        path = [];
                        i--;
                    }
                }
            }

            if (path.length !== 0) {
                paths.push(path);
            }
        }

        this._mergePath(paths);

        console.log('zero', zero, noZero, slicerLayer.z);

        return paths;
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

    _generateSlicerLayerToolPath(slicerLayer, paths) {
        const { jogSpeed = 300, workSpeed = 300, plungeSpeed = 300 } = this.gcodeConfig;

        const gY = slicerLayer.z;

        while (paths.length > 0) {
            let useIndex = 0;
            let lastState = this.toolPath.getState();
            for (let i = 1; i < paths.length; i++) {
                const gB1 = 90 - paths[i][0].normal;
                const gB2 = 90 - paths[useIndex][0].normal;
                if (Math.abs(gB1 - lastState.B) < Math.abs(gB2 - lastState.B)) {
                    useIndex = i;
                }
            }

            const path = paths.splice(useIndex, 1)[0];

            this.toolPath.move0Z(this.initialZ, jogSpeed);

            for (let i = 0; i < path.length; i++) {
                const p = path[i];

                lastState = this.toolPath.getState();
                let endB = 90 - p.normal;

                while (Math.abs(lastState.B - endB) > 180) {
                    endB = lastState.B > endB ? endB + 360 : endB - 360;
                }

                const gBs = [];

                if (lastState.B < endB) {
                    for (let j = lastState.B + 0.5; j < endB; j += 0.5) {
                        gBs.push(j);
                    }
                } else {
                    for (let j = lastState.B - 0.5; j > endB; j -= 0.5) {
                        gBs.push(j);
                    }
                }
                gBs.push(endB);

                if (i === 0) {
                    const { x, y } = Vector2.rotate(p, endB);
                    const gX = round(x, 2);
                    const gZ = round(y, 2);
                    this.toolPath.move0B(endB, workSpeed);
                    this.toolPath.move0XY(gX, gY, workSpeed);
                    this.toolPath.move1Z(gZ, plungeSpeed);
                } else {
                    for (const gB of gBs) {
                        const { x, y } = Vector2.rotate(p, gB);
                        const gX = round(x, 2);
                        const gZ = round(y, 2);
                        this.toolPath.move1XYZB(gX, gY, gZ, gB, workSpeed);
                    }
                }
            }
        }

        // for (const path of paths) {
        //
        // }
    }

    // eslint-disable-next-line no-unused-vars
    _OptimizationPaths(paths) {

    }

    generateToolPathObj() {
        const { headType, mode } = this.modelInfo;

        const meshProcess = new MeshProcess(this.modelInfo);

        meshProcess.slice();

        const slicer = meshProcess.slicer;

        // eslint-disable-next-line no-unused-vars
        const { jogSpeed = 300, workSpeed = 300 } = this.gcodeConfig;

        this.toolPath.move0Z(this.initialZ, jogSpeed);

        this.toolPath.spindleOn({ P: 100 });

        const p = null;

        for (const slicerLayer of slicer.slicerLayers) {
            // if (slicerLayer.z < 43.8 || slicerLayer.z > 44.0) {
            //     continue;
            // }
            const paths = this._generateSlicerLayerCutPointPath(slicerLayer);
            this._generateSlicerLayerToolPath(slicerLayer, paths);

            // this.toolPath.move0Y(slicerLayer.z + 50, 300);
            // this.toolPath.move0B(0, 300);

            // for (const polygon of slicerLayer.polygonsPart.polygons) {
            //     for (let i = 0; i < polygon.size(); i++) {
            //         const point = polygon.path[i];
            //         if (i === 0) {
            //             this.toolPath.move0XZ(point.x, point.y, 300);
            //         } else {
            //             this.toolPath.move1XZ(point.x, point.y, 300);
            //         }
            //     }
            // }
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
