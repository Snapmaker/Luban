export const WORKSPACE_UNIFORMS = {
    u_visible_index_count: { value: 0.0 }
};
export const WORKSPACE_VERT_SHADER = [
    'precision lowp float;',
    'uniform float u_visible_index_count;',

    'varying vec3 v_color;',
    'varying vec3 v_index_color;',
    'varying float v_index;',

    'attribute float a_index;',
    'attribute vec3 a_color;',
    'attribute vec3 a_index_color;',

    'void main(){',
    '    v_index = a_index;',
    '    v_index_color = a_index_color;',
    '    v_color = a_color;',
    '    gl_PointSize = 1.0;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
].join('');
export const WORKSPACE_FRAG_SHADER = [
    'precision lowp float;',
    'uniform float u_visible_index_count;',

    'varying vec3 v_color;',
    'varying vec3 v_index_color;',
    'varying float v_index;',

    'void main(){',
    '    if(v_index < u_visible_index_count){',
    '        gl_FragColor = vec4(v_index_color.xyz, 1.0);',
    '    } else {',
    '        gl_FragColor = vec4(v_color.xyz, 1.0);',
    '    }',
    '}'
].join('');
