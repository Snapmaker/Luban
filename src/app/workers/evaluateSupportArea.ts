import { Vector3 } from 'three';
import sendMessage from './utils/sendMessage';

// const supportAvailColor = [1, 0.2, 0.2];
// const supportUnavailColor = [0.9, 0.9, 0.9];

type TransferData = {
    downAngle: number, // [0°, 90°]
    positions: Array<number>,
    normals: Array<number>
};

enum SupportArea {
    NONE = 0,
    FACE = 1,
    POINT = 2,
    LINE = 3
}

type PointInfo = {
    faceIds: number[],
    isSupport: boolean,
    normal: Vector3
};

// type LineInfo = {
//     faceIds: number[],
//     isSupport: boolean
// };

const evaluateSupportArea = (data) => {
    const { positions, normals, downAngle } = data as TransferData;
    // none 0, face 1, dot 2, line 3
    const colors: SupportArea[] = new Array(positions.length / 9).fill(0);
    const downFaces: boolean[] = new Array(colors.length).fill(false);
    const normalVectors: Vector3[] = new Array(colors.length).fill(false);
    // calculate faces
    const zUp = new Vector3(0, 0, 1);
    for (let i = 0, index = 0; i < normals.length; i += 3, index++) {
        const normal = new Vector3(normals[i], normals[i + 1], normals[i + 2]);
        normalVectors[i] = normal;
    }
    for (let i = 0; i < normalVectors.length; i++) {
        const normal = normalVectors[i];
        const angle = normal.angleTo(zUp) / Math.PI * 180;
        if (angle > 90) {
            downFaces[i] = true;
        }
        if (angle - 90 > downAngle) {
            colors[i] = SupportArea.FACE;
        }
    }

    // calculate points
    const points = new Map<string, PointInfo>();
    for (let i = 0, index = 0; i < positions.length; i += 3) {
        index = Math.floor(i / 9);
        const key = `${positions[i]}-${positions[i + 1]}-${positions[i + 2]}`;
        if (points.has(key)) {
            const value = points.get(key);
            value.faceIds.push(index);
        } else {
            points.set(key, {
                faceIds: [index],
                isSupport: true,
                normal: new Vector3(0, 0, 0)
            });
        }
    }
    for (let i = 0, index = 0; i < positions.length; i += 9, index++) {
        if (downFaces[index] && colors[index] === SupportArea.NONE) {
            const p1 = new Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const p2 = new Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
            const p3 = new Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);

            const orderedPoints = ([p1, p2, p3].sort((a, b) => a.z - b.z));
            orderedPoints.forEach((point, j) => {
                const value = points.get(`${point.x}-${point.y}-${point.z}`);
                if (j === 0) {
                    value.normal.add(normalVectors[index]);
                } else {
                    value.isSupport = false;
                }
            });
        }
    }
    points.forEach((value) => {
        if (value.isSupport && ((value.normal.angleTo(zUp) / Math.PI * 180) > 90)) {
            value.faceIds.forEach(faceId => {
                colors[faceId] = SupportArea.POINT;
            });
        }
    });

    // calculate lines
    // const lines = new Map<string, PointInfo>();
    // for (let i = 0, index = 0; i < positions.length; i += 9, index++) {
    //     const keyP1 = `${positions[i]}-${positions[i + 1]}-${positions[i + 2]}`;
    //     const keyP2 = `${positions[i + 3]}-${positions[i + 4]}-${positions[i + 5]}`;
    //     const keyP3 = `${positions[i + 6]}-${positions[i + 7]}-${positions[i + 8]}`;

    //     const line12 = [keyP1, keyP2];
    //     const line13 = [keyP1, keyP3];
    //     const line23 = [keyP2, keyP3];

    //     const edges = [line12, line13, line23];
    //     edges.forEach(line => {
    //         if (lines.has(line.join())) {
    //             const value = lines.get(key);
    //             value.faceIds.push(index);
    //         } else if (lines.has(line.reverse().join())) {

    //         } else {
    //             lines.set(key, {
    //                 faceIds: [index],
    //                 isSupport: true,
    //                 normal: new Vector3(0, 0, 0)
    //             });
    //         }
    //     });
    // }

    sendMessage({ colors });
};

export default evaluateSupportArea;
