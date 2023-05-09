/* eslint-disable */
/**
 * @author kovacsv / http://kovacsv.hu/
 * @author mrdoob / http://mrdoob.com/
 *
 *
 * Update STLExporter function（ Exporting binary stl file part）:
 * 1. Regardless of whether the object to be parsed has descendants, it is parsed in the same way.
 * 2. When parsing object with 'children', inside iterative 'face', no using ‘applyMatrix3’ to calculate binary data.
 * TODO: When exporting with ASCII, it will exceed string max length. Error: Invalid string length
 */

import * as THREE from 'three';

class STLExporter {
    parse(scene, options = {}) {
        options = Object.assign({
            binary: false
        }, options);

        const binary = options.binary;


        const objects = [];
        let triangles = 0;

        scene.traverse((object) => {
            if (object.isMesh && object.visible) {
                const geometry = object.geometry;

                // TODO: Remove this
                if (geometry.isBufferGeometry !== true) {
                    throw new Error('THREE.STLExporter: Geometry is not of type THREE.BufferGeometry.');
                }

                const index = geometry.index;
                const positionAttribute = geometry.getAttribute('position');

                triangles += (index !== null) ? (index.count / 3) : (positionAttribute.count / 3);

                objects.push({
                    object3d: object,
                    geometry: geometry
                });
            }
        });

        let output;
        let offset = 80; // skip header

        if (binary === true) {
            const bufferLength = triangles * 2 + triangles * 3 * 4 * 4 + 80 + 4;
            const arrayBuffer = new ArrayBuffer(bufferLength);
            output = new DataView(arrayBuffer);
            output.setUint32(offset, triangles, true); offset += 4;
        } else {
            output = '';
            output += 'solid exported\n';
        }

        const vA = new THREE.Vector3();
        const vB = new THREE.Vector3();
        const vC = new THREE.Vector3();
        const cb = new THREE.Vector3();
        const ab = new THREE.Vector3();
        const normal = new THREE.Vector3();

        function writeNormal(vAInside, vBInside, vCInside) {
            cb.subVectors(vCInside, vBInside);
            ab.subVectors(vAInside, vBInside);
            cb.cross(ab).normalize();
            normal.copy(cb).normalize();

            if (binary === true) {
                output.setFloat32(offset, normal.x, true); offset += 4;
                output.setFloat32(offset, normal.y, true); offset += 4;
                output.setFloat32(offset, normal.z, true); offset += 4;
            } else {
                output += `\tfacet normal ${normal.x} ${normal.y} ${normal.z}\n`;
                output += '\t\touter loop\n';
            }
        }

        function writeVertex(vertex) {
            if (binary === true) {
                output.setFloat32(offset, vertex.x, true); offset += 4;
                output.setFloat32(offset, vertex.y, true); offset += 4;
                output.setFloat32(offset, vertex.z, true); offset += 4;
            } else {
                output += `\t\t\tvertex ${vertex.x} ${vertex.y} ${vertex.z}\n`;
            }
        }

        function writeFace(a, b, c, positionAttribute, object, extraAttrValue = 0) {
            vA.fromBufferAttribute(positionAttribute, a);
            vB.fromBufferAttribute(positionAttribute, b);
            vC.fromBufferAttribute(positionAttribute, c);

            if (object.isSkinnedMesh === true) {
                object.boneTransform(a, vA);
                object.boneTransform(b, vB);
                object.boneTransform(c, vC);
            }

            vA.applyMatrix4(object.matrixWorld);
            vB.applyMatrix4(object.matrixWorld);
            vC.applyMatrix4(object.matrixWorld);

            writeNormal(vA, vB, vC);

            writeVertex(vA);
            writeVertex(vB);
            writeVertex(vC);

            if (binary === true) {
                output.setUint16(offset, extraAttrValue, true); offset += 2;
            } else {
                output += '\t\tendloop\n';
                output += '\tendfacet\n';
            }
        }

        for (let i = 0, il = objects.length; i < il; i++) {
            const object = objects[i].object3d;
            const geometry = objects[i].geometry;

            const index = geometry.index;
            const positionAttribute = geometry.getAttribute('position');

            // Attribute byte count
            let byteCountAttribute = [];
            if (geometry.getAttribute('byte_count')) {
                byteCountAttribute = geometry.getAttribute('byte_count').array;
            }

            if (index !== null) {
                // indexed geometry
                for (let j = 0; j < index.count; j += 3) {
                    const a = index.getX(j + 0);
                    const b = index.getX(j + 1);
                    const c = index.getX(j + 2);
                    const extraAttrValue = byteCountAttribute[j / 3];

                    writeFace(a, b, c, positionAttribute, object, extraAttrValue);
                }
            } else {
                // non-indexed geometry
                const remainder = positionAttribute.count % 3 > 1;
                for (let j = 0; j < positionAttribute.count - 1; j += 3) {
                    const a = j;
                    const b = j + 1 <= positionAttribute.count ? j + 1 : positionAttribute.count;
                    const c = j + 2 <= positionAttribute.count ? j + 2 : positionAttribute.count;
                    const extraAttrValue = byteCountAttribute[j / 3];

                    writeFace(a, b, c, positionAttribute, object, extraAttrValue);
                }
            }
        }

        if (binary === false) {
            output += 'endsolid exported\n';
        }

        return output;
    }
}

export default STLExporter;
