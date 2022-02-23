export const PRINT3D_UNIFORMS = {
    u_visible_layer_range_start: { value: 0.0 },
    u_visible_layer_range_end: { value: 0.0 },

    u_middle_layer_set_gray: { value: 0 },

    u_color_type: { value: 0 },
    u_l_wall_inner_visible: { value: 1 },
    u_l_wall_outer_visible: { value: 1 },
    u_l_skin_visible: { value: 1 },
    u_l_skirt_visible: { value: 1 },
    u_l_support_visible: { value: 1 },
    u_l_fill_visible: { value: 1 },
    u_l_travel_visible: { value: 0 },
    u_l_unknown_visible: { value: 1 },
    u_r_wall_inner_visible: { value: 1 },
    u_r_wall_outer_visible: { value: 1 },
    u_r_skin_visible: { value: 1 },
    u_r_skirt_visible: { value: 1 },
    u_r_support_visible: { value: 1 },
    u_r_fill_visible: { value: 1 },
    u_r_travel_visible: { value: 0 },
    u_r_unknown_visible: { value: 1 },

};
export const PRINT3D_VERT_SHADER = [
    'const float c_wall_inner_code = 1.0;',
    'const float c_wall_outer_code = 2.0;',
    'const float c_skin_code = 3.0;',
    'const float c_skirt_code = 4.0;',
    'const float c_support_code = 5.0;',
    'const float c_fill_code = 6.0;',
    'const float c_travel_code = 7.0;',
    'const float c_unknown_code = 8.0;',

    'uniform float u_visible_layer_range_start;',
    'uniform float u_visible_layer_range_end;',

    'uniform int u_middle_layer_set_gray;',

    'uniform int u_color_type;',
    'uniform int u_l_wall_inner_visible;',
    'uniform int u_l_wall_outer_visible;',
    'uniform int u_l_skin_visible;',
    'uniform int u_l_skirt_visible;',
    'uniform int u_l_support_visible;',
    'uniform int u_l_fill_visible;',
    'uniform int u_l_travel_visible;',
    'uniform int u_l_unknown_visible;',
    'uniform int u_r_wall_inner_visible;',
    'uniform int u_r_wall_outer_visible;',
    'uniform int u_r_skin_visible;',
    'uniform int u_r_skirt_visible;',
    'uniform int u_r_support_visible;',
    'uniform int u_r_fill_visible;',
    'uniform int u_r_travel_visible;',
    'uniform int u_r_unknown_visible;',

    'varying vec3 v_color0;',
    'varying vec3 v_color1;',
    'varying float v_layer_index;',
    'varying float v_type_code;',
    'varying float v_tool_code;',

    'attribute float a_layer_index;',
    'attribute float a_type_code;',
    'attribute float a_tool_code;',
    'attribute vec3 a_color;',
    'attribute vec3 a_color1;',

    'void main(){',
    '    v_layer_index = a_layer_index;',
    '    v_type_code = a_type_code;',
    '    v_tool_code = a_tool_code;',
    '    v_color0 = a_color;',
    '    v_color1 = a_color1;',
    // '    gl_PointSize = 5.0;',

    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
].join('');
export const PRINT3D_FRAG_SHADER = [

    'uniform float u_visible_layer_range_start;',
    'uniform float u_visible_layer_range_end;',

    'uniform int u_middle_layer_set_gray;',

    'uniform int u_color_type;',
    'uniform int u_l_wall_inner_visible;',
    'uniform int u_l_wall_outer_visible;',
    'uniform int u_l_skin_visible;',
    'uniform int u_l_skirt_visible;',
    'uniform int u_l_support_visible;',
    'uniform int u_l_fill_visible;',
    'uniform int u_l_travel_visible;',
    'uniform int u_l_unknown_visible;',
    'uniform int u_r_wall_inner_visible;',
    'uniform int u_r_wall_outer_visible;',
    'uniform int u_r_skin_visible;',
    'uniform int u_r_skirt_visible;',
    'uniform int u_r_support_visible;',
    'uniform int u_r_fill_visible;',
    'uniform int u_r_travel_visible;',
    'uniform int u_r_unknown_visible;',

    'varying vec3 v_color0;',
    'varying vec3 v_color1;',
    'varying float v_layer_index;',
    'varying float v_type_code;',
    'varying float v_tool_code;',

    'void main(){',
    '    if(v_layer_index > u_visible_layer_range_end){',
    // '        gl_FragColor = vec4(0.87, 0.87, 0.87, 0.75);',
    '        return;',
    '    }',

    '    if(v_layer_index < u_visible_layer_range_start){',
    // '        gl_FragColor = vec4(0.87, 0.87, 0.87, 0.75);',
    '        return;',
    '    }',

    '    if(u_l_wall_inner_visible == 0 && 0.5 < v_type_code && v_type_code < 1.5 && v_tool_code < 0.5){',
    '        discard;',
    '    }',

    '    if(u_l_wall_outer_visible == 0 && 1.5 < v_type_code && v_type_code < 2.5 && v_tool_code < 0.5){',
    '        discard;',
    '    }',

    '    if(u_l_skin_visible == 0 && 2.5 < v_type_code && v_type_code < 3.5 && v_tool_code < 0.5){',
    '        discard;',
    '    }',

    '    if(u_l_skirt_visible == 0 && 3.5 < v_type_code && v_type_code < 4.5 && v_tool_code < 0.5){',
    '        discard;',
    '    }',

    '    if(u_l_support_visible == 0 && 4.5 < v_type_code && v_type_code < 5.5 && v_tool_code < 0.5){',
    '        discard;',
    '    }',

    '    if(u_l_fill_visible == 0 && 5.5 < v_type_code && v_type_code < 6.5 && v_tool_code < 0.5){',
    '        discard;',
    '    }',

    '    if(u_l_travel_visible == 0 && 6.5 < v_type_code && v_type_code < 7.5 && v_tool_code < 0.5){',
    '        discard;',
    '    }',

    '    if(u_l_unknown_visible == 0 && 7.5 < v_type_code && v_type_code < 8.5 && v_tool_code < 0.5){',
    '        discard;',
    '    }',

    '    if(u_r_wall_inner_visible == 0 && 0.5 < v_type_code && v_type_code < 1.5 && v_tool_code > 0.5){',
    '        discard;',
    '    }',

    '    if(u_r_wall_outer_visible == 0 && 1.5 < v_type_code && v_type_code < 2.5 && v_tool_code > 0.5){',
    '        discard;',
    '    }',

    '    if(u_r_skin_visible == 0 && 2.5 < v_type_code && v_type_code < 3.5 && v_tool_code > 0.5){',
    '        discard;',
    '    }',

    '    if(u_r_skirt_visible == 0 && 3.5 < v_type_code && v_type_code < 4.5 && v_tool_code > 0.5){',
    '        discard;',
    '    }',

    '    if(u_r_support_visible == 0 && 4.5 < v_type_code && v_type_code < 5.5 && v_tool_code > 0.5){',
    '        discard;',
    '    }',

    '    if(u_r_fill_visible == 0 && 5.5 < v_type_code && v_type_code < 6.5 && v_tool_code > 0.5){',
    '        discard;',
    '    }',

    '    if(u_r_travel_visible == 0 && 6.5 < v_type_code && v_type_code < 7.5 && v_tool_code > 0.5){',
    '        discard;',
    '    }',

    '    if(u_r_unknown_visible == 0 && 7.5 < v_type_code && v_type_code < 8.5 && v_tool_code > 0.5){',
    '        discard;',
    '    }',
    '    if(u_middle_layer_set_gray == 1){',
    '        if(v_layer_index == u_visible_layer_range_end){',
    '           gl_FragColor = vec4(v_color0.xyz, 1.0);',
    '        } else {',
    '           gl_FragColor = vec4(0.6, 0.6, 0.6, 0.75);',
    '        }',
    '        return;',
    '    }',
    '    gl_FragColor = vec4(v_color0.xyz, 1.0);',
    '    if(u_color_type == 1 && !(6.5 < v_type_code && v_type_code < 7.5)){',
    '        gl_FragColor = vec4(v_color1.xyz, 1.0);',
    '    }',
    '}'
].join('');
