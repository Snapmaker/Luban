import {
    Vector3, Quaternion, Matrix4,
    Object3D, Raycaster,
    Mesh, Line,
    BufferGeometry, BoxBufferGeometry, PlaneBufferGeometry, CylinderBufferGeometry, OctahedronBufferGeometry, TorusBufferGeometry,
    MeshBasicMaterial, LineBasicMaterial,
    Float32BufferAttribute, DoubleSide
} from 'three';
import { ArcBufferGeometry } from './ArcGeometry';

const EVENTS = {
    UPDATE: { type: 'update' }
};

/**
 * TransformControls
 *
 * Interfaces:
 *  - mode: translate, rotate, scale
 *  - constructor(camera)
 *  - addEventListener()
 *  - onMouseHover()
 *  - onMouseDown()
 *  - onMouseMove()
 *  - onMouseUp()
 *  - attach()
 *  - detach()
 */
class TransformControls extends Object3D {
    camera = null;

    object = null;

    _mode = 'translate';

    _axis = null;

    // ray for intersect calculation
    ray = new Raycaster();

    dragging = false;

    // (local space)
    positionStart = new Vector3();

    quaternionStart = new Quaternion();

    scaleStart = new Vector3();

    // (world space)

    objectQuaternionInv = new Quaternion();

    parentPosition = new Vector3();

    parentQuaternion = new Quaternion();

    parentQuaternionInv = new Quaternion();

    parentScale = new Vector3();

    // Mouse down point which intersects with plane (world space)
    pointStart = new Vector3();

    pointEnd = new Vector3();

    constructor(camera) {
        super();

        this.camera = camera;
        this.visible = false;

        this.initDefaults();
        this.initTranslatePeripherals();
        this.initRotatePeripherals();
        this.initScalePeripherals();
        this.initPlane();
        this.destroyDefaults();
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
            object.geometry.applyMatrix(object.matrix);

            object.position.set(0, 0, 0);
            object.rotation.set(0, 0, 0);
            object.scale.set(1, 1, 1);

            peripheral.add(object);
        }

