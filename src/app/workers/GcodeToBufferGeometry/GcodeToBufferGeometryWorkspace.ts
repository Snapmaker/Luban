import * as THREE from 'three';
import isEmpty from 'lodash/isEmpty';
import noop from 'lodash/noop';
import ToolPath from '../../../shared/lib/gcodeToolPath';
import { DATA_PREFIX } from '../../constants';
import { readFileToList } from './index';
import { Vector2 } from '../../../shared/lib/math/Vector2';

const defaultColor = [40, 167, 255];
const motionColor = {
    'G0': [200, 200, 200],
    'G1': [0, 0, 0],
    'G2': [0, 191, 255],
    'G3': [0, 191, 255]
};
const indexMotionColor = {
    'G0': [200, 200, 200],
    'G1': [40, 167, 255],
    'G2': [0, 191, 255],
    'G3': [0, 191, 255]
};


class GcodeToBufferGeometryWorkspace {
    // Attention : switch y <====> z
    // vertexBuffer.push(new THREE.Vector3(this.state.x, this.state.z, -this.state.y));
    public async parse(gcodeFilename, gcode, onParsed = noop, onProgress = noop, onError = noop) {
        try {
            let gcodeList;
            if (!isEmpty(gcodeFilename)) {
                const gcodeFilepath = `${DATA_PREFIX}/${gcodeFilename}`;
                gcodeList = await readFileToList(gcodeFilepath);
            } else {
                gcodeList = gcode.split('\n');
            }

            if (!gcodeList || gcodeList.length === 0) {
                onError('gcode is empty');
                return;
            }

            let renderMethodTmp = 'line';

            let colors = [];
            let indexs = [];
            let indexColors = [];
            let positions = [];
            let indexCount = 0;

            let progress = 0;
            let lastMotion = '';
            let lastPower = 0;

            let axisWorkRange = null;

            const calculateXYZ = (state, modal) => {
                const { headerType, isRotate = false, diameter } = modal;
                let z = state.z;
                if (isRotate && headerType === 'laser') {
                    z = diameter / 2 + state.z;
                }
                const res = Vector2.rotate({ x: state.x, y: z }, -state.b || 0);
                return {
                    x: res.x,
                    y: state.y,
                    z: res.y
                };
            };

            const toolPath = new ToolPath({
                addLine: (modal, v1, v2) => {
                    const { motion, maxPower, power, spindle, headerType } = modal;
                    let color;
                    if (maxPower > 0 && renderMethodTmp === 'line' && headerType === 'laser') {
                        const powerColor = Math.round((maxPower - power) / maxPower * 255);
                        color = (spindle === 'M5' || motion !== 'G1') ? [255, 255, 255] : [powerColor, powerColor, powerColor];
                    } else {
                        color = motionColor[motion] || defaultColor;
                    }
                    const indexColor = indexMotionColor[motion] || defaultColor;
                    if (lastMotion !== motion || lastPower !== power) {
                        const res = calculateXYZ(v1, modal);
                        positions.push(res.x);
                        positions.push(res.y);
                        positions.push(res.z);
                        colors.push(color[0]);
                        colors.push(color[1]);
                        colors.push(color[2]);
                        indexColors.push(indexColor[0]);
                        indexColors.push(indexColor[1]);
                        indexColors.push(indexColor[2]);

                        lastMotion = motion;
                        lastPower = power;

                        indexs.push(indexCount);
                    }

                    const segCount = Math.max(Math.ceil(Math.abs(v2.b - v1.b) / 5), 1);

                    for (let j = 1; j <= segCount; j++) {
                        const res = calculateXYZ({
                            x: v1.x + (v2.x - v1.x) / segCount * j,
                            y: v1.y + (v2.y - v1.y) / segCount * j,
                            z: v1.z + (v2.z - v1.z) / segCount * j,
                            b: v1.b + (v2.b - v1.b) / segCount * j
                        }, modal);
                        positions.push(res.x);
                        positions.push(res.y);
                        positions.push(res.z);
                        colors.push(color[0]);
                        colors.push(color[1]);
                        colors.push(color[2]);
                        indexColors.push(indexColor[0]);
                        indexColors.push(indexColor[1]);
                        indexColors.push(indexColor[2]);

                        indexs.push(indexCount);
                    }

                    if (motion === 'G1' && (v1.x !== v2.x || v1.y !== v2.y || v1.z !== v2.z || v1.b !== v2.b)) {
                        if (axisWorkRange === null) {
                            axisWorkRange = {
                                max: {
                                    x: v2.x,
                                    y: v2.y,
                                    z: v2.z,
                                    b: v2.b
                                },
                                min: {
                                    x: v1.x,
                                    y: v1.y,
                                    z: v1.z,
                                    b: v1.b
                                }
                            };
                        } else {
                            axisWorkRange.max.x = Math.max(axisWorkRange.max.x, v2.x);
                            axisWorkRange.max.y = Math.max(axisWorkRange.max.y, v2.y);
                            axisWorkRange.max.z = Math.max(axisWorkRange.max.z, v2.z);
                            axisWorkRange.max.b = Math.max(axisWorkRange.max.b, v2.b);
                            axisWorkRange.min.x = Math.min(axisWorkRange.min.x, v2.x);
                            axisWorkRange.min.y = Math.min(axisWorkRange.min.y, v2.y);
                            axisWorkRange.min.z = Math.min(axisWorkRange.min.z, v2.z);
                            axisWorkRange.min.b = Math.min(axisWorkRange.min.b, v2.b);
                        }
                    }
                },
                addArcCurve: (modal, v1, v2, v0) => {
                    const { motion, plane } = modal;
                    const isClockwise = (motion === 'G2');
                    const radius = Math.sqrt(
                        ((v1.x - v0.x) ** 2) + ((v1.y - v0.y) ** 2)
                    );
                    const startAngle = Math.atan2(v1.y - v0.y, v1.x - v0.x);
                    let endAngle = Math.atan2(v2.y - v0.y, v2.x - v0.x);

                    // Draw full circle if startAngle and endAngle are both zero
                    if (startAngle === endAngle) {
                        endAngle += (2 * Math.PI);
                    }

                    const arcCurve = new THREE.ArcCurve(
                        v0.x, // aX
                        v0.y, // aY
                        radius, // aRadius
                        startAngle, // aStartAngle
                        endAngle, // aEndAngle
                        isClockwise // isClockwise
                    );
                    const divisions = 30;
                    const points = arcCurve.getPoints(divisions);
                    const color = motionColor[motion] || defaultColor;
                    const indexColor = indexMotionColor[motion] || defaultColor;

                    for (let i = 0; i < points.length; ++i) {
                        const point = points[i];
                        const z = ((v2.z - v1.z) / points.length) * i + v1.z;

                        if (plane === 'G17') { // XY-plane
                            positions.push(point.x);
                            positions.push(point.y);
                            positions.push(z);
                        } else if (plane === 'G18') { // ZX-plane
                            positions.push(point.y);
                            positions.push(z);
                            positions.push(point.x);
                        } else if (plane === 'G19') { // YZ-plane
                            positions.push(z);
                            positions.push(point.x);
                            positions.push(point.y);
                        }
                        colors.push(color[0]);
                        colors.push(color[1]);
                        colors.push(color[2]);
                        indexColors.push(indexColor[0]);
                        indexColors.push(indexColor[1]);
                        indexColors.push(indexColor[2]);
                        indexs.push(indexCount);
                    }
                },
                addHeader: (params) => {
                    const { headerStart, renderMethod } = params;
                    if (renderMethod) {
                        renderMethodTmp = renderMethod;
                    }
                    if (headerStart) {
                        if (positions.length > 0) {
                            const bufferGeometry = new THREE.BufferGeometry();
                            const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
                            const indexAttribute = new THREE.Float32BufferAttribute(indexs, 1);
                            const colorAttribute = new THREE.Uint8BufferAttribute(colors, 3);
                            const indexColorAttribute = new THREE.Uint8BufferAttribute(indexColors, 3);

                            // this will map the buffer values to 0.0f - +1.0f in the shader
                            colorAttribute.normalized = true;
                            indexColorAttribute.normalized = true;

                            bufferGeometry.setAttribute('position', positionAttribute);
                            bufferGeometry.setAttribute('a_color', colorAttribute);
                            bufferGeometry.setAttribute('a_index_color', indexColorAttribute);
                            bufferGeometry.setAttribute('a_index', indexAttribute);

                            onParsed({
                                bufferGeometry: bufferGeometry,
                                renderMethod: renderMethodTmp,
                                isDone: false
                            });

                            positions = [];
                            colors = [];
                            indexs = [];
                            indexColors = [];
                        }
                    }
                }
            });

            toolPath.loadFromArraySync(gcodeList, (line, i, length) => {
                const curProgress = i / length;
                if ((curProgress - progress > 0.01)) {
                    progress = curProgress;
                    onProgress(progress);
                }
                indexCount = i;
            });

            onProgress(1);

            const bufferGeometry = new THREE.BufferGeometry();
            const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
            const indexAttribute = new THREE.Float32BufferAttribute(indexs, 1);
            const colorAttribute = new THREE.Uint8BufferAttribute(colors, 3);
            const indexColorAttribute = new THREE.Uint8BufferAttribute(indexColors, 3);

            // this will map the buffer values to 0.0f - +1.0f in the shader
            colorAttribute.normalized = true;
            indexColorAttribute.normalized = true;

            bufferGeometry.setAttribute('position', positionAttribute);
            bufferGeometry.setAttribute('a_color', colorAttribute);
            bufferGeometry.setAttribute('a_index_color', indexColorAttribute);
            bufferGeometry.setAttribute('a_index', indexAttribute);

            if (axisWorkRange === null) {
                axisWorkRange = {
                    max: {
                        x: 0,
                        y: 0,
                        z: 0,
                        b: 0
                    },
                    min: {
                        x: 0,
                        y: 0,
                        z: 0,
                        b: 0
                    }
                };
            }

            onParsed({
                bufferGeometry: bufferGeometry,
                renderMethod: renderMethodTmp,
                isDone: true,
                axisWorkRange,
            });
        } catch (err) {
            onError(err);
        }
    }
}

export default GcodeToBufferGeometryWorkspace;
