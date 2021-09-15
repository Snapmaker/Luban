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
        this.materials = this.modelInfo.materials;
        this.meshProcess = new MeshProcess(this.modelInfo);
    }

    toSVGStackFiles() {
        const aabb = this.meshProcess.mesh.aabb;

        this.meshProcess.mesh.addCoordinateSystem({ y: '-y' });

        this.meshProcess.mesh.offset({
            x: -aabb.min.x,
            y: -aabb.min.y,
            z: -aabb.min.z
        });

        const slicer = this.meshProcess.slice(this.materials.thickness);

        this.outputFilename = `${pathWithRandomSuffix(this.modelInfo.uploadName)
            .replace('.stl', '')}`;

        let { width, height } = this.materials;

        const boundingBoxX = aabb.length.x + 10;
        const boundingBoxY = aabb.length.y;

        if (boundingBoxX > width) {
            width = boundingBoxX + 0.1;
        }
        if (boundingBoxY > height) {
            height = boundingBoxY + 0.1;
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

        const svgFileStateWrite = () => {
            const svgStr = svgToString(svgFileState.svg);
            fs.writeFileSync(`${DataStorage.tmpDir}/${this.outputFilename}_${svgFileState.index}.svg`, svgStr, 'utf8');

            result.push({
                width: width,
                height: height,
                filename: `${DataStorage.tmpDir}/${this.outputFilename}_${svgFileState.index}.svg`
            });

            svgFileState.startX += boundingBoxX;

            if (svgFileState.startX + boundingBoxX > width) {
                if (svgFileState.startY + 2 * boundingBoxY > height) {
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
                } else {
                    svgFileState.startX = 0;
                    svgFileState.startY += boundingBoxY;
                }
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

            polygonsPart.forEach(polygon => {
                svgFileState.svg.shapes[0].paths.push({
                    points: polygon.path.map(v => [v.x + svgFileState.startX, v.y + svgFileState.startY])
                });
            });

            svgFileStateWrite();
        }

        return result;
    }

    toSVGStackSTL() {
        const aabb = this.meshProcess.mesh.aabb;

        this.meshProcess.mesh.addCoordinateSystem({ y: '-y' });

        this.meshProcess.mesh.offset({
            x: -aabb.min.x,
            y: -aabb.min.y,
            z: -aabb.min.z
        });

        const slicer = this.meshProcess.slice(this.materials.thickness);

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
        bufferGeometry.addAttribute('position', positionAttribute);

        const mesh = new THREE.Mesh(bufferGeometry, new THREE.MeshBasicMaterial());

        fs.writeFileSync(`${DataStorage.tmpDir}/${this.outputFilename}`, new STLExporter().parse(mesh), 'utf8');

        return {
            width: aabb.length.x,
            height: aabb.length.y,
            filename: this.outputFilename
        };
    }
}

export default STLToSvgStack;
