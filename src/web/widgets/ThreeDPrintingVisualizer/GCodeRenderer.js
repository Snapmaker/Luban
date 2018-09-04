import * as THREE from 'three';

const SHADER = {
    uniforms: {
        u_visible_layer_count: { value: 0.0 },
        u_wall_inner_visible: { value: 1 },
        u_wall_outer_visible: { value: 1 },
        u_skin_visible: { value: 1 },
        u_skirt_visible: { value: 1 },
        u_support_visible: { value: 1 },
        u_fill_visible: { value: 1 },
        u_travel_visible: { value: 1 },
        u_unknown_visible: { value: 1 }
    },
    vertexShader: [
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
        'v_layer_index = a_layer_index;',
        'v_type_code = a_type_code;',
        'v_color = a_color;',
        'gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
    ].join('\n'),
    fragmentShader: [
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
        'if(v_layer_index > u_visible_layer_count){',
        'discard;',
        '}',

        'if(u_wall_inner_visible == 0 && v_type_code == c_wall_inner_code){',
        'discard;',
        '}',

        'if(u_wall_outer_visible == 0 && v_type_code == c_wall_outer_code){',
        'discard;',
        '}',

        'if(u_skin_visible == 0 && v_type_code == c_skin_code){',
        'discard;',
        '}',

        'if(u_skirt_visible == 0 && v_type_code == c_skirt_code){',
        'discard;',
        '}',

        'if(u_support_visible == 0 && v_type_code == c_support_code){',
        'discard;',
        '}',

        'if(u_fill_visible == 0 && v_type_code == c_fill_code){',
        'discard;',
        '}',

        'if(u_travel_visible == 0 && v_type_code == c_travel_code){',
        'discard;',
        '}',

        'if(u_unknown_visible == 0 && v_type_code == c_unknown_code){',
        'discard;',
        '}',

        'gl_FragColor = vec4(v_color.xyz, 1.0);',
        '}'
    ].join('\n')
};

class GCodeRenderer {
    init(dataObj) {
        // data in json
        this.layerHeight = dataObj.layerHeight;
        this.unit = dataObj.unit;
        this.coordinate = dataObj.coordinate;
        this.bounds = dataObj.bounds;
        this.order = dataObj.order;
        this.points = dataObj.points;
        this.typeCodes = dataObj.typeCodes;

        // use deep copy
        this.uniforms = JSON.parse(JSON.stringify(SHADER.uniforms));

        this.layerCount = 0;
        this.visibleLayerCount = 0;
        this.typeSettings = {
            'WALL-INNER': {
                rgb: [0, 255, 0],
                visible: true,
                typeCode: 1
            },
            'WALL-OUTER': {
                rgb: [255, 33, 33],
                visible: true,
                typeCode: 2
            },
            'SKIN': {
                rgb: [255, 255, 0],
                visible: true,
                typeCode: 3
            },
            'SKIRT': {
                rgb: [250, 140, 53],
                visible: true,
                typeCode: 4
            },
            'SUPPORT': {
                rgb: [75, 0, 130],
                visible: true,
                typeCode: 5
            },
            'FILL': {
                rgb: [141, 75, 187],
                visible: true,
                typeCode: 6
            },
            'TRAVEL': {
                rgb: [68, 206, 246],
                visible: true,
                typeCode: 7
            },
            'UNKNOWN': {
                rgb: [75, 0, 130],
                visible: true,
                typeCode: 8
            }
        };
    }

    showLayers (visibleCount) {
        visibleCount = (visibleCount < 0 ? 0 : visibleCount);
        visibleCount = (visibleCount > this.layerCount ? this.layerCount : visibleCount);
        visibleCount = Math.floor(visibleCount);
        if (this.visibleLayerCount !== visibleCount) {
            this.visibleLayerCount = visibleCount;
            this.uniforms.u_visible_layer_count.value = this.visibleLayerCount;
        }
    }

    showType(type) {
        type = type.toUpperCase().trim();
        if (this.typeSettings[type] && (this.typeSettings[type].visible === false)) {
            this.typeSettings[type].visible = true;
            this.updateTypeVisibility(type, 1);
        }
    }

    hideType (type) {
        type = type.toUpperCase().trim();
        if (this.typeSettings[type] && (this.typeSettings[type].visible === true)) {
            this.typeSettings[type].visible = false;
            this.updateTypeVisibility(type, 0);
        }
    }

