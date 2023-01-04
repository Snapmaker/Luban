// import * as THREE from 'three';
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
    gcodeEntityLayers = {};

    // Attention : switch y <====> z
    // vertexBuffer.push(new THREE.Vector3(this.state.x, this.state.z, -this.state.y));
    parse(gcode, extruderColors, onParsed = noop, onProgress = noop, onError = noop) {
        if (isEmpty(gcode)) {
            onError(new Error('gcode is empty'));
            return;
        }

        // const colors = [];
        // const colors1 = [];
        // const positions = [];
        // const layerIndices = [];
        // const typeCodes = [];
        // const toolCodes = [];

        const bounds = {
            minX: Number.MAX_VALUE,
            maxX: Number.MIN_VALUE,
            minY: Number.MAX_VALUE,
            maxY: Number.MIN_VALUE,
            minZ: Number.MAX_VALUE,
            maxZ: Number.MIN_VALUE
        };

        // const { toolColor0, toolColor1 } = extruderColors; // extruderColors = { toolColor0: '#FFFFFF', toolColor1: '#000000' }
        // console.log(toolColor0, toolColor1);
        // let r0, b0, g0, r1, b1, g1;
        // if (toolColor0.length === 7) {
        //     r0 = parseInt(toolColor0.substring(1, 3), 16);
        //     g0 = parseInt(toolColor0.substring(3, 5), 16);
        //     b0 = parseInt(toolColor0.substring(5), 16);
        // } else {
        //     r0 = 255;
        //     b0 = 255;
        //     g0 = 255;
        // }
        // if (toolColor1.length === 7) {
        //     r1 = parseInt(toolColor1.substring(1, 3), 16);
        //     g1 = parseInt(toolColor1.substring(3, 5), 16);
        //     b1 = parseInt(toolColor1.substring(5), 16);
        // } else {
        //     r1 = 0;
        //     b1 = 0;
        //     g1 = 0;
        // }
        // const toolColorRGB0 = [r0, g0, b0];
        // const toolColorRGB1 = [r1, g1, b1];

        let layerIndex = 0;
        let lastTypeCode = null;
        let lastToolCode = null;
        let lastLayerIndex = null;
        let lastPosition = null;

        let progress = 0;

        const toolPath = new ToolPath({
            addLine: (modal, v1, v2) => {
                const typeCode = v2.type;
                const toolCode = modal.tool;
                // const typeSetting = this.getTypeSetting(typeCode);
                layerIndex = modal.layer;
                // const rgb = [
                //     typeSetting.rgb[0],
                //     typeSetting.rgb[1],
                //     typeSetting.rgb[2]
                // ];

                // duplicate one point to display without interpolation
                // color of end point decides line color
                // p1       p2      p3  --> p1#p1`       p2#p2`      p3
                // red      green   red --> red#green    green#red   red
                // if type changes then push "last position & current color"
                if (!lastTypeCode) {
                    lastTypeCode = typeCode;
                }
                if (lastToolCode === null) {
                    lastToolCode = toolCode;
                }
                if (lastLayerIndex === null) {
                    lastLayerIndex = layerIndex;
                }

                if (lastTypeCode !== typeCode || lastLayerIndex !== layerIndex) {
                    this.setGcodeLayerInfoBreak(lastLayerIndex, lastTypeCode, lastToolCode);

                    lastTypeCode = typeCode;
                    lastLayerIndex = layerIndex;
                    lastToolCode = toolCode;

                    this.addGcodeLayerInfo(layerIndex, typeCode, toolCode, lastPosition);
                }

                lastPosition = {
                    x: v2.x, y: v2.y, z: v2.z
                };
                // positions.push(v2.x);
                // positions.push(v2.y);
                // positions.push(v2.z);

                // colors.push(rgb[0]);
                // colors.push(rgb[1]);
                // colors.push(rgb[2]);

                // layerIndices.push(layerIndex);
                // typeCodes.push(typeCode);
                // toolCodes.push(toolCode);
                // // console.log('toolCode', toolCode);
                // if (toolCode === 0) {
                //     colors1.push(toolColorRGB0[0]);
                //     colors1.push(toolColorRGB0[1]);
                //     colors1.push(toolColorRGB0[2]);
                // } else {
                //     colors1.push(toolColorRGB1[0]);
                //     colors1.push(toolColorRGB1[1]);
                //     colors1.push(toolColorRGB1[2]);
                // }

                this.addGcodeLayerInfo(layerIndex, typeCode, toolCode, v2);

                if (
                    modal.gcodeType === 'start'
                    && (v1.x !== v2.x || v1.y !== v2.y || v1.z !== v2.z)
                    // TODO, calculate bounds after start
                    && (v1.x > -10 && v1.y > -10)
                ) {
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

        const layerCount = layerIndex + 1;
        onProgress(0.9);

        // const bufferGeometry = new THREE.BufferGeometry();
        // const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
        // const colorAttribute = new THREE.Uint8BufferAttribute(colors, 3);
        // // this will map the buffer values to 0.0f - +1.0f in the shader
        // colorAttribute.normalized = true;
        // const color1Attribute = new THREE.Uint8BufferAttribute(colors1, 3);
        // // this will map the buffer values to 0.0f - +1.0f in the shader
        // color1Attribute.normalized = true;
        // const layerIndexAttribute = new THREE.Float32BufferAttribute(layerIndices, 1);
        // const typeCodeAttribute = new THREE.Float32BufferAttribute(typeCodes, 1);
        // const toolCodeAttribute = new THREE.Float32BufferAttribute(toolCodes, 1);

        // bufferGeometry.setAttribute('position', positionAttribute);
        // bufferGeometry.setAttribute('a_color', colorAttribute);
        // bufferGeometry.setAttribute('a_color1', color1Attribute);
        // bufferGeometry.setAttribute('a_layer_index', layerIndexAttribute);
        // bufferGeometry.setAttribute('a_type_code', typeCodeAttribute);
        // bufferGeometry.setAttribute('a_tool_code', toolCodeAttribute);

        // onParsed(bufferGeometry, layerCount, bounds);
        onParsed(this.gcodeEntityLayers, layerCount, bounds);
    }

    getTypeSetting(typeCode) {
        for (const key of Object.keys(TYPE_SETTINGS)) {
            if (TYPE_SETTINGS[key].typeCode === typeCode) {
                return TYPE_SETTINGS[key];
            }
        }
        return null;
    }

    addGcodeLayerInfo(layerIndex, typeCode, toolCode, v2) {
        if (typeCode === 7 && layerIndex < 0) { // hack for Raft adhesion
            layerIndex = 0;
        }
        if (!this.gcodeEntityLayers[layerIndex]) {
            this.gcodeEntityLayers[layerIndex] = [];
        }
        const typeInLayerFound = this.gcodeEntityLayers[layerIndex].find(typeInLayer => {
            return typeInLayer.toolCode === toolCode && typeInLayer.typeCode === typeCode;
        });
        if (typeInLayerFound) {
            typeInLayerFound.positions.push(v2.x, v2.y, v2.z);
        } else {
            this.gcodeEntityLayers[layerIndex].push({
                typeCode: typeCode,
                toolCode: toolCode,
                color: this.getTypeSetting(typeCode)?.rgb.map(color => color / 255),
                breakPositionsIndex: [],
                positions: [v2.x, v2.y, v2.z]
            });
        }
    }

    setGcodeLayerInfoBreak(layerIndex, typeCode, toolCode) {
        if (typeCode === 7 && layerIndex < 0) { // hack for Raft adhesion
            layerIndex = 0;
        }
        const typeInLayerFound = this.gcodeEntityLayers[layerIndex].find(typeInLayer => {
            return typeInLayer.toolCode === toolCode && typeInLayer.typeCode === typeCode;
        });
        if (typeInLayerFound) {
            typeInLayerFound.breakPositionsIndex.push(typeInLayerFound.positions.length / 3 - 1);
        }
    }
}

export default GcodeToBufferGeometryPrint3d;
