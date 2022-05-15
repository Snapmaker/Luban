import * as THREE from 'three';
import { PRINT3D_UNIFORMS, PRINT3D_VERT_SHADER, PRINT3D_FRAG_SHADER } from '../ShaderMaterial/print3d-shader-meterial';
import { WORKSPACE_UNIFORMS, WORKSPACE_FRAG_SHADER, WORKSPACE_VERT_SHADER } from '../ShaderMaterial/workspace-shader-meterial';

function elementToVector3(arr) {
    const vectors = [];
    for (let i = 0; i < arr.length; i += 3) {
        const point = new THREE.Vector3(arr[i], arr[i + 1], arr[i + 2]);
        vectors.push(point);
    }
    return vectors;
}

// function deduplicateNearPoints(lineAll) {
//     const line = [];
//     let currentPoint = lineAll[0];
//     line.push(currentPoint);
//     for (let i = 1; i < lineAll.length; i++) {
//         if (!currentPoint.equals(lineAll[i])) {
//             line.push(lineAll[i]);
//             currentPoint = lineAll[i];
//         }
//     }
//     return line;
// }

function lineToGeometry(originalPositions, breakPositionsIndex) {
    const positions = elementToVector3(originalPositions);
    // const positions = elementToVector3(bufferGeometry.getAttribute('position').array);
    // const colors = elementToVector3(bufferGeometry.getAttribute('a_color').array);
    // const colors1 = elementToVector3(bufferGeometry.getAttribute('a_color1').array);
    // const layerIndices = bufferGeometry.getAttribute('a_layer_index').array;
    // const typeCodes = bufferGeometry.getAttribute('a_type_code').array;
    // const toolCodes = bufferGeometry.getAttribute('a_tool_code').array;

    // 去除前后重复的点
    const line = positions;
    // const line = deduplicateNearPoints(positions);
    // console.log(line.length, deduplicateNearPoints);
    // if (line.length < 2) {
    //     return;
    // }
    const zUp = new THREE.Vector3(0, 0, 1), zDown = new THREE.Vector3(0, 0, -1);
    const vertices = [], indices = [], normals = [];
    // exColors = [], exColors1 = [], exLayerIndices = [], exTypeCodes = [], exToolCodes = [],
    const layerHeight = 0.24;
    const lineWidth = 0.4;

    let currentIndex = 0;
    for (let i = 0; i < line.length - 1; i++) {
        if (breakPositionsIndex.indexOf(i) > -1) {
            continue;
        }
        const pointStart = line[i];
        const pointEnd = line[i + 1];
        const lineSegmentVector = new THREE.Vector3().subVectors(pointEnd, pointStart);

        // point start expanded 4 points
        const down = new THREE.Vector3(pointStart.x, pointStart.y, pointStart.z - layerHeight / 2);
        const up = new THREE.Vector3(pointStart.x, pointStart.y, pointStart.z + layerHeight / 2);
        const leftN = new THREE.Vector3().crossVectors(zUp, lineSegmentVector).normalize().multiplyScalar(lineWidth / 2);
        const left = new THREE.Vector3(leftN.x + pointStart.x, leftN.y + pointStart.y, leftN.z + pointStart.z);
        const rightN = new THREE.Vector3().crossVectors(zDown, lineSegmentVector).normalize().multiplyScalar(lineWidth / 2);
        const right = new THREE.Vector3(rightN.x + pointStart.x, rightN.y + pointStart.y, rightN.z + pointStart.z);

        // same as CSS top right down left
        vertices.push(...up.toArray(), ...right.toArray(), ...down.toArray(), ...left.toArray());
        // exColors.push(...colors[i].toArray(), ...colors[i].toArray(), ...colors[i].toArray(), ...colors[i].toArray());
        // exColors1.push(...colors1[i].toArray(), ...colors1[i].toArray(), ...colors1[i].toArray(), ...colors1[i].toArray());
        // exLayerIndices.push(layerIndices[i], layerIndices[i], layerIndices[i], layerIndices[i]);
        // exTypeCodes.push(typeCodes[i], typeCodes[i], typeCodes[i], typeCodes[i]);
        // exToolCodes.push(toolCodes[i], toolCodes[i], toolCodes[i], toolCodes[i]);

        normals.push(...new THREE.Vector3().subVectors(up, pointStart).toArray());
        normals.push(...new THREE.Vector3().subVectors(right, pointStart).toArray());
        normals.push(...new THREE.Vector3().subVectors(down, pointStart).toArray());
        normals.push(...new THREE.Vector3().subVectors(left, pointStart).toArray());

        // point end expanded 4 points
        const down1 = new THREE.Vector3(pointEnd.x, pointEnd.y, pointEnd.z - layerHeight / 2);
        const up1 = new THREE.Vector3(pointEnd.x, pointEnd.y, pointEnd.z + layerHeight / 2);
        // const left1N = new THREE.Vector3().crossVectors(zUp, lineSegmentVector).normalize().multiplyScalar(lineWidth / 2);
        const left1 = new THREE.Vector3(leftN.x + pointEnd.x, leftN.y + pointEnd.y, leftN.z + pointEnd.z);
        // const right1N = new THREE.Vector3().crossVectors(zDown, lineSegmentVector).normalize().multiplyScalar(lineWidth / 2);
        const right1 = new THREE.Vector3(rightN.x + pointEnd.x, rightN.y + pointEnd.y, rightN.z + pointEnd.z);

        vertices.push(...up1.toArray(), ...right1.toArray(), ...down1.toArray(), ...left1.toArray());
        // exColors.push(...colors[i + 1].toArray(), ...colors[i + 1].toArray(), ...colors[i + 1].toArray(), ...colors[i + 1].toArray());
        // exColors1.push(...colors1[i + 1].toArray(), ...colors1[i + 1].toArray(), ...colors1[i + 1].toArray(), ...colors1[i + 1].toArray());
        // exLayerIndices.push(layerIndices[i + 1], layerIndices[i + 1], layerIndices[i + 1], layerIndices[i + 1]);
        // exTypeCodes.push(typeCodes[i + 1], typeCodes[i + 1], typeCodes[i + 1], typeCodes[i + 1]);
        // exToolCodes.push(toolCodes[i + 1], toolCodes[i + 1], toolCodes[i + 1], toolCodes[i + 1]);

        normals.push(...new THREE.Vector3().subVectors(up1, pointEnd).toArray());
        normals.push(...new THREE.Vector3().subVectors(right1, pointEnd).toArray());
        normals.push(...new THREE.Vector3().subVectors(down1, pointEnd).toArray());
        normals.push(...new THREE.Vector3().subVectors(left1, pointEnd).toArray());

        // 封闭起点和终点的竖截面
        if (i === 0) {
            indices.push(...[
                0, 2, 1, 0, 3, 2,
            ].map(index => index + currentIndex));
        }
        if (i + 1 === line.length - 1) {
            indices.push(...[
                4, 5, 6, 4, 6, 7,
            ].map(index => index + currentIndex));
        }

        // 侧边面
        indices.push(...[
            3, 0, 7, 0, 4, 7,
            0, 1, 4, 1, 5, 4,
            1, 2, 5, 2, 6, 5,
            2, 3, 6, 3, 7, 6
        ].map(index => index + currentIndex));

        currentIndex += 8;
    }

    // 拐角补面
    // currentIndex = 4;
    // for (let i = 1; i < line.length - 1; i++) {
    //     const pointStart = line[i - 1];
    //     const pointCenter = line[i];
    //     const pointEnd = line[i + 1];

    //     const sc = new THREE.Vector3().subVectors(pointStart, pointCenter);
    //     const ec = new THREE.Vector3().subVectors(pointEnd, pointCenter);

    //     const normal = new THREE.Vector3().crossVectors(sc, ec);
    //     // console.log('angle', normal, sc, ec, normal.angleTo(zUp));
    //     if (normal.angleTo(zUp) > Math.PI / 2) {
    //         indices.push(...[
    //             0, 1, 5, 2, 5, 1
    //         ].map(index => index + currentIndex));
    //     } else if (normal.angleTo(zUp) < Math.PI / 2) {
    //         indices.push(...[
    //             0, 7, 3, 2, 3, 7
    //         ].map(index => index + currentIndex));
    //     } else {
    //         // console.log('90');
    //     }
    //     currentIndex += 8;
    // }
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    // const exColorsAttr = new THREE.Uint8BufferAttribute(exColors, 3);
    // exColorsAttr.normalized = true;
    // const exColors1Attr = new THREE.Uint8BufferAttribute(exColors, 3);
    // exColors1Attr.normalized = true;
    // geometry.setAttribute('a_color', exColorsAttr);
    // geometry.setAttribute('a_color1', exColors1Attr);
    // geometry.setAttribute('a_layer_index', new THREE.Float32BufferAttribute(exLayerIndices, 1));
    // geometry.setAttribute('a_type_code', new THREE.Float32BufferAttribute(exTypeCodes, 1));
    // geometry.setAttribute('a_tool_code', new THREE.Float32BufferAttribute(exToolCodes, 1));
    // geometry.computeVertexNormals();
    // console.log(vertices, indices, geometry);
    return geometry;
}

