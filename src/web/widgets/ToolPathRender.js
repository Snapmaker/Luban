import * as THREE from 'three';

const motionColor = {
    'G0': new THREE.Color(0xc8c8c8),
    'G1': new THREE.Color(0x000000),
    'unknown': new THREE.Color(0x000000)
};

class ToolPathRender {
    render(string) {
        const toolPathObj = JSON.parse(string);
        const { type, mode } = toolPathObj.metadata;
        const data = toolPathObj.data;

        // now only support cnc&laser
        if (!['cnc', 'laser'].includes(type)) {
            return null;
        }
        if (mode === 'greyscale') {
            return this._parseToPoints(data);
        } else {
            return this._parseToLine(data);
        }
    }

    _parseToLine(data) {
        const geometry = new THREE.Geometry();
        const material = new THREE.LineBasicMaterial({
            linewidth: 1,
            vertexColors: THREE.VertexColors,
            opacity: 1,
            transparent: true
        });
        let state = {
            G: 0,
            X: 0,
            Y: 0,
            Z: 0
        };
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const newState = { ...state };
            item.G !== undefined && (newState.G = item.G);
            item.X !== undefined && (newState.X = item.X);
            item.Y !== undefined && (newState.Y = item.Y);
            item.Z !== undefined && (newState.Z = item.Z);

            if (state.G !== newState.G) {
                // G changed, add data of pre vertex of current color
                geometry.vertices.push(new THREE.Vector3(state.X, state.Y, state.Z));
                if (newState.G === 0) {
                    geometry.colors.push(motionColor.G0);
                } else if (newState.G === 1) {
                    geometry.colors.push(motionColor.G1);
                } else {
                    geometry.colors.push(motionColor.unknown);
                }
            }

            if (state.G !== newState.G ||
                state.X !== newState.X ||
                state.Y !== newState.Y ||
                state.Z !== newState.Z) {
                state = newState;
                geometry.vertices.push(new THREE.Vector3(state.X, state.Y, state.Z));
                if (state.G === 0) {
                    geometry.colors.push(motionColor.G0);
                } else if (state.G === 1) {
                    geometry.colors.push(motionColor.G1);
                } else {
                    geometry.colors.push(motionColor.unknown);
                }
            }
        }
        return new THREE.Line(geometry, material);
    }

    _parseToPoints(data) {
        const geometry = new THREE.Geometry();
        const material = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: THREE.VertexColors,
            opacity: 0.9,
            transparent: true
        });
        let state = {
            G: 0,
            X: 0,
            Y: 0,
            Z: 0
        };
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const newState = { ...state };
            item.G !== undefined && (newState.G = item.G);
            item.X !== undefined && (newState.X = item.X);
            item.Y !== undefined && (newState.Y = item.Y);
            item.Z !== undefined && (newState.Z = item.Z);

            if (state.G !== newState.G ||
                state.X !== newState.X ||
                state.Y !== newState.Y ||
                state.Z !== newState.Z) {
                state = newState;
                geometry.vertices.push(new THREE.Vector3(state.X, state.Y, state.Z));
                if (state.G === 0) {
                    geometry.colors.push(motionColor.G0);
                } else if (state.G === 1) {
                    geometry.colors.push(motionColor.G1);
                } else {
                    geometry.colors.push(motionColor.unknown);
                }
            }
        }
        return new THREE.Points(geometry, material);
    }
}

export default ToolPathRender;
