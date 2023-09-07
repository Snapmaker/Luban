import Jimp from 'jimp';
import fs from 'fs';
import { Mesh } from './Mesh';
import { Vector2 } from '../../../shared/lib/math/Vector2';
import {
    BACK,
    BOTTOM, FRONT, LEFT, RIGHT, TOP
} from '../../constants';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import { round } from '../../../shared/lib/utils';
import { Line } from '../../../shared/lib/math/Line';
import { Slicer } from './Slicer';

/**
 * Calculate whether a point is inside the triangle
 * @returns {*}
 */
// eslint-disable-next-line no-unused-vars
function pointInTriangle(v0, v1, v2, p) {
    return Vector2.sameSide(v0, v1, p, v2) && Vector2.sameSide(v1, v2, p, v0) && Vector2.sameSide(v2, v0, p, v1);
}

/**
 * Get the plane function through 3 points
 * Ax + by + cz + d = 0
 * @returns {{A: number, B: number, C: number, D: number}}
 */
// eslint-disable-next-line no-unused-vars
function getPlane(v0, v1, v2) {
    const A = ((v1.y - v0.y) * (v2.z - v0.z) - (v1.z - v0.z) * (v2.y - v0.y));
    const B = ((v1.z - v0.z) * (v2.x - v0.x) - (v1.x - v0.x) * (v2.z - v0.z));
    const C = ((v1.x - v0.x) * (v2.y - v0.y) - (v1.y - v0.y) * (v2.x - v0.x));
    const D = (0 - (A * v0.x + B * v0.y + C * v0.z));
    return {
        A, B, C, D
    };
}

function getAngleRange(angle1, angle2, angle = 1) {
    const order = Math.abs(angle1 - angle2) < 180;
    let start, end;
    if (angle1 < angle2) {
        start = order ? angle1 : angle2;
        end = order ? angle2 : angle1 + 360;
    } else {
        start = order ? angle2 : angle1;
        end = order ? angle1 : angle2 + 360;
    }
    start = Math.ceil(start / angle);
    end = Math.floor(end / angle);

    return {
        start,
        end
    };
}

const getPointByLineAndAngle = (start, end, angle) => {
    const k2 = Math.tan(angle / 180 * Math.PI);
    if (start.x === end.x) {
        return {
            x: start.x,
            y: k2 * start.x
        };
    }
    if (start.y === end.y) {
        return {
            x: start.y / k2,
            y: start.y
        };
    }
    const k1 = (end.y - start.y) / (end.x - start.x);
    const b1 = end.y - k1 * end.x;
    if (k1 === k2) {
        return null;
    }
    return {
        x: b1 / (k2 - k1),
        y: (b1 / (k2 - k1)) * k2
    };
};

// eslint-disable-next-line no-unused-vars
const writeSvg = (width, height, paths, outputFile, p = '') => {
    let d = '';
    for (const path of paths) {
        d += 'M';
        for (const point of path) {
            d += `${point.x} ${point.y} `;
        }
    }
    const svg = `${`${`${`${'<svg xmlns="http://www.w3.org/2000/svg"\n'
        + '        width="'}${width}"\n`
        + '        height="'}${height}"\n`
        + '        viewBox="0,0,'}${width},${height}"\n`
        + '        version="1.1">\n'
        + '        <path d="'}${d}" stroke="#000000" \n`
        + '                fill="none" \n'
        + '                fill-rule="evenodd" \n'
        + '                stroke-width="0.1"/>\n'
        + '\n'
        + '      </svg>';

    fs.writeFileSync(`${process.env.Tmpdir}/${p}${outputFile.replace('.png', '.svg')}`, svg, 'utf8');
};

export const DIRECTION_FACE_OPTIONS = {
    [FRONT]: { x: 'x', y: 'y', z: 'z' },
    [BACK]: { x: '-x', y: '-y', z: 'z' },
    [LEFT]: { x: '-y', y: 'x', z: 'z' },
    [RIGHT]: { x: 'y', y: '-x', z: 'z' },
    [TOP]: { x: 'x', y: '-z', z: 'y' },
    [BOTTOM]: { x: 'x', y: 'z', z: '-y' }
};

