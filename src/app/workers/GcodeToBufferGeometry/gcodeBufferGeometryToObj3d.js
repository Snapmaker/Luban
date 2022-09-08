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

function lineToGeometry(originalPositions, breakPositionsIndex, width, height) {
    const line = elementToVector3(originalPositions);
    const zUp = new THREE.Vector3(0, 0, 1), zDown = new THREE.Vector3(0, 0, -1);
    const vertices = [], indices = [], normals = [];
    const halfHeight = height / 2;
    const halfWidth = width / 2;
    const zDownHalfHeightVec = zDown.normalize().multiplyScalar(halfHeight);

    let currentIndex = 0;
    for (let i = 0; i < line.length - 1; i++) {
        if (breakPositionsIndex.indexOf(i) > -1) {
            /**
             * add faces for break points
             * .______________.     ._____.   <- line
             * ^              ^           ^
             * start point   break point  end point
             * */
            indices.push(...[
                4, 5, 6, 4, 6, 7,
            ].map(index => index + currentIndex - 8));
            continue;
        }
        if (breakPositionsIndex.indexOf(i - 1) > -1) {
            indices.push(...[
                0, 2, 1, 0, 3, 2,
            ].map(index => index + currentIndex));
        }
        const pointStart = line[i];
        const pointEnd = line[i + 1];
        const lineSegmentVector = new THREE.Vector3().subVectors(pointEnd, pointStart);
        const pointStartDownHalfHeightVec = new THREE.Vector3().addVectors(pointStart, zDownHalfHeightVec);
        const pointEndDownHalfHeightVec = new THREE.Vector3().addVectors(pointEnd, zDownHalfHeightVec);

        // point start expanded 4 points
        const down = new THREE.Vector3().addVectors(pointStart, zDownHalfHeightVec).add(zDownHalfHeightVec);
        const up = new THREE.Vector3().addVectors(pointStart, zUp.normalize().multiplyScalar(halfHeight)).add(zDownHalfHeightVec);
        const leftN = new THREE.Vector3().crossVectors(zUp, lineSegmentVector).normalize().multiplyScalar(halfWidth);
        const left = new THREE.Vector3().addVectors(leftN, pointStart).add(zDownHalfHeightVec);
        const rightN = new THREE.Vector3().crossVectors(zDown, lineSegmentVector).normalize().multiplyScalar(halfWidth);
        const right = new THREE.Vector3().addVectors(rightN, pointStart).add(zDownHalfHeightVec);

        // same as CSS top right down left
        vertices.push(...up.toArray(), ...right.toArray(), ...down.toArray(), ...left.toArray());

        normals.push(...new THREE.Vector3().subVectors(up, pointStartDownHalfHeightVec).toArray());
        normals.push(...new THREE.Vector3().subVectors(right, pointStartDownHalfHeightVec).toArray());
        normals.push(...new THREE.Vector3().subVectors(down, pointStartDownHalfHeightVec).toArray());
        normals.push(...new THREE.Vector3().subVectors(left, pointStartDownHalfHeightVec).toArray());

        // point end expanded 4 points
        const down1 = new THREE.Vector3().addVectors(pointEnd, zDownHalfHeightVec).add(zDownHalfHeightVec);
        const up1 = new THREE.Vector3().addVectors(pointEnd, zUp.normalize().multiplyScalar(halfHeight)).add(zDownHalfHeightVec);
        const left1 = new THREE.Vector3().addVectors(leftN, pointEnd).add(zDownHalfHeightVec);
        const right1 = new THREE.Vector3().addVectors(rightN, pointEnd).add(zDownHalfHeightVec);

        vertices.push(...up1.toArray(), ...right1.toArray(), ...down1.toArray(), ...left1.toArray());

        normals.push(...new THREE.Vector3().subVectors(up1, pointEndDownHalfHeightVec).toArray());
        normals.push(...new THREE.Vector3().subVectors(right1, pointEndDownHalfHeightVec).toArray());
        normals.push(...new THREE.Vector3().subVectors(down1, pointEndDownHalfHeightVec).toArray());
        normals.push(...new THREE.Vector3().subVectors(left1, pointEndDownHalfHeightVec).toArray());

        // generate faces for start and end points
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

        // generate faces
        indices.push(...[
            3, 0, 7, 0, 4, 7,
            0, 1, 4, 1, 5, 4,
            1, 2, 5, 2, 6, 5,
            2, 3, 6, 3, 7, 6
        ].map(index => index + currentIndex));

        currentIndex += 8;
    }

    currentIndex = 4;
    for (let i = 1; i < line.length - 1; i++) {
        if (breakPositionsIndex.indexOf(i) > -1) {
            currentIndex += 8;
            continue;
        }
        if (breakPositionsIndex.indexOf(i - 1) > -1) {
            continue;
        }
        /**
         * calculate the relative position between sc and ec, then decide which side should add faces
         *        center
         *         /\
         *       /   \
         *     /      \
         * start      end
         */
        const pointStart = line[i - 1];
        const pointCenter = line[i];
        const pointEnd = line[i + 1];

        const sc = new THREE.Vector3().subVectors(pointStart, pointCenter);
        const ec = new THREE.Vector3().subVectors(pointEnd, pointCenter);

        const normal = new THREE.Vector3().crossVectors(sc, ec);
        // console.log('angle', normal, sc, ec, normal.angleTo(zUp));
        if (normal.angleTo(zUp) > Math.PI / 2) {
            indices.push(...[
                0, 1, 5, 2, 5, 1
            ].map(index => index + currentIndex));
        } else if (normal.angleTo(zUp) < Math.PI / 2) {
            indices.push(...[
                0, 7, 3, 2, 3, 7
            ].map(index => index + currentIndex));
        } else {
            // console.log('90');
        }
        currentIndex += 8;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geometry;
}

const gcodeBufferGeometryToObj3d = (func, gcodeEntityLayers, renderMethod, params) => {
    let obj3d = null;
    switch (func) {
        case '3DP': {
            const object3D = new THREE.Group();
            const r0 = parseInt(params.extruderColors.toolColor0.substring(1, 3), 16) / 0xff;
            const g0 = parseInt(params.extruderColors.toolColor0.substring(3, 5), 16) / 0xff;
            const b0 = parseInt(params.extruderColors.toolColor0.substring(5), 16) / 0xff;

            const r1 = parseInt(params.extruderColors.toolColor1.substring(1, 3), 16) / 0xff;
            const g1 = parseInt(params.extruderColors.toolColor1.substring(3, 5), 16) / 0xff;
            const b1 = parseInt(params.extruderColors.toolColor1.substring(5), 16) / 0xff;

            let positions = [], index = 0, width = 0, height = 0, segmentPositions = [];

            Object.entries(gcodeEntityLayers).forEach(([indexKey, layer]) => {
                index = Number(indexKey);
                layer.forEach(layerType => {
                    if (layerType.typeCode !== 7) {
                        width = 0;
                        height = params.layerHeight;
                        if (layerType.toolCode === 0) {
                            width = params.extruderLlineWidth;
                            if (index === 0) {
                                width = params.extruderLlineWidth0;
                                height = params.layerHeight0;
                            }
                        } else {
                            width = params.extruderRlineWidth;
                            if (index === 0) {
                                width = params.extruderRlineWidth0;
                                height = params.layerHeight0;
                            }
                        }
                        // console.log('breakPositionsIndex', layerType.breakPositionsIndex);
                        const geometry = lineToGeometry(layerType.positions, layerType.breakPositionsIndex, width, height);

                        const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
                            vertexShader: PRINT3D_VERT_SHADER,
                            fragmentShader: PRINT3D_FRAG_SHADER,
                            side: THREE.FrontSide,
                            uniforms: {
                                ...PRINT3D_UNIFORMS,
                                u_color_extruder: {
                                    value: layerType.toolCode === 0 ? [r0, g0, b0] : [r1, g1, b1],
                                },
                                u_color_line_type: {
                                    value: layerType.color,
                                },
                                u_type_code: {
                                    value: layerType.typeCode
                                },
                                u_tool_code: {
                                    value: layerType.toolCode
                                },
                                u_layer_index: {
                                    value: index
                                }
                            },
                            depthTest: true,
                            depthWrite: true,
                            extensions: {
                                derivatives: true,
                                fragDepth: true,
                                drawBuffers: true
                            }
                        }));
                        object3D.add(mesh);
                    } else {
                        // travel should render as a line
                        positions = null;
                        positions = elementToVector3(layerType.positions);
                        segmentPositions = [];
                        for (let i = 0; i < positions.length - 1; i++) {
                            if (layerType.breakPositionsIndex.indexOf(i) > -1) {
                                continue;
                            }
                            segmentPositions.push(...positions[i].toArray(), ...positions[i + 1].toArray());
                        }
                        const geometry = new THREE.BufferGeometry();

                        geometry.setAttribute('position', new THREE.Float32BufferAttribute(segmentPositions, 3));
                        const line = new THREE.LineSegments(geometry, new THREE.ShaderMaterial({
                            vertexShader: PRINT3D_VERT_SHADER,
                            fragmentShader: PRINT3D_FRAG_SHADER,
                            uniforms: {
                                ...PRINT3D_UNIFORMS,
                                u_color_extruder: {
                                    value: layerType.color,
                                },
                                u_color_line_type: {
                                    value: layerType.color,
                                },
                                u_type_code: {
                                    value: layerType.typeCode
                                },
                                u_tool_code: {
                                    value: layerType.toolCode
                                },
                                u_layer_index: {
                                    value: index
                                }
                            }
                        }));
                        object3D.add(line);
                    }
                });
            });

            gcodeEntityLayers = null;
            obj3d = object3D;
        }

            break;
        case 'WORKSPACE':
            if (renderMethod === 'point') {
                obj3d = new THREE.Points(
                    gcodeEntityLayers,
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
                    gcodeEntityLayers,
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
