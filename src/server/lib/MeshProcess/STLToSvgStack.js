/**
 * This class is used to handle STL stack mode
 */
import fs from 'fs';
import earcut from 'earcut';
import * as THREE from 'three';
import { MeshProcess } from './MeshProcess';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import DataStorage from '../../DataStorage';
import { svgToString } from '../../../shared/lib/SVGParser/SvgToString';
import STLExporter from '../../../shared/lib/STL/STLExporter';

// eslint-disable-next-line no-unused-vars
const NUMBERS = [
    [[0, 0], [4, 0], [4, 2], [0, 2], [0, 1]],
    [[0, 1], [4, 1]],
    [[0, 2], [0, 0], [2, 0], [2, 2], [4, 2], [4, 0]],
    [[0, 0], [0, 2], [2, 2], [2, 0], [2, 2], [4, 2], [4, 0]],
    [[0, 2], [4, 2], [2, 2], [2, 0], [4, 0]],
    [[0, 0], [0, 2], [2, 2], [2, 0], [4, 0], [4, 2]],
    [[4, 2], [4, 0], [0, 0], [0, 2], [2, 2], [2, 1]],
    [[4, 0], [4, 2], [0, 2]],
    [[0, 0], [4, 0], [4, 2], [0, 2], [0, 1], [0, 2], [2, 2], [2, 1]],
    [[0, 0], [0, 2], [4, 2], [4, 0], [2, 0], [2, 1]]
];

class STLToSvgStack {
    meshProcess;

    constructor(modelInfo) {
        this.modelInfo = {
            ...modelInfo,
            materials: {
                ...modelInfo.materials,
                isRotate: false
            }
        };
        this.scale = this.modelInfo.scale;
        this.materials = this.modelInfo.materials;
        this.meshProcess = new MeshProcess(this.modelInfo);
    }

    slice() {
        if (!this.slicer) {
            this.meshProcess.mesh.addCoordinateSystem({ y: '-y' });

            this.meshProcess.mesh.resize({
                x: this.scale,
                y: this.scale,
                z: this.scale
            });

            this.meshProcess.mesh.offset({
                x: -this.meshProcess.mesh.aabb.min.x,
                y: -this.meshProcess.mesh.aabb.min.y,
                z: -this.meshProcess.mesh.aabb.min.z
            });

            this.slicer = this.meshProcess.slice(this.materials.thickness);
            this.aabb = {
                max: {
                    ...this.meshProcess.mesh.aabb.max
                },
                min: {
                    ...this.meshProcess.mesh.aabb.min
                },
                length: {
                    ...this.meshProcess.mesh.aabb.length
                }
            };
            delete this.meshProcess.mesh;
        }
    }

    toSVGStackFiles() {
        this.slice();

        const aabb = this.aabb;
        const slicer = this.slicer;

        delete this.meshProcess.mesh;

        this.outputFilename = `${pathWithRandomSuffix(this.modelInfo.uploadName)
            .replace('.stl', '')}`;

        let { width, height } = this.materials;

        const boundingBoxX = aabb.length.x + 12;
        const boundingBoxY = aabb.length.y;

        if (boundingBoxX > width) {
            width = boundingBoxX + 0.1;
        }
        if (boundingBoxY > height) {
            height = boundingBoxY + 0.1;
        }

        const digits = Math.ceil(Math.log10(slicer.slicerLayers.length));
        const countHeight = digits * 4 + 3;
        if (countHeight > height) {
            height = countHeight + 0.1;
        }

        const svgFileState = {
            index: 0,
            startX: 0,
            startY: 0,
            svg: {
                shapes: [{
                    visibility: true,
                    stroke: '#000000',
                    paths: []
                }],
                width: width,
                height: height,
                viewBox: `0 0 ${width} ${height}`
            }
        };

        const result = [];

        const svgFileStateWrite = (isWrite) => {
            svgFileState.startX += boundingBoxX;

            if (svgFileState.startX + boundingBoxX > width) {
                if (svgFileState.startY + 2 * boundingBoxY > height) {
                    isWrite = true;
                } else {
                    svgFileState.startX = 0;
                    svgFileState.startY += boundingBoxY;
                }
            }

            if (isWrite) {
                const svgStr = svgToString(svgFileState.svg);
                fs.writeFileSync(`${DataStorage.tmpDir}/${this.outputFilename}_${svgFileState.index}.svg`, svgStr, 'utf8');

                result.push({
                    width: width,
                    height: height,
                    filename: `${this.outputFilename}_${svgFileState.index}.svg`
                });

                svgFileState.index++;
                svgFileState.startX = 0;
                svgFileState.startY = 0;
                svgFileState.svg = {
                    shapes: [{
                        visibility: true,
                        stroke: '#000000',
                        paths: []
                    }],
                    width: width,
                    height: height,
                    viewBox: `0 0 ${width} ${height}`
                };
            }
        };

        for (let i = 0; i < slicer.slicerLayers.length; i++) {
            const slicerLayer = slicer.slicerLayers[i];
            const polygonsPart = slicerLayer.polygonsPart;

            svgFileState.svg.shapes[0].paths.push({
                points: [[svgFileState.startX, svgFileState.startY], [svgFileState.startX + boundingBoxX, svgFileState.startY],
                    [svgFileState.startX + boundingBoxX, svgFileState.startY + boundingBoxY],
                    [svgFileState.startX, svgFileState.startY + boundingBoxY], [svgFileState.startX, svgFileState.startY]]
            });

            svgFileState.svg.shapes[0].paths.push({
                points: [[svgFileState.startX + aabb.length.x + 2, svgFileState.startY + 2], [svgFileState.startX + boundingBoxX - 2, svgFileState.startY + 2],
                    [svgFileState.startX + boundingBoxX - 2, svgFileState.startY + boundingBoxY - 2],
                    [svgFileState.startX + aabb.length.x + 2, svgFileState.startY + boundingBoxY - 2], [svgFileState.startX + aabb.length.x + 2, svgFileState.startY + 2]]
            });

            // Set digits
            const numIndex = [];
            let ii = i + 1;
            while (ii > 0) {
                numIndex.push(ii % 10);
                ii = Math.floor(ii / 10);
            }
            const xOffset = svgFileState.startX + aabb.length.x + 2 + 2;
            let yOffset = svgFileState.startY + 2 + 2;
            for (let j = numIndex.length - 1; j >= 0; j--) {
                const ni = numIndex[j];
                svgFileState.svg.shapes[0].paths.push({
                    points: NUMBERS[ni].map(v => { return [v[0] + xOffset, v[1] + yOffset]; })
                });
                yOffset += 4;
            }


            polygonsPart.forEach(polygon => {
                svgFileState.svg.shapes[0].paths.push({
                    points: polygon.path.map(v => [v.x + svgFileState.startX, v.y + svgFileState.startY])
                });
            });

            svgFileStateWrite(i === slicer.slicerLayers.length - 1);
        }

        return result;
    }

