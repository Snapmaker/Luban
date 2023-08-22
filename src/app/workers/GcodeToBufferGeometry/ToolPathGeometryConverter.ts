import noop from 'lodash/noop';
import * as THREE from 'three';
import { Transfer } from 'threads';

import { Vector2 } from '../../../shared/lib/math/Vector2';
import { DATA_PREFIX } from '../../constants';


class ToolPathGeometryConverter {
    private toolPath;

    public async parse(filename: string, onProgress = noop) {
        const filePath = `${DATA_PREFIX}/${filename}`;
        return new Promise((resolve, reject) => {
            try {
                new THREE.FileLoader().load(filePath, data => {
                    const toolPath = JSON.parse(data as string);
                    this.toolPath = toolPath;
                    const renderResult = this.render(onProgress);
                    resolve(renderResult);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    public async parseAsync(filename: string, onProgress = null, onComplete = null) {
        const filePath = `${DATA_PREFIX}/${filename}`;

        const data = await new Promise((resolve) => {
            new THREE.FileLoader().load(filePath, response => resolve(response));
        });

        const toolPath = JSON.parse(data as string);
        this.toolPath = toolPath;
        const renderResult = this.render(onProgress);

        onComplete && onComplete(renderResult);
    }

    private render(onProgress = noop) {
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
            gCodes: Transfer(bufferGeometry.gCodesAttribute.array),
            colors: bufferGeometry.colorsAttribute ? Transfer(bufferGeometry.colorsAttribute.array) : null
        };
    }

    private parseToLine(data, isRotate, onProgress) {
        const positions = [];
        const gCodes = [];
        let colors = [];

        let state = {
            G: 0,
            X: 0,
            B: 0,
            Y: 0,
            Z: 0,
            S: 0
        };
        let p = 0;
        let lastP = 0;
        let maxS = 0;
        let lastS = 0;
        for (let i = 0; i < data.length; i++) {
            const item = data[i];

            if (item.M === 3) {
                if (item.S !== undefined) {
                    state.S = item.S;
                }
                if (item.P !== undefined) {
                    state.S = item.P * 2.55;
                }
                if (item.S === undefined && item.P === undefined) {
                    state.S = lastS;
                }
                lastS = state.S;
            }
            if (item.M === 5) {
                if (item.S !== undefined) {
                    state.S = item.S;
                }
                if (item.P !== undefined) {
                    state.S = item.P * 2.55;
                }
                lastS = state.S;
                state.S = 0;
            }

            if (item.G !== 0 && item.G !== 1) {
                continue;
            }

            const newState = { ...state };
            item.G !== undefined && (newState.G = item.G);
            item.X !== undefined && (newState.X = item.X);
            item.Y !== undefined && (newState.Y = item.Y);
            item.Z !== undefined && (newState.Z = item.Z);
            item.B !== undefined && (newState.B = item.B);
            item.S !== undefined && (newState.S = item.S);

            if (state.G !== newState.G || state.S !== newState.S) {
                const res = this.calculateXYZ(
                    {
                        X: state.X,
                        Y: state.Y,
                        Z: state.Z,
                        B: state.B
                    }
                );
                positions.push(res.X);
                positions.push(res.Y);
                positions.push(res.Z);
                gCodes.push(newState.G);

                colors.push(newState.G === 0 ? 0 : newState.S);
                colors.push(newState.G === 0 ? 0 : newState.S);
                colors.push(newState.G === 0 ? 0 : newState.S);
            }

            if (state.G !== newState.G || state.X !== newState.X || state.Y !== newState.Y
                || state.Z !== newState.Z || state.B !== newState.B || state.S !== newState.S) {
                const segCount = Math.max(Math.ceil(Math.abs(state.B - newState.B) / 5), 1);

                for (let j = 1; j <= segCount; j++) {
                    const res = this.calculateXYZ(
                        {
                            X: state.X + ((newState.X - state.X) / segCount) * j,
                            Y: state.Y + ((newState.Y - state.Y) / segCount) * j,
                            Z: state.Z + ((newState.Z - state.Z) / segCount) * j,
                            B: state.B + ((newState.B - state.B) / segCount) * j
                        }
                    );

                    positions.push(res.X);
                    positions.push(res.Y);
                    positions.push(res.Z);
                    gCodes.push(newState.G);

                    colors.push(newState.G === 0 ? 0 : newState.S);
                    colors.push(newState.G === 0 ? 0 : newState.S);
                    colors.push(newState.G === 0 ? 0 : newState.S);
                }
                state = newState;
            }

            maxS = Math.max(maxS, state.S);

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
        maxS = maxS !== 0 ? maxS : 255;
        colors = colors.map(v => (255 - v / maxS * 255));
        const colorsAttribute = new THREE.Uint8BufferAttribute(colors, 3);
        colorsAttribute.normalized = true;
        // bufferGeometry.setAttribute('position', positionAttribute);
        // bufferGeometry.setAttribute('a_g_code', gCodeAttribute);

        return {
            positionsAttribute,
            gCodesAttribute,
            colorsAttribute
        };
    }

    private parseToPoints(data, onProgress) {
        const positions = [];
        const gCodes = [];
        const colors = [];
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
                colors.push(0);
                colors.push(0);
                colors.push(0);
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
        const colorsAttribute = new THREE.Uint8BufferAttribute(colors, 3);
        colorsAttribute.normalized = true;
        // bufferGeometry.setAttribute('position', positionAttribute);
        // bufferGeometry.setAttribute('a_g_code', gCodeAttribute);

        return {
            positionsAttribute,
            gCodesAttribute,
            colorsAttribute
        };
    }

    private calculateXYZ(state) {
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

export default ToolPathGeometryConverter;
