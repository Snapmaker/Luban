/* eslint-disable func-names */

import * as THREE from 'three';

/**
 * @author kovacsv / http://kovacsv.hu/
 * @author mrdoob / http://mrdoob.com/
 * @author mudcube / http://mudcu.be/
 *
 * modified by Walker
 * 1. Use local matrix rather than world matrix (line 50)
 * 2. Switch y and z (line 87) to handle left-hand and right-hand coordinate problem
 */

function STLBinaryExporter() {}

STLBinaryExporter.prototype = {

    constructor: STLBinaryExporter,

    parse: (function () {
        const vector = new THREE.Vector3();
        const normalMatrixWorld = new THREE.Matrix3();

        return function parse(scene) {
            if (scene.isMesh && scene.geometry.isBufferGeometry && scene.children.length === 0) {
                return this._parseBufferGeometryMeshWithoutChildren(scene);
            }

            // We collect objects first, as we may need to convert from BufferGeometry to Geometry
            const objects = [];
            let triangles = 0;
            // Iterative 'face' and 'updateMatrixWorld' takes more time
            scene.traverse((object) => {
                if (!(object instanceof THREE.Mesh)) return;

                let geometry = object.geometry;
                if (geometry instanceof THREE.BufferGeometry) {
                    geometry = new THREE.Geometry().fromBufferGeometry(geometry);
                }

                if (!(geometry instanceof THREE.Geometry)) return;
                triangles += geometry.faces.length;

                object.updateMatrixWorld();

                objects.push({

                    geometry: geometry,
                    matrix: object.matrixWorld
                    // matrix: object.matrix

                });
            });

            let offset = 80; // skip header
            const bufferLength = triangles * 2 + triangles * 3 * 4 * 4 + 80 + 4;
            const arrayBuffer = new ArrayBuffer(bufferLength);
            const output = new DataView(arrayBuffer);
            output.setUint32(offset, triangles, true); offset += 4;

            // Traversing our collected objects
            objects.forEach((object) => {
                const vertices = object.geometry.vertices;
                const faces = object.geometry.faces;

                normalMatrixWorld.getNormalMatrix(object.matrix);

                for (let i = 0, l = faces.length; i < l; i++) {
                    const face = faces[i];
                    // Iterative 'face', 'applyMatrix3' operation takes more time and space
                    vector.copy(face.normal).applyMatrix3(normalMatrixWorld).normalize();

                    output.setFloat32(offset, vector.x, true); offset += 4; // normal
                    output.setFloat32(offset, vector.y, true); offset += 4;
                    output.setFloat32(offset, vector.z, true); offset += 4;

                    const indices = [face.a, face.b, face.c];

                    for (let j = 0; j < 3; j++) {
                        vector.copy(vertices[indices[j]]).applyMatrix4(object.matrix);

                        output.setFloat32(offset, vector.x, true); offset += 4; // vertices
                        output.setFloat32(offset, vector.y, true); offset += 4;
                        output.setFloat32(offset, vector.z, true); offset += 4;
                    }

                    output.setUint16(offset, 0, true); offset += 2; // attribute byte count
                }
            });

            return output;
        };
    }()),

    _parseBufferGeometryMeshWithoutChildren: (function () {
        const vA = new THREE.Vector3();
        const vB = new THREE.Vector3();
        const vC = new THREE.Vector3();
        const cb = new THREE.Vector3(), ab = new THREE.Vector3();
        const vector = new THREE.Vector3();
        const normalMatrixWorld = new THREE.Matrix3();

        // parse directly from buffer geometry, inspired by:
        // https://github.com/mrdoob/three.js/blob/ba4489ded66212ac9e6d3017a6bb856023bd026f/src/core/Geometry.js#L290
        return function parse(object) {
            const attributes = object.geometry.attributes;
            const positions = attributes.position.array;
            const groups = object.geometry.groups;
            const indices = object.geometry.index !== null ? object.geometry.index.array : undefined;
            normalMatrixWorld.getNormalMatrix(object.matrix);

            let offset = 80; // skip header
            const triangles = positions.length / 9;
            const bufferLength = triangles * 2 + triangles * 3 * 4 * 4 + 80 + 4;
            const arrayBuffer = new ArrayBuffer(bufferLength);
            const output = new DataView(arrayBuffer);
            output.setUint32(offset, triangles, true); offset += 4;


            const addFace = (a, b, c) => {
                // compute face normal
                // https://github.com/mrdoob/three.js/blob/ba4489ded66212ac9e6d3017a6bb856023bd026f/src/core/BufferGeometry.js#L726
                vA.set(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]);
                vB.set(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]);
                vC.set(positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2]);
                cb.subVectors(vC, vB);
                ab.subVectors(vA, vB);
                cb.cross(ab);
                cb.normalize();

                vector.copy(cb).applyMatrix3(normalMatrixWorld).normalize();

                output.setFloat32(offset, vector.x, true); offset += 4; // normal
                output.setFloat32(offset, vector.y, true); offset += 4;
                output.setFloat32(offset, vector.z, true); offset += 4;

                const vertices = [vA, vB, vC];

                for (let j = 0; j < 3; j++) {
                    vector.copy(vertices[j]).applyMatrix4(object.matrix);

                    output.setFloat32(offset, vector.x, true); offset += 4; // vertices
                    output.setFloat32(offset, vector.y, true); offset += 4;
                    output.setFloat32(offset, vector.z, true); offset += 4;
                }

                output.setUint16(offset, 0, true); offset += 2; // attribute byte count
            };

            if (groups.length > 0) {
                for (let i = 0; i < groups.length; i++) {
                    const group = groups[i];

                    const start = group.start;
                    const count = group.count;

                    for (let j = start, jl = start + count; j < jl; j += 3) {
                        if (indices !== undefined) {
                            addFace(indices[j], indices[j + 1], indices[j + 2]);
                        } else {
                            addFace(j, j + 1, j + 2);
                        }
                    }
                }
            } else {
                if (indices !== undefined) {
                    for (let i = 0; i < indices.length; i += 3) {
                        addFace(indices[i], indices[i + 1], indices[i + 2]);
                    }
                } else {
                    for (let i = 0; i < positions.length / 3; i += 3) {
                        addFace(i, i + 1, i + 2);
                    }
                }
            }


            return output;
        };
    }())
};

export default STLBinaryExporter;
