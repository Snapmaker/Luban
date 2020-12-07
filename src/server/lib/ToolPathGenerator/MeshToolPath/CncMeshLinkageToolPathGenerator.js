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

        const { density = 5 } = gcodeConfig;
        const { isRotate, diameter } = materials;
        const { toolAngle = 0, toolShaftDiameter = 0 } = toolParams;

        this.modelInfo = modelInfo;
        this.uploadName = uploadName;
        this.transformation = transformation;
        this.gcodeConfig = gcodeConfig;

        this.density = density;

        this.isRotate = isRotate;
        this.diameter = diameter;

        this.initialZ = diameter / 2;
        this.toolPath = new ToolPath({ isRotate, diameter: diameter });

        this.toolAngle = toolAngle;
        this.toolShaftDiameter = toolShaftDiameter;
    }

    _generateSlicerLayerCutPointPath(slicerLayer) {
        const polygonsPart = slicerLayer.polygonsPart;

        const convexHullPolygons = polygonsPart.convexHull();

        const diffPolygons = convexHullPolygons.diff(polygonsPart);

        const convexHullPolygon = convexHullPolygons.get(0);
        // eslint-disable-next-line no-unused-vars
        const resPaths = [];

        let preIndex = 0;
        let nextIndex = 0;

        const getIndex = (index, len) => {
            return (index + len) % len;
        };

        const resPath = [];

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

    _lineToHash(p1, p2) {
        return p1.x * 1000000000 + p1.y * 1000000 + p2.x * 1000 + p2.y;
    }

    _generateSlicerLayerToolPath(slicerLayer, data) {
        const { jogSpeed = 300, workSpeed = 300, plungeSpeed = 300 } = this.gcodeConfig;
        const { paths, diffPolygons } = data;

        const gY = slicerLayer.z;

        const lineSet = new Set();

        diffPolygons.forEach(diffPolygon => {
            diffPolygon.forEachLine((p1, p2) => {
                lineSet.add(this._lineToHash(p1, p2));
            });
        });

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

                let gcodePoints = null;

                if (lineSet.has(this._lineToHash(lastPoint, point))) {
                    gcodePoints = this._interpolateDiffPolygons(diffPolygons, lastPoint, point);
                } else {
                    gcodePoints = this._interpolatePoints(lastPoint, point);
                }

                for (const gcodePoint of gcodePoints) {
                    const { x, y } = Vector2.rotate(gcodePoint, gcodePoint.b);
                    const gX = round(x, 3);
                    const gZ = round(y, 3);
                    this.toolPath.move1XYZB(gX, gY, gZ, gcodePoint.b, workSpeed);
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
        // for (let j = 0; j < polygonsPart.size(); j++) {
        //     const polygon = polygonsPart.get(j);
        //     for (let i = 0; i < polygon.size(); i++) {
        //         const point = polygon.get(i);
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
        // for (let j = 0; j < convexHullPolygons.size(); j++) {
        //     const polygon = convexHullPolygons.get(j);
        //     for (let i = 0; i < polygon.size(); i++) {
        //         const point = polygon.get(i);
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
        // this.toolPath.move0Y(slicerLayer.z - 4, 300);
        // this.toolPath.move0B(0, 300);
        //
        // for (let j = 0; j < diffPolygons.data.length; j++) {
        //     const path = diffPolygons.data[j].path;
        //     for (let i = 0; i < path.length; i++) {
        //         const point = path[i];
        //
        //         if (i === 0) {
        //             this.toolPath.move0XZ(point.x * 10, point.y * 10, 300);
        //         } else {
        //             this.toolPath.move1XZ(point.x * 10, point.y * 10, 300);
        //         }
        //     }
        // }

        //
        // const resultPolygons = polygonsPart.padding(4);
        //
        // this.toolPath.move0Z(this.initialZ, 300);
        // this.toolPath.move0Y(slicerLayer.z + 40, 300);
        // this.toolPath.move0B(0, 300);
        //
        // for (let j = 0; j < resultPolygons.data.length; j++) {
        //     const path = resultPolygons.data[j].path;
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
        const gcodePoints = [];
        const hash = this._lineToHash(lastPoint, point);
        const angle = Vector2.anglePoint(lastPoint, point);

        const lastPointAngle = Vector2.rotate(lastPoint, -angle);
        const pointAngle = Vector2.rotate(point, -angle);

        const segCount = Math.ceil(Math.abs(lastPointAngle.x - pointAngle.x) * 50);

        if (segCount <= 1) {
            gcodePoints.push(point);
            return gcodePoints;
        }

        const cutPolygon = new Polygon();

        for (let j = 1; j < segCount; j++) {
            cutPolygon.add({
                x: lastPointAngle.x + (pointAngle.x - lastPointAngle.x) / segCount * j,
                y: null
            });
        }

        const calculateInterpolateY = (p, p1, p2) => {
            return (p.x - p1.x) / (p2.x - p1.x) * (p2.y - p1.y) + p1.y;
        };

        diffPolygons.forEach(diffPolygon => {
            diffPolygon.forEachLine((p1, p2) => {
                if (this._lineToHash(p1, p2) === hash) {
                    return;
                }
                p1 = Vector2.rotate(p1, -angle);
                p2 = Vector2.rotate(p2, -angle);
                for (let i = 0; i < cutPolygon.size(); i++) {
                    const p = cutPolygon.get(i);
                    if ((p1.x <= p.x && p2.x >= p.x) || (p1.x >= p.x && p2.x <= p.x)) {
                        const y = calculateInterpolateY(p, p1, p2);
                        p.y = p.y === null ? y : Math.min(p.y, y);
                    }
                }
            });
        });

        const removeIndex = [];
        if (cutPolygon.size() >= 2) {
            let pre = lastPointAngle;
            let i = 0;
            let cur = cutPolygon.get(i);
            let next = cutPolygon.get(i + 1);
            while (i < cutPolygon.size()) {
                if (Vector2.pointInCommonLine(pre, cur, next) && Math.abs(next.x - pre.x) < 1 / this.density) {
                    removeIndex[i] = 1;
                } else {
                    pre = cur;
                }
                cur = next;
                i++;
                next = i === cutPolygon.size() - 1 ? pointAngle : cutPolygon.get(i + 1);
            }
        }

        const smooths = [];
        for (let i = 0; i < cutPolygon.size(); i++) {
            if (!removeIndex[i]) {
                const p = cutPolygon.get(i);
                smooths.push({
                    x: p.x,
                    y: p.y,
                    b: (p.x - lastPointAngle.x) / (pointAngle.x - lastPointAngle.x) * (point.b - lastPoint.b) + lastPoint.b
                });
            }
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
            const len = smooths.length;
            for (let i = 0; i < len; i++) {
                const preX = i === 0 ? lastPointAngle.x : smooths[i - 1].x;
                const preY = i === 0 ? lastPointAngle.y : smooths[i - 1].y;
                const curX = smooths[i].x;
                const b = smooths[i].b;
                const normal = 180 - angle;
                const cutAngle = normalAngle(b - normal + this.toolAngle / 2);
                if (cutAngle > 0 && cutAngle < 60) {
                    const smoothY = preY + (Math.abs(curX - preX)) / Math.tan(cutAngle / 180 * Math.PI);
                    if (smooths[i].y > smoothY) {
                        smooths[i].y = smoothY;
                        update = true;
                    }
                }
            }

            for (let i = len - 1; i >= 0; i--) {
                const preX = i === len - 1 ? pointAngle.x : smooths[i + 1].x;
                const preY = i === len - 1 ? pointAngle.y : smooths[i + 1].y;
                const curX = smooths[i].x;
                const b = smooths[i].b;
                const normal = 180 - angle;
                const cutAngle = normalAngle(normal - b + this.toolAngle / 2);
                if (cutAngle > 0 && cutAngle < 60) {
                    const smoothY = preY + (Math.abs(curX - preX)) / Math.tan(cutAngle / 180 * Math.PI);
                    if (smooths[i].y > smoothY) {
                        smooths[i].y = smoothY;
                        update = true;
                    }
                }
            }
        }

        smooths.push({
            x: pointAngle.x,
            y: pointAngle.y,
            b: point.b
        });

        for (let i = 0; i < smooths.length; i++) {
            const p = smooths[i];
            const { x, y } = Vector2.rotate(p, angle);
            gcodePoints.push({
                x: x,
                y: y,
                b: p.b
            });
        }

        return gcodePoints;
    }

    _interpolatePoints(lastPoint, point) {
        const gcodePoints = [];

        const segCount = Math.max(Math.ceil(Math.abs(lastPoint.b - point.b) / 0.5), 1);

        for (let j = 1; j <= segCount; j++) {
            gcodePoints.push({
                x: lastPoint.x + (point.x - lastPoint.x) / segCount * j,
                y: lastPoint.y + (point.y - lastPoint.y) / segCount * j,
                b: lastPoint.b + (point.b - lastPoint.b) / segCount * j
            });
        }

        return gcodePoints;
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

        const { jogSpeed = 300 } = this.gcodeConfig;

        this.toolPath.move0Z(this.initialZ, jogSpeed);

        this.toolPath.spindleOn({ P: 100 });

        const p = null;

        const slicerLayers = slicer.slicerLayers;

        for (let i = 0; i < slicerLayers.length; i++) {
            const slicerLayer = slicerLayers[i];

            if (slicerLayer.z < 27.8 || slicerLayer.z > 28) {
                continue;
            }
            if (slicerLayer.z < 20) {
                continue;
            }

            // const calculateOffsetPolygons = (tmpIndex, sort) => {
            //     const tan = Math.tan(this.toolAngle / 2 / 180 * Math.PI);
            //     while (tmpIndex >= 0 && tmpIndex < slicerLayers.length) {
            //         const zOffset = Math.abs(slicerLayer.z - slicerLayers[tmpIndex].z);
            //         if (zOffset >= this.toolShaftDiameter / 2) {
            //             break;
            //         }
            //         const offset = zOffset / tan;
            //         const offsetPolygons = slicerLayers[tmpIndex].polygonsPart.padding(offset);
            //         if (offsetPolygons.size() === 0) {
            //             break;
            //         }
            //         slicerLayer.polygonsPart.addPolygons(offsetPolygons);
            //         if (sort) {
            //             tmpIndex++;
            //         } else {
            //             tmpIndex--;
            //         }
            //     }
            // };

            // calculateOffsetPolygons(i - 1, false);
            // calculateOffsetPolygons(i + 1, true);

            // slicerLayer.polygonsPart = slicerLayer.polygonsPart.splitIntoParts();

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