const gcodeBufferGeometryToObj3d = (func, bufferGeometry, renderMethod) => {
    let obj3d = null;
    switch (func) {
        case '3DP':
            if (renderMethod === 'mesh') {
                obj3d = new THREE.Mesh(
                    bufferGeometry,
                    new THREE.ShaderMaterial({
                        uniforms: PRINT3D_UNIFORMS,
                        vertexShader: PRINT3D_VERT_SHADER,
                        fragmentShader: PRINT3D_FRAG_SHADER,
                        side: THREE.DoubleSide,
                        transparent: true,
                        linewidth: 10,
                        wireframeLinewidth: 5
                        // wireframe: true
                    })
                );
            } else {
                const gcodeEntityLayers = bufferGeometry;

                const object3D = new THREE.Group();
                gcodeEntityLayers.forEach((layer, index) => {
                    layer.forEach(layerType => {
                        if (layerType.typeCode !== 7) {
                            // console.log('breakPositionsIndex', layerType.breakPositionsIndex);
                            const geometry = lineToGeometry(layerType.positions, layerType.breakPositionsIndex);
                            const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
                                vertexShader: PRINT3D_VERT_SHADER,
                                fragmentShader: PRINT3D_FRAG_SHADER,
                                side: THREE.FrontSide,
                                uniforms: {
                                    color: {
                                        value: layerType.color || 0xffffff,
                                    },
                                    type_code: {
                                        value: layerType.typeCode
                                    },
                                    tool_code: {
                                        value: layerType.toolCode
                                    },
                                    layer: {
                                        value: index
                                    }
                                }
                            }));
                            object3D.add(mesh);
                        } else {
                            // travel should render as a line
                            const geometry = new THREE.BufferGeometry();
                            geometry.setAttribute('position', new THREE.Float32BufferAttribute(layerType.positions), 3);
                            const line = new THREE.Line(geometry, new THREE.ShaderMaterial({
                                vertexShader: PRINT3D_VERT_SHADER,
                                fragmentShader: PRINT3D_FRAG_SHADER,
                                side: THREE.DoubleSide,
                                uniforms: {
                                    color: {
                                        value: layerType.color || 0xffffff,
                                    },
                                    type_code: {
                                        value: layerType.typeCode
                                    },
                                    tool_code: {
                                        value: layerType.toolCode
                                    },
                                    layer: {
                                        value: index
                                    }
                                }
                            }));
                            object3D.add(line);
                        }
                    });
                });

                obj3d = object3D;

                // obj3d = new THREE.Mesh(
                //     geometry,
                //     // bufferGeometry,
                //     new THREE.ShaderMaterial({
                //         uniforms: PRINT3D_UNIFORMS,
                //         vertexShader: PRINT3D_VERT_SHADER,
                //         fragmentShader: PRINT3D_FRAG_SHADER,
                //         side: THREE.DoubleSide,
                //         // transparent: true,
                //         // linewidth: 10,
                //         // wireframeLinewidth: 5
                //     })
                // );
                // console.log(lineToGeometry, bufferGeometry);
                // obj3d = new THREE.Line(
                //     bufferGeometry,
                //     new THREE.ShaderMaterial({
                //         uniforms: PRINT3D_UNIFORMS,
                //         vertexShader: PRINT3D_VERT_SHADER,
                //         fragmentShader: PRINT3D_FRAG_SHADER,
                //         side: THREE.DoubleSide,
                //         transparent: true,
                //         linewidth: 10,
                //         wireframeLinewidth: 5
                //     })
                // );
            }

            break;
        case 'WORKSPACE':
            if (renderMethod === 'point') {
                obj3d = new THREE.Points(
                    bufferGeometry,
                    new THREE.ShaderMaterial({
                        uniforms: WORKSPACE_UNIFORMS,
                        vertexShader: WORKSPACE_VERT_SHADER,
                        fragmentShader: WORKSPACE_FRAG_SHADER,
                        side: THREE.DoubleSide,
                        transparent: true
                    })
                );
            } else {
                obj3d = new THREE.Line(
                    bufferGeometry,
                    new THREE.ShaderMaterial({
                        uniforms: WORKSPACE_UNIFORMS,
                        vertexShader: WORKSPACE_VERT_SHADER,
                        fragmentShader: WORKSPACE_FRAG_SHADER,
                        side: THREE.DoubleSide,
                        transparent: true
                    })
                );
            }
            break;
        default:
            break;
    }
    return obj3d;
};

export default gcodeBufferGeometryToObj3d;
