const float c_wall_inner_code = 1.0;
const float c_wall_outer_code = 2.0;
const float c_skin_code = 3.0;
const float c_skirt_code = 4.0;
const float c_support_code = 5.0;
const float c_fill_code = 6.0;
const float c_travel_code = 7.0;
const float c_unknown_code = 8.0;

uniform float u_visible_layer_count;

uniform int u_wall_inner_visible;
uniform int u_wall_outer_visible;
uniform int u_skin_visible;
uniform int u_skirt_visible;
uniform int u_support_visible;
uniform int u_fill_visible;
uniform int u_travel_visible;
uniform int u_unknown_visible;

varying vec3 v_color;
varying float v_layer_index;
varying float v_type_code;

void main(){
    if(v_layer_index > u_visible_layer_count){
        discard;
    }

    if(u_wall_inner_visible == 0 && v_type_code == c_wall_inner_code){
        discard;
    }

    if(u_wall_outer_visible == 0 && v_type_code == c_wall_outer_code){
        discard;
    }

    if(u_skin_visible == 0 && v_type_code == c_skin_code){
        discard;
    }

    if(u_skirt_visible == 0 && v_type_code == c_skirt_code){
        discard;
    }

    if(u_support_visible == 0 && v_type_code == c_support_code){
        discard;
    }

    if(u_fill_visible == 0 && v_type_code == c_fill_code){
        discard;
    }

    if(u_travel_visible == 0 && v_type_code == c_travel_code){
        discard;
    }

    if(u_unknown_visible == 0 && v_type_code == c_unknown_code){
        discard;
    }

    gl_FragColor = vec4(v_color.xyz, 1.0);
}