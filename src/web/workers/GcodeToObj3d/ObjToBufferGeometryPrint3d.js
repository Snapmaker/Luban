import * as THREE from 'three';
import isEmpty from 'lodash/isEmpty';
import noop from 'lodash/noop';

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

class ObjToBufferGeometryPrint3d {
    // Attention : switch y <====> z
    // vertexBuffer.push(new THREE.Vector3(this.state.x, this.state.z, -this.state.y));
    parse(gcodeObj, onParsed = noop, onProgress = noop, onError = noop) {
        if (isEmpty(gcodeObj)) {
            onError(new Error('gcodeObj is empty'));
            return;
        }

        const { points } = gcodeObj;

        if (isEmpty(points)) {
            onError(new Error('points of gcodeObj is empty'));
            return;
        }

        let layerCount = 0;
        const colors = [];
        const positions = [];
        const layerIndices = [];
        const typeCodes = [];

        const p0 = points[0];
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

        layerIndices.push(layerIndex);
        typeCodes.push(typeCode0);
        let progress = 0;
        const pointsLength = points.length;
        for (let i = 1; i < pointsLength; i++) {
            const point = points[i];
            const typeCode = point[3];

            // height change means layer changes
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

                layerIndices.push(layerIndex);
                typeCodes.push(typeCode);
            }

            positions.push(point[0]);
            positions.push(point[2]);
            positions.push(-point[1]);

            colors.push(rgb[0]);
            colors.push(rgb[1]);
            colors.push(rgb[2]);

            layerIndices.push(layerIndex);
            typeCodes.push(typeCode);

            // progress
            const curProgress = i / pointsLength;
            if ((curProgress - progress > 0.01)) {
                progress = curProgress;
                onProgress(progress);
            }
        }

        layerCount = layerIndex;
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

        onParsed(bufferGeometry, layerCount);
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

export default ObjToBufferGeometryPrint3d;
