import * as THREE from 'three';
import { DEFAULT_LUBAN_HOST } from '../../constants';

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
    texture: {
        type: 't',
        value: new THREE.TextureLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/wood.png`)
    }

};
export const PRINT3D_VERT_SHADER = `
precision lowp float;
varying vec3 v_normal;
// varying vec3 v_eye_vector;

void main(){
    // vec4 vertex = vec4(position, 1.0);
    // vec4 vertex = viewMatrix * vec4(position, 1.0);
    v_normal = normal;
    // v_normal = normalMatrix * normal;
    // v_eye_vector = vec3(vertex);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
export const PRINT3D_FRAG_SHADER = `
precision lowp float;
uniform int u_visible_layer_range_start;
uniform int u_visible_layer_range_end;

uniform int u_middle_layer_set_gray;

uniform int u_color_type;
uniform int u_l_wall_inner_visible;
uniform int u_l_wall_outer_visible;
uniform int u_l_skin_visible;
uniform int u_l_skirt_visible;
uniform int u_l_support_visible;
uniform int u_l_fill_visible;
uniform int u_l_travel_visible;
uniform int u_l_unknown_visible;
uniform int u_r_wall_inner_visible;
uniform int u_r_wall_outer_visible;
uniform int u_r_skin_visible;
uniform int u_r_skirt_visible;
uniform int u_r_support_visible;
uniform int u_r_fill_visible;
uniform int u_r_travel_visible;
uniform int u_r_unknown_visible;

varying vec3 v_normal;
// varying vec3 v_eye_vector;

uniform vec3 u_color_extruder;
uniform vec3 u_color_line_type;
uniform int u_type_code;
uniform int u_tool_code;
uniform int u_layer_index;

void main(){
    if(u_layer_index > u_visible_layer_range_end){
        discard;
    }

    if(u_layer_index < u_visible_layer_range_start){
        discard;
    }

    if(u_l_wall_inner_visible == 0 && u_type_code == 1 && u_tool_code == 0){
        discard;
    }

    if(u_l_wall_outer_visible == 0 && u_type_code == 2 && u_tool_code == 0){
        discard;
    }

    if(u_l_skin_visible == 0 && u_type_code == 3 && u_tool_code == 0){
        discard;
    }

    if(u_l_skirt_visible == 0 && u_type_code == 4 && u_tool_code == 0){
        discard;
    }

    if(u_l_support_visible == 0 && u_type_code == 5 && u_tool_code == 0){
        discard;
    }

    if(u_l_fill_visible == 0 && u_type_code == 6 && u_tool_code == 0){
        discard;
    }

    if(u_l_travel_visible == 0 && u_type_code == 7 && u_tool_code == 0){
        discard;
    }

    if(u_l_unknown_visible == 0 && u_type_code == 8 && u_tool_code == 0){
        discard;
    }

    if(u_r_wall_inner_visible == 0 && u_type_code == 1 && u_tool_code == 1){
        discard;
    }

    if(u_r_wall_outer_visible == 0 && u_type_code == 2 && u_tool_code == 1){
        discard;
    }

    if(u_r_skin_visible == 0 && u_type_code == 3 && u_tool_code == 1){
        discard;
    }

    if(u_r_skirt_visible == 0 && u_type_code == 4 && u_tool_code == 1){
        discard;
    }

    if(u_r_support_visible == 0 && u_type_code == 5 && u_tool_code == 1){
        discard;
    }

    if(u_r_fill_visible == 0 && u_type_code == 6 && u_tool_code == 1){
        discard;
    }

    if(u_r_travel_visible == 0 && u_type_code == 7 && u_tool_code == 1){
        discard;
    }

    if(u_r_unknown_visible == 0 && u_type_code == 8 && u_tool_code == 1){
        discard;
    }
    if (u_type_code == 7) {
        gl_FragColor = vec4(u_color_line_type, 1.0);
        return;
    }

    // float shininess = 60.0;
    float light_ambient = 0.5;
    float light_diffuse = 1.0;
    // float light_specular = 1.0;
    vec3 light_direction = cameraPosition - v_normal;

    vec4 material_ambient = vec4(0.0);
    vec4 material_diffuse = vec4(0.0);
    // vec4 material_specular = vec4(0.0);

    if(u_middle_layer_set_gray == 1){
        if(u_layer_index != u_visible_layer_range_end){
           material_diffuse = vec4(0.6, 0.6, 0.6, 0.75);
        } else {
           material_diffuse = vec4(u_color_line_type, 1.0);
           if(u_color_type == 1){
               material_diffuse = vec4(u_color_extruder, 1.0);
           }
       }
    } else {
        material_diffuse = vec4(u_color_line_type, 1.0);
        if(u_color_type == 1){
            material_diffuse = vec4(u_color_extruder, 1.0);
        }
    }

    // https://en.wikipedia.org/wiki/Phong_shading
    material_ambient = vec4(material_diffuse);
    // material_specular = vec4(material_diffuse);
    material_diffuse = vec4(material_diffuse);

    vec3 L = normalize(light_direction);
    vec3 N = normalize(v_normal);
    float lambert_term = dot(N, L);

    vec4 Ia = light_ambient * material_ambient;
    vec4 Id = vec4(0.0, 0.0, 0.0, 1.0);
    vec4 Is = vec4(0.0, 0.0, 0.0, 1.0);

    if (lambert_term > 0.0) {
        Id = light_diffuse * material_diffuse * lambert_term;
        // vec3 E = normalize(-v_eye_vector);
        // vec3 R = reflect(-L, N);
        // float specular = pow(max(dot(R, E), 0.0), shininess);
        // Is = light_specular * material_specular * specular;
    }
    gl_FragColor = vec4(vec3(Ia + Id), 1.0);
}`;