const PLACEMENT_FACE_OPTIONS = {
    [FRONT]: { x: '-x', y: '-z', z: '-y' },
    [BACK]: { x: '-x', y: 'z', z: 'y' },
    [LEFT]: { x: 'z', y: 'y', z: '-x' },
    [RIGHT]: { x: '-z', y: 'y', z: 'x' },
    [TOP]: { x: 'x', y: 'y', z: 'z' },
    [BOTTOM]: { x: '-x', y: 'y', z: '-z' }
};


export class MeshProcess {
    constructor(modelInfo) {
        const { uploadName, scale = 1, config = {}, transformation = {}, materials = {} } = modelInfo;

        const { isRotate, diameter } = materials;

        const { direction = FRONT, placement = BOTTOM, minGray = 0, maxGray = 255,
            sliceDensity = 5, extensionX = 0, extensionY = 0 } = config;

        this.uploadName = uploadName;
        this.direction = direction;
        this.placement = placement;
        this.minGray = minGray;
        this.maxGray = maxGray;
        this.extensionX = extensionX;
        this.extensionY = extensionY;
        this.sliceDensity = sliceDensity;
        this.transformation = transformation;
        this.scale = scale;

        this.flip = transformation.flip || 0;

        this.isRotate = isRotate;
        this.diameter = diameter;

        this.mesh = Mesh.loadSTLFile(`${process.env.Tmpdir}/${uploadName}`);

        this._setDirection();

        if (!this.mesh) {
            throw new Error(`MeshProcess load uploadName: ${uploadName} failed`);
        }
    }

    getWidthAndHeight() {
        return this.mesh.getSize(this.isRotate);
    }

    slice(thickness) {
        const aabb = this.mesh.aabb;

        const layerThickness = thickness;
        const initialLayerThickness = layerThickness / 2;
        const imageHeight = Math.floor((aabb.length.z - initialLayerThickness) / layerThickness) + 1;

        this.slicer = new Slicer(this.mesh, layerThickness, imageHeight, initialLayerThickness);

        return this.slicer;
    }

    convertTo3AxisData(density) {
        const { width, height } = this.getWidthAndHeight();

        const layerThickness = 1 / density;
        const initialLayerThickness = layerThickness / 2;
        const imageWidth = Math.floor((width - initialLayerThickness) / layerThickness) + 1;
        const imageHeight = Math.floor((height - initialLayerThickness) / layerThickness) + 1;

        this.slicer = new Slicer(this.mesh, layerThickness, imageHeight, initialLayerThickness);

        const data = [];

        for (let i = 0; i < imageWidth; i++) {
            data[i] = [];
            for (let j = 0; j < imageHeight; j++) {
                data[i][j] = 0;
            }
        }

        for (let j = 0; j < this.slicer.slicerLayers.length; j++) {
            const slicerLayer = this.slicer.slicerLayers[j];

            const polygons = [].concat(slicerLayer.polygons.data).concat(slicerLayer.polygonsPart.data).concat(slicerLayer.openPolygons.data);

            for (const polygon of polygons) {
                const size = polygon.size();

                for (let k = 0; k < size; k++) {
                    const p1 = polygon.get(k % size);
                    const p2 = polygon.get((k + 1) % size);

                    const start = Math.ceil((Math.min(p1.x, p2.x) - initialLayerThickness) / layerThickness);
                    const end = Math.floor((Math.max(p1.x, p2.x) - initialLayerThickness) / layerThickness);

                    const line = new Line(p1, p2);

                    for (let i = start; i <= end; i++) {
                        let y = line.getYByX(i * layerThickness + initialLayerThickness);

                        if (y === null) {
                            y = Math.max(p1.y, p2.y);
                        }
                        y = y < 0 ? 0 : y;

                        y = round(y, 2);

                        data[i][j] = Math.max(data[i][j], y);
                    }
                }
            }
        }

        const maxZ = this.mesh.aabb.max.y;
        return {
            maxZ: maxZ,
            data: data,
            width,
            height,
            imageWidth: imageWidth,
            imageHeight: imageHeight
        };
    }

