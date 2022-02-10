import * as THREE from 'three';

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
                    newX = (item.x * scaleGroup.x * scaleMesh.x - -200) / 400;
                    newY = (item.y * scaleGroup.y * scaleMesh.y - -200) / 400;
                    break;
                }
                case 'xz': {
                    newX = (item.x * scaleGroup.x * scaleMesh.x - -200) / 400;
                    newY = (item.z * scaleGroup.z * scaleMesh.z - -200) / 400;
                    break;
                }
                case 'zy': {
                    newX = (item.z * scaleGroup.z * scaleMesh.z - -200) / 400;
                    newY = (item.y * scaleGroup.y * scaleMesh.y - -200) / 400;
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
