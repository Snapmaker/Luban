import { Geometry, Line, LineBasicMaterial, Object3D, Quaternion, Vector3 } from 'three';
import ThreeUtils from '../../../scene/three-extensions/ThreeUtils';

const BLUE = 0x00b7ee;

class Peripheral extends Object3D {
    object = null;

    constructor(object) {
        super();
        this.object = object;

        this.initFramePeripherals();
    }

    initFramePeripherals() {
        // dashed line frame
        const geometry = new Geometry();
        // FIXME: preset vertices, or dynamic update will not work. (three.js bug?)
        const points = [];
        points.push(new Vector3(0, 0, 0));
        points.push(new Vector3(0, 0, 0));
        points.push(new Vector3(0, 0, 0));
        points.push(new Vector3(0, 0, 0));
        points.push(new Vector3(0, 0, 0));

        geometry.vertices = points;

        const material = new LineBasicMaterial({
            color: BLUE,
            // https://threejs.org/docs/index.html?q=LineDashedMaterial#api/en/materials/LineBasicMaterial
            linewidth: 2
            // dashSize: 2,
            // gapSize: 1
        });
        const frame = new Line(geometry, material);
        // frame.computeLineDistances(); // ?

        this.framePeripheral = this.createPeripheral([
            ['frame', frame]
        ]);
        this.add(this.framePeripheral);
    }

    createPeripheral(definitions) {
        const peripheral = new Object3D();

        for (const definition of definitions) {
            const [label, object, position, rotation, scale] = definition;
            object.label = label;

            if (position) {
                object.position.set(position[0], position[1], position[2]);
            }

            if (rotation) {
                object.rotation.set(rotation[0], rotation[1], rotation[2]);
            }

            if (scale) {
                object.scale.set(scale[0], scale[1], scale[2]);
            }

            // place the geometry natural at origin
            object.updateMatrix();
            object.geometry.applyMatrix4(object.matrix);

            object.position.set(0, 0, 0);
            object.rotation.set(0, 0, 0);
            object.scale.set(1, 1, 1);

            peripheral.add(object);
        }

        return peripheral;
    }

    updateMatrixWorld(force) {
        if (this.object) {
            // object
            const objectPosition = new Vector3();
            const objectQuaternion = new Quaternion();
            const objectScale = new Vector3();

            this.object.updateMatrixWorld();
            this.object.matrixWorld.decompose(objectPosition, objectQuaternion, objectScale);

            const size = ThreeUtils.getGeometrySize(this.object.geometry, true);
            const width = size.x * objectScale.x;
            const height = size.y * objectScale.y;

            // const eyeDistance = this.camera.position.z;

            // Update peripherals
            const peripherals = [this.framePeripheral];
            for (const peripheral of peripherals) {
                peripheral.position.copy(objectPosition);
                peripheral.position.z = 0.1;
                peripheral.quaternion.copy(objectQuaternion);
            }

            { // this.framePeripheral
                const offset = 0.1;
                const offsetOutside = 0.5;
                const line = this.framePeripheral.children[0];
                const geometry = line.geometry; // new THREE.Geometry();
                geometry.vertices = [];
                for (let i = 0.1; i <= offsetOutside; i += offset) {
                    geometry.vertices.push(new Vector3(width / 2 + i, height / 2 + i, 0));
                    geometry.vertices.push(new Vector3(-width / 2 - i, height / 2 + i, 0));
                    geometry.vertices.push(new Vector3(-width / 2 - i, -height / 2 - i, 0));
                    geometry.vertices.push(new Vector3(width / 2 + i, -height / 2 - i, 0));
                    geometry.vertices.push(new Vector3(width / 2 + i, height / 2 + i, 0));
                }

                geometry.verticesNeedUpdate = true;
                line.computeLineDistances();
            }
        }

        super.updateMatrixWorld(force);
    }
}

export default Peripheral;