    convertTo4AxisDate(density) {
        const { width, height } = this.getWidthAndHeight();

        const r = width / (Math.PI * 2);

        const layerThickness = 1 / density;
        const initialLayerThickness = layerThickness / 2;

        const imageWidth = Math.ceil(width * density);
        const imageHeight = Math.floor((height - initialLayerThickness) / layerThickness) + 1;

        const slicer = new Slicer(this.mesh, layerThickness, imageHeight, initialLayerThickness);

        const data = [];
        const sliceAngle = 360 / imageWidth;

        for (let i = 0; i < imageWidth; i++) {
            data[i] = [];
            for (let j = 0; j < imageHeight; j++) {
                data[i][j] = 0;
            }
        }

        for (let j = 0; j < slicer.slicerLayers.length; j++) {
            const slicerLayer = slicer.slicerLayers[j];

            const polygons = [].concat(slicerLayer.polygonsPart.data).concat(slicerLayer.openPolygons.data);

            for (const polygon of polygons) {
                const ppath = polygon.path;
                for (let k = 0; k < ppath.length; k++) {
                    const start = ppath[k % ppath.length];
                    const end = ppath[(k + 1) % ppath.length];

                    const a1 = Vector2.angle(start);
                    const a2 = Vector2.angle(end);
                    if (!a1 || !a2 || Math.abs(a1 - a2) === 180) {
                        continue;
                    }
                    const range = getAngleRange(a1, a2, sliceAngle);
                    for (let a = range.start; a <= range.end; a++) {
                        const aa = (a * sliceAngle) % 360;
                        const i = Math.min(Math.round(aa / sliceAngle), imageWidth - 1);

                        const p = getPointByLineAndAngle(start, end, aa);

                        const l = Vector2._length(p);

                        data[i][j] = Math.max(l, data[i][j]);
                    }
                }
            }
        }

        return {
            maxZ: r,
            data: data,
            width,
            height,
            imageWidth,
            imageHeight
        };
    }

    _setDirection() {
        this.mesh.setCoordinateSystem(this.isRotate ? PLACEMENT_FACE_OPTIONS[this.placement] : DIRECTION_FACE_OPTIONS[this.direction]);
        if ((this.flip & 1) > 0) {
            this.mesh.addCoordinateSystem({ z: '-z' });
        }
        if ((this.flip & 2) > 0) {
            this.mesh.addCoordinateSystem({ x: '-x' });
        }
    }

    convertToData(density = this.sliceDensity) {
        let result = null;

        if (this.isRotate) {
            this.mesh.addCoordinateSystem(DIRECTION_FACE_OPTIONS[RIGHT]);
            this.mesh.offset({
                x: -(this.mesh.aabb.max.x + this.mesh.aabb.min.x) / 2,
                y: -(this.mesh.aabb.max.y + this.mesh.aabb.min.y) / 2,
                z: -this.mesh.aabb.min.z
            });
            result = this.convertTo4AxisDate(density);
        } else {
            this.mesh.addCoordinateSystem({ y: '-y' });
            this.mesh.offset({
                x: -this.mesh.aabb.min.x,
                y: -this.mesh.aabb.min.y,
                z: -this.mesh.aabb.min.z
            });
            result = this.convertTo3AxisData(density);
        }

        const { maxZ, data, imageWidth, imageHeight, width, height } = result;

        const grayRange = this.maxGray - this.minGray;

        for (let i = 0; i < data.length; i++) {
            data[i].reverse();

            for (let j = 0; j < data[i].length; j++) {
                data[i][j] = data[i][j] / maxZ * grayRange + this.minGray;
            }
        }

        return {
            data,
            width,
            height,
            imageWidth,
            imageHeight
        };
    }

    convertToImage() {
        console.log('convertToImage');
        this.outputFilename = `${pathWithRandomSuffix(this.uploadName).replace('.stl', '')}.png`;

        this.mesh.resize({
            x: this.scale,
            y: this.scale,
            z: this.scale
        });

        const axisData = this.convertToData(this.sliceDensity);

        const data = axisData.data;

        const imageWidth = data.length;
        const imageHeight = data[0].length;
        const width = axisData.width;
        const height = axisData.height;

        return new Promise(resolve => {
            // eslint-disable-next-line no-new
            new Jimp(imageWidth, imageHeight, (err, image) => {
                for (let i = 0; i < imageWidth; i++) {
                    for (let j = 0; j < imageHeight; j++) {
                        const idx = j * imageWidth * 4 + i * 4;
                        const d = data[i][j];

                        image.bitmap.data[idx] = d;
                        image.bitmap.data[idx + 1] = d;
                        image.bitmap.data[idx + 2] = d;
                        image.bitmap.data[idx + 3] = 255;
                    }
                }

                image.write(`${process.env.Tmpdir}/${this.outputFilename}`, () => {
                    resolve({
                        filename: this.outputFilename,
                        width: width,
                        height: height
                    });
                });
            });
        });
    }
}