    // Attention : switch y <====> z
    // vertexBuffer.push(new THREE.Vector3(this.state.x, this.state.z, -this.state.y));
    render (dataObj) {
        this.init(dataObj);

        const colors = [];
        const positions = [];
        const layerIndexs = [];
        const typeCodes = [];

        // first point
        const p0 = this.points[0];
        const typeCode0 = p0[3];
        const typeSetting0 = this.getTypeSetting(typeCode0);

        let layerIndex = 1;
        let height = p0[2];
        let lastTypeCode = typeCode0;

        positions.push(p0[0]);
        positions.push(p0[2]);
        positions.push(-p0[1]);
        colors.push(typeSetting0.rgb[0]);
        colors.push(typeSetting0.rgb[1]);
        colors.push(typeSetting0.rgb[2]);

        layerIndexs.push(layerIndex);
        typeCodes.push(typeCode0);

        for (let i = 1; i < this.points.length; i++) {
            const point = this.points[i];
            const typeCode = point[3];

            // layer changes
            if (height !== point[2]) {
                height = point[2];
                ++layerIndex;
            }

            const typeSetting = this.getTypeSetting(typeCode);
            const rgb = [
                typeSetting.rgb[0],
                typeSetting.rgb[1],
                typeSetting.rgb[2]
            ];

            // duplicate one point to display without interpolation
            // color of end point decides line color
            // p1       p2      p3  --> p1#p1`       p2#p2`      p3
            // red      green   red --> red#green    green#red   red
            // if type changes then push "last position & current color"
            if (lastTypeCode !== typeCode) {
                lastTypeCode = typeCode;

                // use: last position + current color + current layer index + current type code
                const lastZ = positions[positions.length - 1];
                const lastY = positions[positions.length - 2];
                const lastX = positions[positions.length - 3];
                positions.push(lastX);
                positions.push(lastY);
                positions.push(lastZ);

                colors.push(rgb[0]);
                colors.push(rgb[1]);
                colors.push(rgb[2]);

                layerIndexs.push(layerIndex);
                typeCodes.push(typeCode);
            }

            positions.push(point[0]);
            positions.push(point[2]);
            positions.push(-point[1]);

            colors.push(rgb[0]);
            colors.push(rgb[1]);
            colors.push(rgb[2]);

            layerIndexs.push(layerIndex);
            typeCodes.push(typeCode);
        }

        this.layerCount = layerIndex;

        const bufferGeometry = new THREE.BufferGeometry();
        const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
        const colorAttribute = new THREE.Uint8BufferAttribute(colors, 3);
        // this will map the buffer values to 0.0f - +1.0f in the shader
        colorAttribute.normalized = true;
        const layerIndexAttribute = new THREE.Float32BufferAttribute(layerIndexs, 1);
        const typeCodeAttribute = new THREE.Float32BufferAttribute(typeCodes, 1);

        bufferGeometry.addAttribute('position', positionAttribute);
        bufferGeometry.addAttribute('a_color', colorAttribute);
        bufferGeometry.addAttribute('a_layer_index', layerIndexAttribute);
        bufferGeometry.addAttribute('a_type_code', typeCodeAttribute);

        const typeInitialVisibility = {}; // {'WALL-INNER' : true, 'WALL-OUTER': true, .... }
        for (const key in this.typeSettings) {
            if (Object.prototype.hasOwnProperty.call(this.typeSettings, key)) {
                typeInitialVisibility[key] = this.typeSettings[key].visible;
            }
        }

        // default show all layers and all types
        this.showLayers(this.layerCount);

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: SHADER.vertexShader,
            fragmentShader: SHADER.fragmentShader,
            side: THREE.DoubleSide,
            transparent: true,
            linewidth: 1
        });

        return {
            layerCount: this.layerCount,
            visibleLayerCount: this.visibleLayerCount,
            typeInitialVisibility: typeInitialVisibility,
            bounds: this.bounds,
            line: new THREE.Line(bufferGeometry, material)
        };
    }

    updateTypeVisibility (type, value) {
        switch (type) {
            case 'WALL-INNER':
                this.uniforms.u_wall_inner_visible.value = value;
                break;
            case 'WALL-OUTER':
                this.uniforms.u_wall_outer_visible.value = value;
                break;
            case 'SKIN':
                this.uniforms.u_skin_visible.value = value;
                break;
            case 'SKIRT':
                this.uniforms.u_skirt_visible.value = value;
                break;
            case 'SUPPORT':
                this.uniforms.u_support_visible.value = value;
                break;
            case 'FILL':
                this.uniforms.u_fill_visible.value = value;
                break;
            case 'TRAVEL':
                this.uniforms.u_travel_visible.value = value;
                break;
            case 'UNKNOWN':
                this.uniforms.u_unknown_visible.value = value;
                break;
            default:
                break;
        }
    }

    getTypeSetting (typeCode) {
        for (const key in this.typeSettings) {
            if (this.typeSettings[key].typeCode === typeCode) {
                return this.typeSettings[key];
            }
        }
        return null;
    }
}

export default GCodeRenderer;
