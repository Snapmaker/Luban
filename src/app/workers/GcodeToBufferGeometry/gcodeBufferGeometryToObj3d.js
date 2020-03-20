import * as THREE from 'three';
import { PRINT3D_UNIFORMS, PRINT3D_VERT_SHADER, PRINT3D_FRAG_SHADER } from '../ShaderMaterial/print3d-shader-meterial';
import { WORKSPACE_UNIFORMS, WORKSPACE_FRAG_SHADER, WORKSPACE_VERT_SHADER } from '../ShaderMaterial/workspace-shader-meterial';


const gcodeBufferGeometryToObj3d = (func, bufferGeometry, renderMethod) => {
    let obj3d = null;
    switch (func) {
        case '3DP':
            obj3d = new THREE.Line(
                bufferGeometry,
                new THREE.ShaderMaterial({
                    uniforms: PRINT3D_UNIFORMS,
                    vertexShader: PRINT3D_VERT_SHADER,
                    fragmentShader: PRINT3D_FRAG_SHADER,
                    side: THREE.DoubleSide,
                    transparent: true
                })
            );
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
