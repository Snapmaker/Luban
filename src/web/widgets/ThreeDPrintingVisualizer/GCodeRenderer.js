/* eslint-disable */

import * as THREE from "three";

const UNIFORMS = {
    u_visible_layer_count: { value: 0.0 },
    u_wall_inner_visible: { value: 1 },
    u_wall_outer_visible: { value: 1 },
    u_skin_visible: { value: 1 },
    u_skirt_visible: { value: 1 },
    u_support_visible: { value: 1 },
    u_fill_visible: { value: 1 },
    u_travel_visible: { value: 1 },
    u_unknown_visible: { value: 1 }
};
// const VERTEX_SHADER_PATH = './3dp_gcode_vertex.shader';
// const FRAGMENT_SHADER_PATH = './3dp_gcode_frag.shader';

const VERTEX_SHADER_PATH = 'images/3dp/shader/3dp_gcode_vert.shader';
const FRAGMENT_SHADER_PATH = 'images/3dp/shader/3dp_gcode_frag.shader';

THREE.GCodeRenderer = function () {
    const scope = this;

    this.material = undefined;
    // use deep copy
    this.uniforms = JSON.parse(JSON.stringify(UNIFORMS));

    this.loadShader = function () {
        var vertexShader = undefined;
        var fragmentShader = undefined;
        var fileLoader = new THREE.FileLoader();
        fileLoader.load(
            VERTEX_SHADER_PATH,
            function (data) {
                vertexShader = data;
                console.log('vertexShader:' + vertexShader);
                fileLoader.load(
                    FRAGMENT_SHADER_PATH,
                    function (data) {
                        fragmentShader = data;
                        scope.material = new THREE.ShaderMaterial({
                            uniforms: scope.uniforms,
                            vertexShader: vertexShader,
                            fragmentShader: fragmentShader,
                            side: THREE.DoubleSide,
                            transparent: true,
                            linewidth: 1
                        });
                        console.log('fragmentShader:' + fragmentShader);
                    }
                );
            }
        );
    }
    this.init = function(dataObj) {
        // dataObj is from .gcode.json
        this.layerHeight = dataObj.layerHeight;
        this.unit = dataObj.unit;
        this.coordinate = dataObj.coordinate;
        this.bounds = dataObj.bounds;
        this.order = dataObj.order;
        this.points = dataObj.points;
        this.typeCodes = dataObj.typeCodes;

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

    this.showLayers = function(visibleCount) {
        visibleCount = (visibleCount < 0 ? 0 : visibleCount);
        visibleCount = (visibleCount > this.layerCount ? this.layerCount : visibleCount);
        visibleCount = Math.floor(visibleCount);
        if (this.visibleLayerCount !== visibleCount) {
            this.visibleLayerCount = visibleCount;
            this.uniforms.u_visible_layer_count.value = this.visibleLayerCount;
        }
    }

    this.showType = function(type) {
        type = type.toUpperCase().trim();
        if (this.typeSettings[type] && (this.typeSettings[type].visible === false)) {
            this.typeSettings[type].visible = true;
            updateTypeVisibility(type, 1);
        }
    }

    this.hideType = function(type) {
        type = type.toUpperCase().trim();
        if (this.typeSettings[type] && (this.typeSettings[type].visible === true)) {
            this.typeSettings[type].visible = false;
            updateTypeVisibility(type, 0);
        }
    }

    // Attention : switch y <====> z
    // vertexBuffer.push(new THREE.Vector3(this.state.x, this.state.z, -this.state.y));
    this.render = function(dataObj) {
        this.init(dataObj);

        const colors = [];
        const positions = [];
        const layerIndexs = [];
        const typeCodes = [];

        // first point
        const p0 = this.points[0];
        const typeCode0 = p0[3];
        const typeSetting0 = getTypeSetting(typeCode0);

        var layerIndex = 1;
        var height = p0[2];
        var lastTypeCode = typeCode0;

        positions.push(p0[0]);
        positions.push(p0[2]);
        positions.push(-p0[1]);
        colors.push(typeSetting0.rgb[0]);
        colors.push(typeSetting0.rgb[1]);
        colors.push(typeSetting0.rgb[2]);

        layerIndexs.push(layerIndex);
        typeCodes.push(typeCode0);

        for (var i = 1; i < this.points.length; i++) {
            const point = this.points[i];
            const typeCode = point[3];

            // height change means layer changes
            if (height !== point[2]) {
                height = point[2];
                ++layerIndex;
                console.log('index: ' + layerIndex + ' height: ' + height);
            }

            const typeSetting = getTypeSetting(typeCode);
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

        return {
            layerCount: this.layerCount,
            visibleLayerCount: this.visibleLayerCount,
            typeInitialVisibility: typeInitialVisibility,
            bounds: this.bounds,
            line: new THREE.Line(bufferGeometry, this.material)
        };
    }

    var updateTypeVisibility = function(type, value) {
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

    var getTypeSetting = function(typeCode) {
        for (var key in scope.typeSettings) {
            if (scope.typeSettings[key].typeCode === typeCode) {
                return scope.typeSettings[key];
            }
        }
        return null;
    }
}

export default THREE.GCodeRenderer;
