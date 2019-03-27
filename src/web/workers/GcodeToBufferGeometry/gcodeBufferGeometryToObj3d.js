import * as THREE from 'three';

const PRINT3D_UNIFORMS = {
    u_visible_layer_count: { value: 0.0 },
    u_wall_inner_visible: { value: 1 },
    u_wall_outer_visible: { value: 1 },
    u_skin_visible: { value: 1 },
    u_skirt_visible: { value: 1 },
    u_support_visible: { value: 1 },
    u_fill_visible: { value: 1 },
    u_travel_visible: { value: 0 },
    u_unknown_visible: { value: 1 }
};
const PRINT3D_VERT_SHADER = [
    'const float c_wall_inner_code = 1.0;',
    'const float c_wall_outer_code = 2.0;',
    'const float c_skin_code = 3.0;',
    'const float c_skirt_code = 4.0;',
    'const float c_support_code = 5.0;',
    'const float c_fill_code = 6.0;',
    'const float c_travel_code = 7.0;',
    'const float c_unknown_code = 8.0;',

    'uniform float u_visible_layer_count;',

    'uniform int u_wall_inner_visible;',
    'uniform int u_wall_outer_visible;',
    'uniform int u_skin_visible;',
    'uniform int u_skirt_visible;',
    'uniform int u_support_visible;',
    'uniform int u_fill_visible;',
    'uniform int u_travel_visible;',
    'uniform int u_unknown_visible;',

    'varying vec3 v_color;',
    'varying float v_layer_index;',
    'varying float v_type_code;',

    'attribute float a_layer_index;',
    'attribute float a_type_code;',
    'attribute vec3 a_color;',

    'void main(){',
    '    v_layer_index = a_layer_index;',
    '    v_type_code = a_type_code;',
    '    v_color = a_color;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
].join('');
const PRINT3D_FRAG_SHADER = [
    'const float c_wall_inner_code = 1.0;',
    'const float c_wall_outer_code = 2.0;',
    'const float c_skin_code = 3.0;',
    'const float c_skirt_code = 4.0;',
    'const float c_support_code = 5.0;',
    'const float c_fill_code = 6.0;',
    'const float c_travel_code = 7.0;',
    'const float c_unknown_code = 8.0;',

    'uniform float u_visible_layer_count;',

    'uniform int u_wall_inner_visible;',
    'uniform int u_wall_outer_visible;',
    'uniform int u_skin_visible;',
    'uniform int u_skirt_visible;',
    'uniform int u_support_visible;',
    'uniform int u_fill_visible;',
    'uniform int u_travel_visible;',
    'uniform int u_unknown_visible;',

    'varying vec3 v_color;',
    'varying float v_layer_index;',
    'varying float v_type_code;',

    'void main(){',
    '    if(v_layer_index > u_visible_layer_count){',
    '        discard;',
    '    }',

    '    if(u_wall_inner_visible == 0 && v_type_code == c_wall_inner_code){',
    '        discard;',
    '    }',

    '    if(u_wall_outer_visible == 0 && v_type_code == c_wall_outer_code){',
    '        discard;',
    '    }',

    '    if(u_skin_visible == 0 && v_type_code == c_skin_code){',
    '        discard;',
    '    }',

    '    if(u_skirt_visible == 0 && v_type_code == c_skirt_code){',
    '        discard;',
    '    }',

    '    if(u_support_visible == 0 && v_type_code == c_support_code){',
    '        discard;',
    '    }',

    '    if(u_fill_visible == 0 && v_type_code == c_fill_code){',
    '        discard;',
    '    }',

    '    if(u_travel_visible == 0 && v_type_code == c_travel_code){',
    '        discard;',
    '    }',

    '    if(u_unknown_visible == 0 && v_type_code == c_unknown_code){',
    '        discard;',
    '    }',

    '    gl_FragColor = vec4(v_color.xyz, 1.0);',
    '}'
].join('');

// const CNC_LASER_UNIFORMS = {
//     // rgba
//     u_g1_color: new THREE.Uniform(new THREE.Vector4(0, 0, 0, 1))
// };
// const CNC_LASER_VERT_SHADER = [
//     'varying float v_g_code;',
//     'attribute float a_g_code;',
//     'void main(){',
//     '    v_g_code = a_g_code;',
//     '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
//     '}'
// ].join('');
// const CNC_LASER_FRAG_SHADER = [
//     'uniform vec4 u_g1_color;',
//     'varying float v_g_code;',
//     'void main(){',
//     '    if(v_g_code == 0.0){',
//     '        discard;',
//     '    }',
//     '    gl_FragColor = u_g1_color;',
//     '}'
// ].join('');

const gcodeBufferGeometryToObj3d = (func, bufferGeometry) => {
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
        default:
            break;
    }
    return obj3d;
};

export default gcodeBufferGeometryToObj3d;
