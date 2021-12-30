import { Vector3 } from 'three';

const supportAvailColor = [1, 0.2, 0.2];
const supportUnavailColor = [0.9, 0.9, 0.9];

type TransferData = {
    positions: Array<number>,
    normals: Array<number>
};

onmessage = (event) => {
    const { positions, normals } = event.data as TransferData;

    const colors = [];
    for (let i = 0; i < normals.length; i += 9) {
        const normal = new Vector3(normals[i], normals[i + 1], normals[i + 2]);
        const angle = normal.angleTo(new Vector3(0, 0, 1)) / Math.PI * 180;
        const avgZ = (positions[i + 2] + positions[i + 5] + positions[i + 8]) / 3;

        if (angle > 120 && avgZ > 1) {
            colors.push(...supportAvailColor);
            colors.push(...supportAvailColor);
            colors.push(...supportAvailColor);
        } else {
            colors.push(...supportUnavailColor);
            colors.push(...supportUnavailColor);
            colors.push(...supportUnavailColor);
        }
    }
    postMessage({ colors });
};
