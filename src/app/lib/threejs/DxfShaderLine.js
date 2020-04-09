import * as THREE from 'three';

const UNIFORMS = {
};
const VERT_SHADER = [
    'varying vec4 v_color;',
    'attribute vec4 a_color;',

    'void main(){',
    '    v_color = a_color;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
].join('');
const FRAG_SHADER = [
    'varying vec4 v_color;',

    'void main(){',
    '    gl_FragColor = vec4(v_color.xyzw);',
    '}'
].join('');


class DxfShader {
    static Line(bufferGeometry) {
        return new THREE.Line(
            bufferGeometry,
            new THREE.ShaderMaterial({
                uniforms: UNIFORMS,
                vertexShader: VERT_SHADER,
                fragmentShader: FRAG_SHADER,
                side: THREE.DoubleSide,
                transparent: true
            })
        );
    }
}

export default DxfShader;
