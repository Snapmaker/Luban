import * as fs from 'fs-extra';
import path from 'path';
import * as three from 'three';

import STLExporter from '../../../shared/lib/STL/STLExporter';
import DataStorage from '../../DataStorage';
import logger from '../../lib/logger';
import type { Mesh } from '../../lib/MeshProcess/Mesh';
import { MeshProcess } from '../../lib/MeshProcess/MeshProcess';


const log = logger('channel-handlers:mesh');

declare interface SplitMeshOptions {
    uploadName: string;
}

const generateMeshFromVertices = (vertices: number[]) => {
    const geometry = new three.BufferGeometry();

    const verticesAttribtue = new three.Float32BufferAttribute(vertices, 3);
    geometry.setAttribute('position', verticesAttribtue);

    const material = new three.MeshPhongMaterial({
        color: 0xaaaaff,
        flatShading: true,
    });
    const mesh = new three.Mesh(geometry, material);
    return mesh;
};

interface Vertex {
    p: {
        x: number;
        y: number;
        z: number;
    },
    c: number[];
}

interface Face {
    vi: number[]; // vertices index
    cf: number[]; // connected face of each face
}

function unionFind(father: number[], x: number): number {
    if (father[x] === x) return x;

    const root = unionFind(father, father[x]);
    father[x] = root;

    return root;
}

function unionMerge(father: number[], x: number, y: number): void {
    const fx = unionFind(father, x);
    const fy = unionFind(father, y);

    if (fx === fy) return;

    father[fy] = fx;
}

function unionVerticesAndFaces(vertices: Vertex[], faces: Face[]) {
    const n = vertices.length;

    const marks = new Array(n);
    for (let i = 0; i < n; i++) marks[i] = i;

    for (const face of faces) {
        const v0 = face.vi[0];
        const v1 = face.vi[1];
        const v2 = face.vi[2];

        unionMerge(marks, v0, v1);
        unionMerge(marks, v0, v2);
    }

    const meshVertices = [];
    const meshMarks = [];

    for (const face of faces) {
        const vi0 = face.vi[0];
        const fvi0 = unionFind(marks, vi0);

        let meshIndex = meshMarks.findIndex(mark => mark === fvi0);
        if (meshIndex === -1) {
            meshVertices.push([] as number[]);
            meshMarks.push(fvi0);
            meshIndex = meshVertices.length - 1;
        }

        const mesh = meshVertices[meshIndex] as number[];
        const v0 = vertices[face.vi[0]];
        const v1 = vertices[face.vi[1]];
        const v2 = vertices[face.vi[2]];

        mesh.push(v0.p.x, v0.p.y, v0.p.z);
        mesh.push(v1.p.x, v1.p.y, v1.p.z);
        mesh.push(v2.p.x, v2.p.y, v2.p.z);
    }

    return meshVertices;
}

/**
 * Split mesh into several meshes.
 */
const handleSplitMesh = async (actions, options: SplitMeshOptions) => {
    actions.next({
        type: 'started',
        uploadName: options.uploadName,
    });

    log.info(`Split mesh ${options.uploadName}...`);
    const startTime = +new Date();

    // TODO:
    const { uploadName } = options;

    // const meshPath = `${DataStorage.tmpDir}/${uploadName}`;

    try {
        const meshProcess = new MeshProcess({ uploadName });
        const mesh = meshProcess.mesh as Mesh;

        const result = {
            meshes: [],
        };

        const meshes = unionVerticesAndFaces(mesh.vertices, mesh.faces);

        for (let i = 0; i < meshes.length; i++) {
            const meshVertices = meshes[i];
            const newMesh = generateMeshFromVertices(meshVertices);

            const newMeshFilename = `${uploadName.replace('.stl', '')}_${i}.stl`;
            // const newMeshFilePath = `${DataStorage.tmpDir}/${newMeshFilename}`;
            const newMeshFilePath = path.join(DataStorage.tmpDir, newMeshFilename);

            await fs.writeFile(newMeshFilePath, new STLExporter().parse(newMesh, { binary: true }), 'utf8');

            result.meshes.push({
                uploadName: newMeshFilename,
            });
        }

        actions.next({
            type: 'success',
            result,
        });

        const endTime = +new Date();
        log.info(`Split mesh ${options.uploadName} takes ${(endTime - startTime)} ms`);
    } catch (e) {
        log.error(e);
        actions.next({
            type: 'error',
            reason: `Failed to split meshes: ${e}`,
        });
    }
};

export {
    handleSplitMesh,
};
