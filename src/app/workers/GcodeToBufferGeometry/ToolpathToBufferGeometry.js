import noop from 'lodash/noop';
import * as THREE from 'three';
// import { Transfer } from 'threads';
import { Vector2 } from '../../../shared/lib/math/Vector2';
import { DATA_PREFIX } from '../../constants';

const { Transfer } = require('threads');

class ToolpathToBufferGeometry {
    parse(filename, onProgress = noop) {
        const filePath = `${DATA_PREFIX}/${filename}`;
        return new Promise((resolve, reject) => {
            try {
                new THREE.FileLoader().load(filePath, data => {
                    const toolPath = JSON.parse(data);
                    this.toolPath = toolPath;
                    const renderResult = this.render(onProgress);
                    resolve(renderResult);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    render(onProgress = noop) {
        const { headType, movementMode, data, isRotate, positionX, positionY, rotationB, isSelected } = this.toolPath;

        // now only support cnc&laser
        if (!['cnc', 'laser'].includes(headType)) {
            return null;
        }
        let bufferGeometry;
        if (headType === 'laser') {
            if (movementMode === 'greyscale-dot') {
                bufferGeometry = this.parseToPoints(data, onProgress);
            } else {
                bufferGeometry = this.parseToLine(data, isRotate, onProgress);
            }
        } else {
            bufferGeometry = this.parseToLine(data, isRotate, onProgress);
        }
        return {
            headType,
            movementMode,
            isRotate,
            positionX,
            positionY,
            rotationB,
            isSelected,
            positions: Transfer(bufferGeometry.positionsAttribute.array),
            gCodes: Transfer(bufferGeometry.gCodesAttribute.array)
        };
    }

    parseToLine(data, isRotate, onProgress) {
        const positions = [];
        const gCodes = [];

        let state = {
            G: 0,
            X: 0,
            B: 0,
            Y: 0,
            Z: 0
        };
        let p = 0;
        let lastP = 0;
        for (let i = 0; i < data.length; i++) {
            const item = data[i];

            if (item.G !== 0 && item.G !== 1) {
                continue;
            }

            const newState = { ...state };
            item.G !== undefined && (newState.G = item.G);
            item.X !== undefined && (newState.X = item.X);
            item.Y !== undefined && (newState.Y = item.Y);
            item.Z !== undefined && (newState.Z = item.Z);
            item.B !== undefined && (newState.B = item.B);

            if (state.G === 1 && newState.G === 0) {
                const res = this.calculateXYZ(
                    {
                        X: state.X,
                        Y: state.Y,
                        Z: state.Z,
                        B: state.B
                    },
                    isRotate
                );
                positions.push(res.X);
                positions.push(res.Y);
                positions.push(res.Z);
                gCodes.push(newState.G);
            }

            if (state.G !== newState.G || state.X !== newState.X || state.Y !== newState.Y || state.Z !== newState.Z || state.B !== newState.B) {
                const segCount = Math.max(Math.ceil(Math.abs(state.B - newState.B) / 5), 1);

                for (let j = 1; j <= segCount; j++) {
                    const res = this.calculateXYZ(
                        {
                            X: state.X + ((newState.X - state.X) / segCount) * j,
                            Y: state.Y + ((newState.Y - state.Y) / segCount) * j,
                            Z: state.Z + ((newState.Z - state.Z) / segCount) * j,
                            B: state.B + ((newState.B - state.B) / segCount) * j
                        },
                        isRotate
                    );

                    positions.push(res.X);
                    positions.push(res.Y);
                    positions.push(res.Z);
                    gCodes.push(newState.G);
                }
                state = newState;
            }

            p = i / data.length;
            if (p - lastP > 0.05) {
                onProgress(p);
                lastP = p;
            }
        }
        onProgress(1);

        // const bufferGeometry = new THREE.BufferGeometry();
        const positionsAttribute = new THREE.Float32BufferAttribute(positions, 3);
        const gCodesAttribute = new THREE.Float32BufferAttribute(gCodes, 1);
        // bufferGeometry.setAttribute('position', positionAttribute);
        // bufferGeometry.setAttribute('a_g_code', gCodeAttribute);

        return {
            positionsAttribute,
            gCodesAttribute
        };
    }

    parseToPoints(data, onProgress) {
        const positions = [];
        const gCodes = [];
        let state = {
            G: 0,
            X: 0,
            Y: 0,
            B: 0,
            Z: 0
        };
        let p = 0;
        let lastP = 0;
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const newState = { ...state };
            item.G !== undefined && (newState.G = item.G);
            item.X !== undefined && (newState.X = item.X);
            item.Y !== undefined && (newState.Y = item.Y);
            item.Z !== undefined && (newState.Z = item.Z);
            item.B !== undefined && (newState.B = item.B);

            if (state.G !== newState.G || state.X !== newState.X || state.Y !== newState.Y || state.Z !== newState.Z || state.B !== newState.B) {
                state = newState;
                const res = this.calculateXYZ(state);
                positions.push(res.X);
                positions.push(res.Y);
                positions.push(res.Z);
                gCodes.push(state.G);
            }

            p = i / data.length;
            if (p - lastP > 0.05) {
                onProgress(p);
                lastP = p;
            }
        }
        onProgress(1);
        // const bufferGeometry = new THREE.BufferGeometry();
        const positionsAttribute = new THREE.Float32BufferAttribute(positions, 3);
        const gCodesAttribute = new THREE.Float32BufferAttribute(gCodes, 1);
        // bufferGeometry.setAttribute('position', positionAttribute);
        // bufferGeometry.setAttribute('a_g_code', gCodeAttribute);

        return {
            positionsAttribute,
            gCodesAttribute
        };
    }

    calculateXYZ(state) {
        const { headType, isRotate = false, diameter } = this.toolPath;
        let z = state.Z;
        if (isRotate && headType === 'laser') {
            z = diameter / 2;
        }
        const res = Vector2.rotate(
            {
                x: state.X,
                y: z
            },
            -state.B
        );
        return {
            X: res.x,
            Y: state.Y,
            Z: res.y
        };
    }
}

export default ToolpathToBufferGeometry;
