import * as THREE from 'three';
import isEmpty from 'lodash/isEmpty';
import noop from 'lodash/noop';
import ToolPath from '../../../shared/lib/gcodeToolPath';

const TYPE_SETTINGS = {
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

class GcodeToBufferGeometryPrint3d {
    // Attention : switch y <====> z
    // vertexBuffer.push(new THREE.Vector3(this.state.x, this.state.z, -this.state.y));
    parse(gcode, onParsed = noop, onProgress = noop, onError = noop) {
        if (isEmpty(gcode)) {
            onError(new Error('gcode is empty'));
            return;
        }

        const colors = [];
        const positions = [];
        const layerIndices = [];
        const typeCodes = [];

        const bounds = {
            minX: Number.MAX_VALUE,
            maxX: Number.MIN_VALUE,
            minY: Number.MAX_VALUE,
            maxY: Number.MIN_VALUE,
            minZ: Number.MAX_VALUE,
            maxZ: Number.MIN_VALUE
        };

        let layerIndex = 0;
        let height = null;
        let lastTypeCode = null;

        let progress = 0;

        const toolPath = new ToolPath({
            addLine: (modal, v1, v2) => {
                const typeCode = v2.type;
                const typeSetting = this.getTypeSetting(typeCode);

                // height change means layer changes
                if (height !== v2.z) {
                    height = v2.z;
                    ++layerIndex;
                }

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
                if (!lastTypeCode) {
                    lastTypeCode = typeCode;
                }
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

                    layerIndices.push(layerIndex);
                    typeCodes.push(typeCode);
                }

                positions.push(v2.x);
                positions.push(v2.z);
                positions.push(-v2.y);

                colors.push(rgb[0]);
                colors.push(rgb[1]);
                colors.push(rgb[2]);

                layerIndices.push(layerIndex);
                typeCodes.push(typeCode);

                if (modal.gcodeType === 'start' && (v1.x !== v2.x || v1.y !== v2.y || v1.z !== v2.z)) {
                    bounds.minX = Math.min(v2.x, bounds.minX);
                    bounds.minY = Math.min(v2.y, bounds.minY);
                    bounds.minZ = Math.min(v2.z, bounds.minZ);

                    bounds.maxX = Math.max(v2.x, bounds.maxX);
                    bounds.maxY = Math.max(v2.y, bounds.maxY);
                    bounds.maxZ = Math.max(v2.z, bounds.maxZ);
                }
            }
        });

        toolPath.loadFromStringSync(gcode, (line, i, length) => {
            const curProgress = i / length;
            if ((curProgress - progress > 0.01)) {
                progress = curProgress;
                onProgress(progress);
            }
        });

        const layerCount = layerIndex;
        onProgress(1);

        const bufferGeometry = new THREE.BufferGeometry();
        const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
        const colorAttribute = new THREE.Uint8BufferAttribute(colors, 3);
        // this will map the buffer values to 0.0f - +1.0f in the shader
        colorAttribute.normalized = true;
        const layerIndexAttribute = new THREE.Float32BufferAttribute(layerIndices, 1);
        const typeCodeAttribute = new THREE.Float32BufferAttribute(typeCodes, 1);

        bufferGeometry.addAttribute('position', positionAttribute);
        bufferGeometry.addAttribute('a_color', colorAttribute);
        bufferGeometry.addAttribute('a_layer_index', layerIndexAttribute);
        bufferGeometry.addAttribute('a_type_code', typeCodeAttribute);

        onParsed(bufferGeometry, layerCount, bounds);
    }

    getTypeSetting(typeCode) {
        for (const key of Object.keys(TYPE_SETTINGS)) {
            if (TYPE_SETTINGS[key].typeCode === typeCode) {
                return TYPE_SETTINGS[key];
            }
        }
        return null;
    }
}

export default GcodeToBufferGeometryPrint3d;
