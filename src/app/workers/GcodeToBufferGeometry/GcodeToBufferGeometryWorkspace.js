import * as THREE from 'three';
import isEmpty from 'lodash/isEmpty';
import noop from 'lodash/noop';
import ToolPath from '../../../shared/lib/gcodeToolPath';
import { DATA_PREFIX } from '../../constants';
import { readFile } from './index';

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
    async parse(gcodeFilename, gcode, onParsed = noop, onProgress = noop, onError = noop) {
        try {
            if (!isEmpty(gcodeFilename)) {
                const gcodeFilepath = `${DATA_PREFIX}/${gcodeFilename}`;
                gcode = await readFile(gcodeFilepath);
            }

            if (isEmpty(gcode)) {
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

            let boundingBox = null;

            const toolPath = new ToolPath({
                addLine: (modal, v1, v2) => {
                    const { motion } = modal;
                    const color = motionColor[motion] || defaultColor;
                    const indexColor = indexMotionColor[motion] || defaultColor;
                    positions.push(v1.x);
                    positions.push(v1.y);
                    positions.push(v1.z);
                    colors.push(color[0]);
                    colors.push(color[1]);
                    colors.push(color[2]);
                    indexColors.push(indexColor[0]);
                    indexColors.push(indexColor[1]);
                    indexColors.push(indexColor[2]);
                    positions.push(v2.x);
                    positions.push(v2.y);
                    positions.push(v2.z);
                    colors.push(color[0]);
                    colors.push(color[1]);
                    colors.push(color[2]);
                    indexColors.push(indexColor[0]);
                    indexColors.push(indexColor[1]);
                    indexColors.push(indexColor[2]);

                    indexs.push(indexCount);
                    indexs.push(indexCount);

                    if (motion === 'G1' && (v1.x !== v2.x || v1.y !== v2.y || v1.z !== v2.z)) {
                        if (boundingBox === null) {
                            boundingBox = {
                                max: {
                                    x: v2.x,
                                    y: v2.y,
                                    z: v2.z
                                },
                                min: {
                                    x: v2.x,
                                    y: v2.y,
                                    z: v2.z
                                }
                            };
                        } else {
                            boundingBox.max.x = Math.max(boundingBox.max.x, v2.x);
                            boundingBox.max.y = Math.max(boundingBox.max.y, v2.y);
                            boundingBox.max.z = Math.max(boundingBox.max.z, v2.z);
                            boundingBox.min.x = Math.min(boundingBox.min.x, v2.x);
                            boundingBox.min.y = Math.min(boundingBox.min.y, v2.y);
                            boundingBox.min.z = Math.min(boundingBox.min.z, v2.z);
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

                            bufferGeometry.addAttribute('position', positionAttribute);
                            bufferGeometry.addAttribute('a_color', colorAttribute);
                            bufferGeometry.addAttribute('a_index_color', indexColorAttribute);
                            bufferGeometry.addAttribute('a_index', indexAttribute);

                            onParsed({ bufferGeometry: bufferGeometry, renderMethod: renderMethodTmp, isDone: false });

                            positions = [];
                            colors = [];
                            indexs = [];
                            indexColors = [];
                        }
                    }
                }
            });

            toolPath.loadFromStringSync(gcode, (line, i, length) => {
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

            bufferGeometry.addAttribute('position', positionAttribute);
            bufferGeometry.addAttribute('a_color', colorAttribute);
            bufferGeometry.addAttribute('a_index_color', indexColorAttribute);
            bufferGeometry.addAttribute('a_index', indexAttribute);
            onParsed({ bufferGeometry: bufferGeometry, renderMethod: renderMethodTmp, isDone: true, boundingBox: boundingBox });
        } catch (err) {
            onError(err);
        }
    }
}

export default GcodeToBufferGeometryWorkspace;
