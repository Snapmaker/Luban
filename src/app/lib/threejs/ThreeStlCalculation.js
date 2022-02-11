import * as THREE from 'three';

const xyMaxX = 200, xyMinX = -200, xyMaxY = 200, xyMinY = -200;
const xzMaxX = 200, xzMinX = -200, xzMaxY = 200, xzMinY = -200;
const zyMaxX = 200, zyMinX = -200, zyMaxY = 200, zyMinY = -200;
const xyMaxLength = Math.max(xyMaxX - xyMinX, xyMaxY - xyMinY);
const xzMaxLength = Math.max(xzMaxX - xzMinX, xzMaxY - xzMinY);
const zyMaxLength = Math.max(zyMaxX - zyMinX, zyMaxY - zyMinY);

function calculateUvVector(scaleGroup, mesh) {
    const faceVertexUvs = [[]];
    const { array, count } = mesh.geometry.getAttribute('position');
    const scaleMesh = mesh.scale;
    for (let face = 0; face < count / 3; face++) {
        const vertices = [
            {
                x: array[face * 9 + 0],
                y: array[face * 9 + 1],
                z: array[face * 9 + 2]
            },
            {
                x: array[face * 9 + 3],
                y: array[face * 9 + 4],
                z: array[face * 9 + 5]
            },
            {
                x: array[face * 9 + 6],
                y: array[face * 9 + 7],
                z: array[face * 9 + 8]
            }
        ];
        const dXY = Math.abs((vertices[0].x - vertices[1].x) * (vertices[1].y - vertices[2].y)
            - (vertices[0].y - vertices[1].y) * (vertices[1].x - vertices[2].x));
        const dXZ = Math.abs((vertices[0].x - vertices[1].x) * (vertices[1].z - vertices[2].z)
            - (vertices[0].z - vertices[1].z) * (vertices[1].x - vertices[2].x));
        const dZY = Math.abs((vertices[0].y - vertices[1].y) * (vertices[1].z - vertices[2].z)
            - (vertices[0].z - vertices[1].z) * (vertices[1].y - vertices[2].y));
        let useFace;
        if (dXY > dXZ && dXY > dZY) {
            useFace = 'xy';
        } else if (dXZ > dZY) {
            useFace = 'xz';
        } else {
            useFace = 'zy';
        }
        const currentUv = vertices.map((item) => {
            let newX = 0, newY = 0;
            switch (useFace) {
                case 'xy': {
                    newX = (item.x * scaleGroup.x * scaleMesh.x - xyMinX) / xyMaxLength;
                    newY = (item.y * scaleGroup.y * scaleMesh.y - xyMinX) / xyMaxLength;
                    break;
                }
                case 'xz': {
                    newX = (item.x * scaleGroup.x * scaleMesh.x - xzMinX) / xzMaxLength;
                    newY = (item.z * scaleGroup.z * scaleMesh.z - xzMinX) / xzMaxLength;
                    break;
                }
                case 'zy': {
                    newX = (item.z * scaleGroup.z * scaleMesh.z - zyMinX) / zyMaxLength;
                    newY = (item.y * scaleGroup.y * scaleMesh.y - zyMinX) / zyMaxLength;
                    break;
                }
                default: {
                    break;
                }
            }
            return new THREE.Vector2(newX, newY);
        });
        faceVertexUvs[0].push(currentUv);
    }
    const uv = [];
    faceVertexUvs[0].forEach((faceUvs) => {
        for (let i = 0; i < 3; ++i) {
            uv.push(...faceUvs[i].toArray());
        }
    });
    return (new THREE.BufferAttribute(new Float32Array(uv), 2));
}

export {
    calculateUvVector
};
