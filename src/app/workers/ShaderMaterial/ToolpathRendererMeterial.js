import * as THREE from 'three';

export const UNIFORMS = {
    // rgba
    u_g1_color: new THREE.Uniform(new THREE.Vector4(0, 0, 0, 1)),
    u_select_color: new THREE.Uniform(new THREE.Vector4(0.156, 0.655, 0.882, 1))
};

export const CNC_LASER_VERT_SHADER = [
    'varying float v_g_code;',
    'attribute float a_g_code;',
    'void main(){',
    '    v_g_code = a_g_code;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '    gl_PointSize = 1.0;',
    '}'
].join('');

export const CNC_LASER_FRAG_UNSELECT_SHADER = [
    'uniform vec4 u_g1_color;',
    'varying float v_g_code;',
    'void main(){',
    '    if(v_g_code == 0.0){',
    '        discard;',
    '    }',
    '    gl_FragColor = u_g1_color;',
    '}'
].join('');

export const CNC_LASER_FRAG_SELECT_SHADER = [
    'uniform vec4 u_select_color;',
    'varying float v_g_code;',
    'void main(){',
    '    if(v_g_code == 0.0){',
    '        discard;',
    '    }',
    '    gl_FragColor = u_select_color;',
    '}'
].join('');

export const MATERIAL_UNSELECTED = new THREE.ShaderMaterial({
    uniforms: UNIFORMS,
    vertexShader: CNC_LASER_VERT_SHADER,
    fragmentShader: CNC_LASER_FRAG_UNSELECT_SHADER,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    linewidth: 1
});
export const MATERIAL_SELECTED = new THREE.ShaderMaterial({
    uniforms: UNIFORMS,
    vertexShader: CNC_LASER_VERT_SHADER,
    fragmentShader: CNC_LASER_FRAG_SELECT_SHADER,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    linewidth: 1
});