        return peripheral;
    }

    initDefaults() {
        // geometries
        const lineGeometry = new BufferGeometry();
        lineGeometry.addAttribute('position', new Float32BufferAttribute([0, 0, 0, 10, 0, 0], 3));

        // materials
        const meshMaterial = new MeshBasicMaterial({
            depthTest: false,
            depthWrite: false,
            transparent: true,
            side: DoubleSide,
            fog: false
        });

        const lineMaterial = new LineBasicMaterial({
            depthTest: false,
            depthWrite: false,
            transparent: true,
            linewidth: 1,
            fog: false
        });

        const RED = 0xe93100;
        const GREEN = 0x22ac38;
        const BLUE = 0x00b7ee;
        const GRAY = 0x787878;

        const meshMaterialRed = meshMaterial.clone();
        meshMaterialRed.color.set(RED);

        const meshMaterialGreen = meshMaterial.clone();
        meshMaterialGreen.color.set(GREEN);

        const meshMaterialBlue = meshMaterial.clone();
        meshMaterialBlue.color.set(BLUE);

        const meshMaterialInvisible = meshMaterial.clone();
        meshMaterialInvisible.visible = false;

        const lineMaterialRed = lineMaterial.clone();
        lineMaterialRed.color.set(RED);

        const lineMaterialGreen = lineMaterial.clone();
        lineMaterialGreen.color.set(GREEN);

        const lineMaterialBlue = lineMaterial.clone();
        lineMaterialBlue.color.set(BLUE);

        const lineMaterialGray = lineMaterial.clone();
        lineMaterialGray.color.set(GRAY);

        this.defaults = {
            ARROW: new CylinderBufferGeometry(0, 0.05, 0.2, 12, 1, false),
            LINE: new BufferGeometry(),
            BOX: new BoxBufferGeometry(0.125, 0.125, 0.125),

            TRANSLATE_PICKER: new CylinderBufferGeometry(0.2, 0, 1, 4, 1, false),
            ROTATE_PICKER: new TorusBufferGeometry(1, 0.1, 4, 24),

            MESH_MATERIAL_RED: meshMaterialRed,
            MESH_MATERIAL_GREEN: meshMaterialGreen,
            MESH_MATERIAL_BLUE: meshMaterialBlue,
            MESH_MATERIAL_INVISIBLE: meshMaterialInvisible,

            LINE_MATERIAL_RED: lineMaterialRed,
            LINE_MATERIAL_GREEN: lineMaterialGreen,
            LINE_MATERIAL_BLUE: lineMaterialBlue,
            LINE_MATERIAL_GRAY: lineMaterialGray
        };


        this.defaults.LINE.addAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
    }

    destroyDefaults() {
        this.defaults = null;
    }

    initTranslatePeripherals() {
        const defaults = this.defaults;

        this.translatePeripheral = this.createPeripheral([
            ['X', new Mesh(defaults.ARROW.clone(), defaults.MESH_MATERIAL_RED.clone()), [1, 0, 0], [0, 0, -Math.PI / 2]],
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_RED.clone())],
            ['Y', new Mesh(defaults.ARROW.clone(), defaults.MESH_MATERIAL_BLUE.clone()), [0, 1, 0]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_BLUE.clone()), null, [0, 0, Math.PI / 2]],
            ['Z', new Mesh(defaults.ARROW.clone(), defaults.MESH_MATERIAL_GREEN.clone()), [0, 0, -1], [-Math.PI / 2, 0, 0]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_GREEN.clone()), null, [0, Math.PI / 2, 0]]
        ]);
        this.translatePeripheral.visible = false;
        this.add(this.translatePeripheral);

        this.translatePicker = this.createPeripheral([
            ['X', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0.6, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0.6, 0]],
            ['Z', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0, -0.6], [-Math.PI / 2, 0, 0]]
        ]);
        this.translatePicker.visiable = false;
        this.add(this.translatePicker);
    }

    initRotatePeripherals() {
        const defaults = this.defaults;

        this.rotatePeripheral = this.createPeripheral([
            ['X', new Line(new ArcBufferGeometry(1, 64, Math.PI), defaults.LINE_MATERIAL_RED.clone())],
            ['X', new Mesh(new OctahedronBufferGeometry(0.04, 0), defaults.MESH_MATERIAL_RED.clone()), [0, 0, 0.99], null, [1, 3, 1]],
            ['Y', new Line(new ArcBufferGeometry(1, 64, Math.PI), defaults.LINE_MATERIAL_BLUE.clone()), null, [0, 0, Math.PI / 2]],
            ['Y', new Mesh(new OctahedronBufferGeometry(0.04, 0), defaults.MESH_MATERIAL_BLUE.clone()), [0, 0, 0.99], [0, 0, Math.PI / 2], [1, 3, 1]],
            ['Z', new Line(new ArcBufferGeometry(1, 64, Math.PI), defaults.LINE_MATERIAL_GREEN.clone()), null, [0, Math.PI / 2, 0]],
            ['Z', new Mesh(new OctahedronBufferGeometry(0.04, 0), defaults.MESH_MATERIAL_GREEN.clone()), [0.99, 0, 0], null, [1, 3, 1]],
            ['XYZE', new Line(new ArcBufferGeometry(1, 64, Math.PI * 2), defaults.LINE_MATERIAL_GRAY.clone()), null, [0, Math.PI / 2, 0]]
        ]);
        this.add(this.rotatePeripheral);

        this.rotatePicker = this.createPeripheral([
            ['X', new Mesh(defaults.ROTATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), null, [0, Math.PI / 2, 0]],
            ['Y', new Mesh(defaults.ROTATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), null, [Math.PI / 2, 0, 0]],
            ['Z', new Mesh(defaults.ROTATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE)]
        ]);
        this.rotatePicker.visiable = false;
        this.add(this.rotatePicker);
    }

    initScalePeripherals() {
        const defaults = this.defaults;

        this.scalePeripheral = this.createPeripheral([
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_RED.clone())],
            ['X', new Mesh(defaults.BOX.clone(), defaults.MESH_MATERIAL_RED.clone()), [1, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_BLUE.clone()), null, [0, 0, Math.PI / 2]],
            ['Y', new Mesh(defaults.BOX.clone(), defaults.MESH_MATERIAL_BLUE.clone()), [0, 1, 0]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_GREEN.clone()), null, [0, Math.PI / 2, 0]],
            ['Z', new Mesh(defaults.BOX.clone(), defaults.MESH_MATERIAL_GREEN.clone()), [0, 0, -1], [-Math.PI / 2, 0, 0]]
        ]);
        this.add(this.scalePeripheral);

        this.scalePicker = this.createPeripheral([
            ['X', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0.6, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0.6, 0]],
            ['Z', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0, -0.6], [-Math.PI / 2, 0, 0]]
        ]);
        this.scalePicker.visiable = false;
        this.add(this.scalePicker);
    }

    initPlane() {
        this.plane = new Mesh(
            new PlaneBufferGeometry(500, 500, 2, 2),
            new MeshBasicMaterial({ visible: false, wireframe: true, side: DoubleSide, transparent: true, opacity: 1 })
        );

        this.add(this.plane);
    }

    get mode() {
        return this._mode;
    }

    set mode(mode) {
        if (mode !== this._mode) {
            this._mode = mode;
            this.dispatchEvent(EVENTS.UPDATE);
        }
    }

    get axis() {
        return this._axis;
    }

    set axis(axis) {
        if (axis !== this._axis) {
            this._axis = axis;
            this.dispatchEvent(EVENTS.UPDATE);
        }
    }

    // Will be called when rendering scene
    updateMatrixWorld(force) {
        if (this.object) {
            // camera
            const cameraPosition = new Vector3();
            const cameraQuaternion = new Quaternion();
            const cameraScale = new Vector3();

            this.camera.updateMatrixWorld();
            this.camera.matrixWorld.decompose(cameraPosition, cameraQuaternion, cameraScale);

            // object
            const objectPosition = new Vector3();
            const objectQuaternion = new Quaternion();
            const objectScale = new Vector3();

            this.object.updateMatrixWorld();
            this.object.matrixWorld.decompose(objectPosition, objectQuaternion, objectScale);
            // objectPosition.setFromMatrixPosition(this.object.matrixWorld);
            this.objectQuaternionInv.copy(objectQuaternion).inverse();

            // parent
            this.object.parent.matrixWorld.decompose(this.parentPosition, this.parentQuaternion, this.parentScale);
            this.parentQuaternionInv.copy(this.parentQuaternion).inverse();

            // Update peripherals
            this.translatePeripheral.visible = (this.mode === 'translate');
            this.rotatePeripheral.visible = (this.mode === 'rotate');
            this.scalePeripheral.visible = (this.mode === 'scale');

            const eyeDistance = cameraPosition.distanceTo(objectPosition);
            const zero = new Vector3();
            const unitX = new Vector3(1, 0, 0);
            const unitY = new Vector3(0, 1, 0);
            const unitZ = new Vector3(0, 0, 1);

            // Update peripherals as a whole (position, rotation, scale)
            const handles = [];
            if (this.mode === 'translate') {
                this.translatePeripheral.position.copy(objectPosition);
                this.translatePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.translatePicker.position.copy(objectPosition);
                this.translatePicker.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                handles.push(...this.translatePeripheral.children);
            } else if (this.mode === 'rotate') {
                this.rotatePeripheral.position.copy(objectPosition);
                this.rotatePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.rotatePicker.position.copy(objectPosition);
                this.rotatePicker.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                handles.push(...this.rotatePeripheral.children);
            } else if (this.mode === 'scale') {
                this.scalePeripheral.position.copy(objectPosition);
                this.scalePeripheral.quaternion.copy(objectQuaternion);
                this.scalePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.scalePicker.position.copy(objectPosition);
                this.scalePicker.quaternion.copy(objectQuaternion);
                this.scalePicker.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                handles.push(...this.scalePeripheral.children);
            }

            // Highlight peripherals internals based on axis selected
            for (const handle of handles) {
                if (this.mode === 'rotate') {
                    const alignVector = new Vector3().copy(cameraPosition);

                    if (handle.label === 'X') {
                        const quaternion = new Quaternion().setFromAxisAngle(unitX, Math.atan2(-alignVector.y, alignVector.z));
                        handle.quaternion.copy(quaternion);
                    } else if (handle.label === 'Y') {
                        const quaternion = new Quaternion().setFromAxisAngle(unitY, Math.atan2(alignVector.x, alignVector.z));
                        handle.quaternion.copy(quaternion);
                    } else if (handle.label === 'Z') {
                        const quaternion = new Quaternion().setFromAxisAngle(unitZ, Math.atan2(alignVector.y, alignVector.x));
                        handle.quaternion.copy(quaternion);
                    } else if (handle.label === 'XYZE') {
                        const rotationMatrix = new Matrix4().lookAt(cameraPosition, zero, unitY);
                        handle.quaternion.setFromRotationMatrix(rotationMatrix);
                    }
                }

                // opacity
                handle.material._color = handle.material._color || handle.material.color.clone();
                handle.material._opacity = handle.material._opacity || handle.material.opacity;

                handle.material.color.copy(handle.material._color);
                handle.material.opacity = handle.material._opacity;

                if (this.axis) {
                    if (handle.label === this.axis || handle.label.includes(this.axis)) {
                        handle.material.opacity = 1;
                    } else {
                        handle.material.opacity = 0.15;
                    }
                }
            }

            // Place plane according to axis selected
            this.plane.position.copy(objectPosition);

            const eye = cameraPosition.sub(objectPosition).normalize();

            let alignVector = new Vector3();
            let dirVector = new Vector3();

            if (this.mode === 'translate') {
                switch (this.axis) {
                    case 'X':
                        alignVector.copy(eye).cross(unitX);
                        dirVector.copy(unitX).cross(alignVector);
                        break;
                    case 'Y':
                        alignVector.copy(eye).cross(unitY);
                        dirVector.copy(unitY).cross(alignVector);
                        break;
                    case 'Z':
                        alignVector.copy(eye).cross(unitZ);
                        dirVector.copy(unitZ).cross(alignVector);
                        break;
                    default:
                        break;
                }

                const m = new Matrix4().lookAt(zero, dirVector, alignVector);
                this.plane.quaternion.setFromRotationMatrix(m);
            } else if (this.mode === 'rotate') {
                this.plane.quaternion.copy(cameraQuaternion);
            } else if (this.mode === 'scale') {
                const unitX = new Vector3(1, 0, 0).applyQuaternion(objectQuaternion);
                const unitY = new Vector3(0, 1, 0).applyQuaternion(objectQuaternion);
                const unitZ = new Vector3(0, 0, 1).applyQuaternion(objectQuaternion);

                switch (this.axis) {
                    case 'X':
                        alignVector.copy(eye).cross(unitX);
                        dirVector.copy(unitX).cross(alignVector);
                        break;
                    case 'Y':
                        alignVector.copy(eye).cross(unitY);
                        dirVector.copy(unitY).cross(alignVector);
                        break;
                    case 'Z':
                        alignVector.copy(eye).cross(unitZ);
                        dirVector.copy(unitZ).cross(alignVector);
                        break;
                    default:
                        break;
                }

                const m = new Matrix4().lookAt(zero, dirVector, alignVector);
                this.plane.quaternion.setFromRotationMatrix(m);
            }
        }

        super.updateMatrixWorld(force);
    }

    attach(object) {
        this.object = object;
        this.visible = true;
        this.dispatchEvent(EVENTS.UPDATE);
    }

    detach() {
        this.object = null;
        this.visible = false;
        this.dispatchEvent(EVENTS.UPDATE);
    }

    onMouseHover(coord) {
        if (!this.object) {
            return false;
        }

        this.ray.setFromCamera(coord, this.camera);

        let picker;
        switch (this.mode) {
            case 'translate':
                picker = this.translatePicker;
                break;
            case 'rotate':
                picker = this.rotatePicker;
                break;
            case 'scale':
                picker = this.scalePicker;
                break;
            default:
                break;
        }

        const intersect = this.ray.intersectObjects(picker.children, false)[0];
        if (intersect) {
            this.axis = intersect.object.label;
        } else {
            this.axis = null;
        }

        return true;
    }

    onMouseDown(coord) {
        if (!this.object || !this.axis) {
            return false;
        }

        this.ray.setFromCamera(coord, this.camera);

        const intersect = this.ray.intersectObject(this.plane, true)[0];
        if (!intersect) {
            return false;
        }

        this.positionStart.copy(this.object.position);
        this.quaternionStart.copy(this.object.quaternion);
        this.scaleStart.copy(this.object.scale);

        // pointStart is in world space
        this.pointStart.copy(intersect.point);

        this.dragging = true;

        return true;
    }

    onMouseMove(coord) {
        if (!this.object || !this.axis || !this.dragging) {
            return false;
        }

        this.ray.setFromCamera(coord, this.camera);

        const intersect = this.ray.intersectObject(this.plane, true)[0];
        if (!intersect) {
            return false;
        }

        this.pointEnd.copy(intersect.point);

        // translate
        switch (this.mode) {
            case 'translate': {
                const offset = new Vector3().subVectors(this.pointEnd, this.pointStart);

                offset.x = (this.axis === 'X' ? offset.x : 0);
                offset.y = (this.axis === 'Y' ? offset.y : 0);
                offset.z = (this.axis === 'Z' ? offset.z : 0);

                // Dive in to object local offset
                offset.applyQuaternion(this.parentQuaternionInv).divide(this.parentScale);

                this.object.position.copy(this.positionStart).add(offset);
                break;
            }
            case 'rotate': {
                const offset = new Vector3().subVectors(this.pointEnd, this.pointStart);

                const objectPosition = new Vector3().copy(this.object.position).applyMatrix4(this.object.parent.matrixWorld); // TODO: optimize?
                const cameraPosition = new Vector3().setFromMatrixPosition(this.camera.matrixWorld);
                const eyeDistance = cameraPosition.distanceTo(objectPosition);
                const ROTATION_SPEED = 20 / eyeDistance;

                const rotationAxis = new Vector3((this.axis === 'X') ? 1 : 0, (this.axis === 'Y') ? 1 : 0, (this.axis === 'Z') ? 1 : 0);
                const rotationAngle = offset.dot(new Vector3().crossVectors(rotationAxis, cameraPosition).normalize()) * ROTATION_SPEED;

                rotationAxis.applyQuaternion(this.parentQuaternionInv);
                const quaternion = new Quaternion().setFromAxisAngle(rotationAxis, rotationAngle);

                this.object.quaternion.copy(quaternion).multiply(this.quaternionStart).normalize();
                break;
            }
            case 'scale': {
                const objectPosition = new Vector3().copy(this.object.position).applyMatrix4(this.object.parent.matrixWorld); // TODO: optimize?

                const sVec = new Vector3().copy(this.pointStart).sub(objectPosition).applyQuaternion(this.objectQuaternionInv);
                const eVec = new Vector3().copy(this.pointEnd).sub(objectPosition).applyQuaternion(this.objectQuaternionInv);
                eVec.divide(sVec);

                eVec.x = (this.axis === 'X' ? eVec.x : 1);
                eVec.y = (this.axis === 'Y' ? eVec.y : 1);
                eVec.z = (this.axis === 'Z' ? eVec.z : 1);

                this.object.scale.copy(this.scaleStart).multiply(eVec);
                break;
            }
            default:
                break;
        }


        this.dispatchEvent(EVENTS.UPDATE);

        return true;
    }

    onMouseUp() {
        this.dragging = false;
    }
}

export default TransformControls;