    toSVGStackSTL() {
        this.slice();

        const aabb = this.aabb;
        const slicer = this.slicer;

        this.outputFilename = pathWithRandomSuffix(this.modelInfo.uploadName);

        const positions = [];

        for (let i = 0; i < slicer.slicerLayers.length; i++) {
            const slicerLayer = slicer.slicerLayers[i];
            const polygonsPart = slicerLayer.polygonsPart;
            const polygonsTrees = polygonsPart.getPolygonssByPolyTree();

            const lowZ = slicerLayer.z - this.materials.thickness / 2;
            const highZ = slicerLayer.z + this.materials.thickness / 2;

            for (let l = 0; l < polygonsTrees.length; l++) {
                const polygonsTree = polygonsTrees[l];

                const points = [];
                const holes = [];

                polygonsTree.forEach(polygon => {
                    for (let j = 0; j < polygon.path.length; j++) {
                        const p1 = polygon.path[j];
                        const p2 = polygon.path[(j + 1) % polygon.path.length];

                        positions.push(p1.x, p1.y, lowZ);
                        positions.push(p1.x, p1.y, highZ);
                        positions.push(p2.x, p2.y, highZ);

                        positions.push(p1.x, p1.y, lowZ);
                        positions.push(p2.x, p2.y, lowZ);
                        positions.push(p2.x, p2.y, highZ);

                        points.push(p1.x);
                        points.push(p1.y);
                    }

                    holes.push(points.length / 2);
                });
                holes.pop();

                const faceIndexs = earcut(points, holes);

                for (let j = 0; j < faceIndexs.length; j += 3) {
                    for (let k = 0; k < 3; k++) {
                        const vIdx = faceIndexs[j + k];
                        positions.push(points[vIdx * 2], points[vIdx * 2 + 1], lowZ);
                    }
                }

                for (let j = 0; j < faceIndexs.length; j += 3) {
                    for (let k = 0; k < 3; k++) {
                        const vIdx = faceIndexs[j + k];
                        positions.push(points[vIdx * 2], points[vIdx * 2 + 1], highZ);
                    }
                }
            }
        }

        const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
        const bufferGeometry = new THREE.BufferGeometry();
        bufferGeometry.setAttribute('position', positionAttribute);

        const mesh = new THREE.Mesh(bufferGeometry, new THREE.MeshBasicMaterial());

        fs.writeFileSync(`${DataStorage.tmpDir}/${this.outputFilename}`, new STLExporter().parse(mesh, { binary: true }), 'utf8');

        return {
            width: aabb.length.x,
            height: aabb.length.y,
            layers: slicer.slicerLayers.length,
            filename: this.outputFilename
        };
    }
}

export default STLToSvgStack;
