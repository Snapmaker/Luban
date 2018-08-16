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

attribute float a_layer_index;
attribute float a_type_code;
attribute vec3 a_color;

void main(){
    v_layer_index = a_layer_index;
    v_type_code = a_type_code;
    v_color = a_color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}