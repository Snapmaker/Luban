import * as THREE from 'three';

const VERTEX_SHADER_PATH = 'images/3dp/shader/3dp_gcode_vert.shader';
const FRAGMENT_SHADER_PATH = 'images/3dp/shader/3dp_gcode_frag.shader';

const UNIFORMS = {
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

class GCodeRenderer {
    constructor() {
        // correspond to *.gcode.json
        this.layerHeight = null;
        this.unit = null;
        this.coordinate = null;
        this.bounds = null;
        this.order = null;
        this.points = null;
        this.typeCodes = null;

        this.material = null;
        // use deep copy
        this.uniforms = JSON.parse(JSON.stringify(UNIFORMS));

        this.gcodeTypeVisibility = {};
        this.layerCount = 0;
        this.visibleLayerCount = 0;
        this.typeSettings = {
            'WALL-INNER': {
                rgb: [0, 255, 0],
                typeCode: 1
            },
            'WALL-OUTER': {
                rgb: [255, 33, 33],
                typeCode: 2
            },
            'SKIN': {
                rgb: [255, 255, 0],
                typeCode: 3
            },
            'SKIRT': {
                rgb: [250, 140, 53],
                typeCode: 4
            },
            'SUPPORT': {
                rgb: [75, 0, 130],
                typeCode: 5
            },
            'FILL': {
                rgb: [141, 75, 187],
                typeCode: 6
            },
            'TRAVEL': {
                rgb: [68, 206, 246],
                typeCode: 7
            },
            'UNKNOWN': {
                rgb: [75, 0, 130],
                typeCode: 8
            }
        };
    }

    loadShaderMaterial() {
        if (this.material) {
            return;
        }
        let vertexShader, fragmentShader;
        let fileLoader = new THREE.FileLoader();
        fileLoader.load(
            VERTEX_SHADER_PATH,
            (data) => {
                vertexShader = data;
                fileLoader.load(
                    FRAGMENT_SHADER_PATH,
                    (data) => {
                        fragmentShader = data;
                        this.material = new THREE.ShaderMaterial({
                            uniforms: this.uniforms,
                            vertexShader: vertexShader,
                            fragmentShader: fragmentShader,
                            side: THREE.DoubleSide,
                            transparent: true,
                            linewidth: 1
                        });
                    }
                );
            }
        );
    }

    showLayers(visibleCount) {
        visibleCount = (visibleCount < 0 ? 0 : visibleCount);
        visibleCount = (visibleCount > this.layerCount ? this.layerCount : visibleCount);
        visibleCount = Math.floor(visibleCount);
        if (this.visibleLayerCount !== visibleCount) {
            this.visibleLayerCount = visibleCount;
            this.uniforms.u_visible_layer_count.value = this.visibleLayerCount;
        }
    }

    showType(type) {
        this._updateUniforms(type.toUpperCase().trim(), 1);
        this._updateDisplayTypes();
    }

    hideType(type) {
        this._updateUniforms(type.toUpperCase().trim(), 0);
        this._updateDisplayTypes();
    }

    // Attention : switch y <====> z
    // vertexBuffer.push(new THREE.Vector3(this.state.x, this.state.z, -this.state.y));
    render(dataObj) {
        this.layerHeight = dataObj.layerHeight;
        this.unit = dataObj.unit;
        this.coordinate = dataObj.coordinate;
        this.bounds = dataObj.bounds;
        this.order = dataObj.order;
        this.points = dataObj.points;
        this.typeCodes = dataObj.typeCodes;

        const colors = [];
        const positions = [];
        const layerIndexs = [];
        const typeCodes = [];

        // first point
        const p0 = this.points[0];
        const typeCode0 = p0[3];
        const typeSetting0 = this._getTypeSetting(typeCode0);

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

            // height change means layer changes
            if (height !== point[2]) {
                height = point[2];
                ++layerIndex;
            }

            const typeSetting = this._getTypeSetting(typeCode);
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

        // default: show all layers and all types except travel
        this.showLayers(this.layerCount);
        this._updateDisplayTypes();

        return {
            layerCount: this.layerCount,
            visibleLayerCount: this.visibleLayerCount,
            gcodeTypeVisibility: this.gcodeTypeVisibility,
            bounds: this.bounds,
            line: new THREE.Line(bufferGeometry, this.material)
        };
    }

    _getTypeSetting(typeCode) {
        for (let key in this.typeSettings) {
            if (this.typeSettings[key].typeCode === typeCode) {
                return this.typeSettings[key];
            }
        }
        return null;
    }

    _updateUniforms(type, value) {
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

    _updateDisplayTypes() {
        const keys = Object.keys(this.uniforms);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const visible = this.uniforms[key].value === 1;
            switch (key) {
                case 'u_wall_inner_visible':
                    this.gcodeTypeVisibility['WALL-INNER'] = visible;
                    break;
                case 'u_wall_outer_visible':
                    this.gcodeTypeVisibility['WALL-OUTER'] = visible;
                    break;
                case 'u_skin_visible':
                    this.gcodeTypeVisibility.SKIN = visible;
                    break;
                case 'u_skirt_visible':
                    this.gcodeTypeVisibility.SKIRT = visible;
                    break;
                case 'u_support_visible':
                    this.gcodeTypeVisibility.SUPPORT = visible;
                    break;
                case 'u_fill_visible':
                    this.gcodeTypeVisibility.FILL = visible;
                    break;
                case 'u_travel_visible':
                    this.gcodeTypeVisibility.TRAVEL = visible;
                    break;
                case 'u_unknown_visible':
                    this.gcodeTypeVisibility.UNKNOWN = visible;
                    break;
                default:
                    break;
            }
        }
    }
}

export default GCodeRenderer;
