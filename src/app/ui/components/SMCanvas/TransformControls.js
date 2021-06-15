import {
    DoubleSide,
    Float32BufferAttribute,
    Vector3,
    Quaternion,
    Matrix4,
    Group,
    Object3D,
    Raycaster,
    Mesh,
    Line,
    BufferGeometry,
    BoxBufferGeometry,
    PlaneBufferGeometry,
    CylinderBufferGeometry,
    OctahedronBufferGeometry,
    TorusBufferGeometry,
    MeshBasicMaterial,
    LineBasicMaterial
} from 'three';
// import * as THREE from 'three';

import ThreeUtils from '../../../three-extensions/ThreeUtils';

import { ArcBufferGeometry } from './ArcGeometry';

const EVENTS = {
    UPDATE: { type: 'update' }
};

const OUTLINE = 'OUTLINE';

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

    object = new Group();

    _mode = 'translate';

    _axis = null;

    _inProgress= false;

    // ray for intersect calculation
    ray = new Raycaster();

    dragging = false;

    // (local space)
    quaternionStart = new Quaternion();

    scaleStart = new Vector3(1, 1, 1);

    positionStart = new Vector3(0, 0, 0);

    // (world space)

    parentPosition = new Vector3();

    parentQuaternion = new Quaternion();

    parentScale = new Vector3();

    parentQuaternionInv = new Quaternion();

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
        this.initSelectedPeripherals();
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

        const selectedlineMaterial = new LineBasicMaterial({
            depthTest: false,
            depthWrite: false,
            transparent: true,
            linewidth: 4,
            fog: false
        });


        const RED = 0xe93100;
        const GREEN = 0x22ac38;
        const BLUE = 0x00b7ee;
        const GRAY = 0x787878;
        const DARKGRAY = 0x2778dd;

        const meshMaterialRed = meshMaterial.clone();
        meshMaterialRed.color.set(RED);

        const meshMaterialGreen = meshMaterial.clone();
        meshMaterialGreen.color.set(GREEN);

        const meshMaterialBlue = meshMaterial.clone();
        meshMaterialBlue.color.set(BLUE);

        const meshMaterialInvisible = meshMaterial.clone();
        meshMaterialInvisible.visible = false;

        const lineMaterialDarkGray = selectedlineMaterial.clone();
        lineMaterialDarkGray.color.set(DARKGRAY);

        const lineMaterialRed = lineMaterial.clone();
        lineMaterialRed.color.set(RED);

        const lineMaterialGreen = lineMaterial.clone();
        lineMaterialGreen.color.set(GREEN);

        const lineMaterialBlue = lineMaterial.clone();
        lineMaterialBlue.color.set(BLUE);

        const lineMaterialGray = lineMaterial.clone();
        lineMaterialGray.color.set(GRAY);

        const selectedPoints = [];
        selectedPoints.push(new Vector3(0, 0, 0));
        selectedPoints.push(new Vector3(1, 0, 0));

        this.defaults = {
            ARROW: new CylinderBufferGeometry(0, 0.05, 0.2, 12, 1, false),
            LINE: new BufferGeometry(),
            SELECTEDLINE: new BufferGeometry().setFromPoints(selectedPoints),
            BOX: new BoxBufferGeometry(0.125, 0.125, 0.125),
            PLANE: new PlaneBufferGeometry(0.2, 0.2, 2),

            TRANSLATE_PICKER: new CylinderBufferGeometry(0.2, 0, 1, 4, 1, false),
            ROTATE_PICKER: new TorusBufferGeometry(1, 0.1, 4, 24),

            MESH_MATERIAL_RED: meshMaterialRed,
            MESH_MATERIAL_GREEN: meshMaterialGreen,
            MESH_MATERIAL_BLUE: meshMaterialBlue,
            MESH_MATERIAL_INVISIBLE: meshMaterialInvisible,

            LINE_MATERIAL_DARKGRAY: lineMaterialDarkGray,
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
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_RED.clone())],
            ['X', new Mesh(defaults.ARROW.clone(), defaults.MESH_MATERIAL_RED.clone()), [1, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_GREEN.clone()), null, [0, 0, Math.PI / 2]],
            ['Y', new Mesh(defaults.ARROW.clone(), defaults.MESH_MATERIAL_GREEN.clone()), [0, 1, 0]],
            ['XY', new Mesh(defaults.PLANE.clone(), defaults.MESH_MATERIAL_BLUE.clone()), [0.15, 0.15, 0]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_BLUE.clone()), null, [0, -Math.PI / 2, 0]],
            ['Z', new Mesh(defaults.ARROW.clone(), defaults.MESH_MATERIAL_BLUE.clone()), [0, 0, 1], [Math.PI / 2, 0, 0]]
        ]);

        this.translatePeripheral.visible = false;
        this.add(this.translatePeripheral);

        this.translatePicker = this.createPeripheral([
            ['X', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0.6, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0.6, 0]],
            ['XY', new Mesh(defaults.PLANE.clone(), defaults.MESH_MATERIAL_INVISIBLE.clone()), [0.15, 0.15, 0]],
            ['Z', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0, 0.6], [Math.PI / 2, 0, 0]]
        ]);
        this.translatePicker.visiable = false;
        this.add(this.translatePicker);
    }

    initSelectedPeripherals() {
        const defaults = this.defaults;
        // bottom
        this.selectedFrontLeftBottom = this.createPeripheral([
            [OUTLINE, new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [0.2, 0.2, 0.2]]
        ]);
        this.selectedFrontRightBottom = this.createPeripheral([
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [-0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [0.2, 0.2, 0.2]]
        ]);
        this.selectedBackLeftBottom = this.createPeripheral([
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [-0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [0.2, 0.2, 0.2]]
        ]);
        this.selectedBackRightBottom = this.createPeripheral([
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [-0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [-0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [0.2, 0.2, 0.2]]
        ]);
        // top
        this.selectedFrontLeftTop = this.createPeripheral([
            [OUTLINE, new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [-0.2, 0.2, 0.2]]
        ]);
        this.selectedFrontRightTop = this.createPeripheral([
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [-0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [-0.2, 0.2, 0.2]]
        ]);
        this.selectedBackLeftTop = this.createPeripheral([
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [-0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [-0.2, 0.2, 0.2]]
        ]);
        this.selectedBackRightTop = this.createPeripheral([
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [-0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [-0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [-0.2, 0.2, 0.2]]
        ]);
        this.allSelectedPeripherals = [
            this.selectedFrontLeftBottom,
            this.selectedFrontRightBottom,
            this.selectedBackLeftBottom,
            this.selectedBackRightBottom,
            this.selectedFrontLeftTop,
            this.selectedFrontRightTop,
            this.selectedBackLeftTop,
            this.selectedBackRightTop
        ];
        this.allSelectedPeripherals.forEach((peripheral) => {
            this.add(peripheral);
        });
    }

    hideAllPeripherals() {
        this.translatePeripheral.visible = false;
        this.rotatePeripheral.visible = false;
        this.scalePeripheral.visible = false;
    }

    hideSelectedPeripherals() {
        this.allSelectedPeripherals.forEach((peripheral) => {
            peripheral.visible = false;
        });
    }

    showSelectedPeripherals() {
        this.allSelectedPeripherals.forEach((peripheral) => {
            peripheral.visible = true;
        });
    }

    initRotatePeripherals() {
        const defaults = this.defaults;

        this.rotatePeripheral = this.createPeripheral([
            ['X', new Line(new ArcBufferGeometry(1, 64, Math.PI), defaults.LINE_MATERIAL_RED.clone()), null, [Math.PI, Math.PI / 2, 0]],
            ['X', new Mesh(new OctahedronBufferGeometry(0.04, 0), defaults.MESH_MATERIAL_RED.clone()), [0, -0.99, 0], [Math.PI / 2, 0, 0], [1, 3, 1]],
            ['Y', new Line(new ArcBufferGeometry(1, 64, Math.PI), defaults.LINE_MATERIAL_GREEN.clone()), null, [Math.PI / 2, 0, 0]],
            ['Y', new Mesh(new OctahedronBufferGeometry(0.04, 0), defaults.MESH_MATERIAL_GREEN.clone()), [0, 0, 0.99], [0, 0, Math.PI / 2], [1, 3, 1]],
            ['Z', new Line(new ArcBufferGeometry(1, 64, Math.PI), defaults.LINE_MATERIAL_BLUE.clone()), null, [Math.PI, 0, 0]],
            ['Z', new Mesh(new OctahedronBufferGeometry(0.04, 0), defaults.MESH_MATERIAL_BLUE.clone()), [0, -0.99, 0], [0, 0, Math.PI / 2], [1, 3, 1]],
            ['XYZE', new Line(new ArcBufferGeometry(1, 64, Math.PI * 2), defaults.LINE_MATERIAL_GRAY.clone()), null, [0, 0, 0]]
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
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_GREEN.clone()), null, [0, 0, Math.PI / 2]],
            ['Y', new Mesh(defaults.BOX.clone(), defaults.MESH_MATERIAL_GREEN.clone()), [0, 1, 0]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_BLUE.clone()), null, [0, -Math.PI / 2, 0]],
            ['Z', new Mesh(defaults.BOX.clone(), defaults.MESH_MATERIAL_BLUE.clone()), [0, 0, 1], [Math.PI / 2, 0, 0]]
        ]);
        this.add(this.scalePeripheral);

        this.scalePicker = this.createPeripheral([
            ['X', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0.6, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0.6, 0]],
            ['Z', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0, 0.6], [Math.PI / 2, 0, 0]]
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

    get inProgress() {
        return this._inProgress;
    }

    set inProgress(inProgress) {
        if (inProgress !== this._inProgress) {
            this._inProgress = inProgress;
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
        if (this.object && this.object.children.length === 0) {
            this.hideSelectedPeripherals();
            this.hideAllPeripherals();
            this.object.boundingBox = [];
        } else if (this.object && !this.object.shouldUpdateBoundingbox) {
            this.hideSelectedPeripherals();
        } else {
            this.showSelectedPeripherals();
        }

        if (this.object && this.object.children && this.object.children.length > 0) {
            const cameraPosition = new Vector3();
            const cameraQuaternion = new Quaternion();
            const cameraScale = new Vector3();
            // camera
            this.camera.updateMatrixWorld();
            this.camera.matrixWorld.decompose(cameraPosition, cameraQuaternion, cameraScale);
            const multiObjectPosition = this.object.position;

            const objectPosition = new Vector3();
            const objectScale = new Vector3();
            const objectQuaternion = new Quaternion();

            this.object.children.forEach((child) => {
                // Update peripherals
                this.translatePeripheral.visible = (this.mode === 'translate' && child.visible);
                this.rotatePeripheral.visible = (this.mode === 'rotate' && child.visible);
                this.scalePeripheral.visible = (this.mode === 'scale' && child.visible);
            });

            this.object.matrixWorld.decompose(objectPosition, objectQuaternion, objectScale);
            // parent
            this.object.parent.matrixWorld.decompose(this.parentPosition, this.parentQuaternion, this.parentScale);
            this.parentQuaternionInv.copy(this.parentQuaternion).inverse();


            // Update peripherals as a whole (position, rotation, scale)
            const handles = [];
            const eyeDistance = cameraPosition.distanceTo(multiObjectPosition);
            const zero = new Vector3();
            const unitX = new Vector3(1, 0, 0);
            const unitY = new Vector3(0, 1, 0);
            const unitZ = new Vector3(0, 0, 1);

            if (this.object.shouldUpdateBoundingbox) {
                const boundingBox = ThreeUtils.computeBoundingBox(this.object);
                const maxObjectBoundingBox = boundingBox.max;
                const minObjectBoundingBox = boundingBox.min;
                const multiObjectWidth = new Vector3();
                multiObjectWidth.x = (maxObjectBoundingBox.x - minObjectBoundingBox.x);
                multiObjectWidth.y = (maxObjectBoundingBox.y - minObjectBoundingBox.y);
                multiObjectWidth.z = (maxObjectBoundingBox.z - minObjectBoundingBox.z);
                const FrontLeftBottomPosition = new Vector3(
                    minObjectBoundingBox.x,
                    minObjectBoundingBox.y,
                    minObjectBoundingBox.z
                );
                const FrontRightBottomPosition = new Vector3(
                    maxObjectBoundingBox.x,
                    minObjectBoundingBox.y,
                    minObjectBoundingBox.z
                );
                const BackLeftBottomPosition = new Vector3(
                    minObjectBoundingBox.x,
                    maxObjectBoundingBox.y,
                    minObjectBoundingBox.z
                );
                const BackRightBottomPosition = new Vector3(
                    maxObjectBoundingBox.x,
                    maxObjectBoundingBox.y,
                    minObjectBoundingBox.z
                );
                const FrontLeftTopPosition = new Vector3(
                    minObjectBoundingBox.x,
                    minObjectBoundingBox.y,
                    maxObjectBoundingBox.z
                );
                const FrontRightTopPosition = new Vector3(
                    maxObjectBoundingBox.x,
                    minObjectBoundingBox.y,
                    maxObjectBoundingBox.z
                );
                const BackLeftTopPosition = new Vector3(
                    minObjectBoundingBox.x,
                    maxObjectBoundingBox.y,
                    maxObjectBoundingBox.z
                );
                const BackRightTopPosition = new Vector3(
                    maxObjectBoundingBox.x,
                    maxObjectBoundingBox.y,
                    maxObjectBoundingBox.z
                );

                this.selectedFrontLeftBottom.position.copy(FrontLeftBottomPosition);
                this.selectedFrontRightBottom.position.copy(FrontRightBottomPosition);

                this.selectedBackLeftBottom.position.copy(BackLeftBottomPosition);
                this.selectedBackRightBottom.position.copy(BackRightBottomPosition);

                this.selectedFrontLeftTop.position.copy(FrontLeftTopPosition);
                this.selectedFrontRightTop.position.copy(FrontRightTopPosition);

                this.selectedBackLeftTop.position.copy(BackLeftTopPosition);
                this.selectedBackRightTop.position.copy(BackRightTopPosition);

                this.allSelectedPeripherals.forEach((peripheral) => {
                    peripheral.scale.set(multiObjectWidth.x, multiObjectWidth.y, multiObjectWidth.z);
                    handles.push(...peripheral.children);
                });
            }

            if (this.mode === 'translate') {
                this.translatePeripheral.position.copy(multiObjectPosition);
                this.translatePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.translatePicker.position.copy(multiObjectPosition);
                this.translatePicker.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                handles.push(...this.translatePeripheral.children);
            } else if (this.mode === 'rotate') {
                this.rotatePeripheral.position.copy(multiObjectPosition);
                this.rotatePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.rotatePicker.position.copy(multiObjectPosition);
                this.rotatePicker.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                handles.push(...this.rotatePeripheral.children);
            } else if (this.mode === 'scale') {
                this.scalePeripheral.position.copy(multiObjectPosition);
                this.scalePeripheral.quaternion.copy(objectQuaternion);
                this.scalePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.scalePicker.position.copy(multiObjectPosition);
                this.scalePicker.quaternion.copy(objectQuaternion);
                this.scalePicker.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                handles.push(...this.scalePeripheral.children);
            }


            // Highlight peripherals internals based on axis selected
            for (const handle of handles) {
                if (this.mode === 'rotate') {
                    const alignVector = new Vector3().copy(cameraPosition).sub(multiObjectPosition);

                    if (handle.label === 'X') {
                        const quaternion = new Quaternion().setFromAxisAngle(unitX, Math.atan2(-alignVector.z, -alignVector.y));
                        handle.quaternion.copy(quaternion);
                    } else if (handle.label === 'Y') {
                        const quaternion = new Quaternion().setFromAxisAngle(unitY, Math.atan2(alignVector.x, alignVector.z));
                        handle.quaternion.copy(quaternion);
                    } else if (handle.label === 'Z') {
                        const quaternion = new Quaternion().setFromAxisAngle(unitZ, Math.atan2(alignVector.x, -alignVector.y));
                        handle.quaternion.copy(quaternion);
                    } else if (handle.label === 'XYZE') {
                        const rotationMatrix = new Matrix4().lookAt(cameraPosition, multiObjectPosition, unitZ);
                        handle.quaternion.setFromRotationMatrix(rotationMatrix);
                    }
                }

                // opacity
                handle.material._color = handle.material._color || handle.material.color.clone();
                handle.material._opacity = handle.material._opacity || handle.material.opacity;

                handle.material.color.copy(handle.material._color);
                handle.material.opacity = handle.material._opacity;

                if (this.axis) {
                    if (handle.label === this.axis || handle.label === OUTLINE) {
                        handle.material.opacity = 1;
                    } else {
                        handle.material.opacity = 0.15;
                    }
                }
            }

            // Place plane according to axis selected
            this.plane.position.copy(multiObjectPosition);

            const eye = cameraPosition.sub(multiObjectPosition).normalize();

            const alignVector = new Vector3();
            const dirVector = new Vector3();

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
                const unitXLocal = new Vector3(1, 0, 0).applyQuaternion(objectQuaternion);
                const unitYLocal = new Vector3(0, 1, 0).applyQuaternion(objectQuaternion);
                const unitZLocal = new Vector3(0, 0, 1).applyQuaternion(objectQuaternion);

                switch (this.axis) {
                    case 'X':
                        alignVector.copy(eye).cross(unitXLocal);
                        dirVector.copy(unitXLocal).cross(alignVector);
                        break;
                    case 'Y':
                        alignVector.copy(eye).cross(unitYLocal);
                        dirVector.copy(unitYLocal).cross(alignVector);
                        break;
                    case 'Z':
                        alignVector.copy(eye).cross(unitZLocal);
                        dirVector.copy(unitZLocal).cross(alignVector);
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

    attach(objects) {
        this.object = objects;
        this.visible = true;

        this.dispatchEvent(EVENTS.UPDATE);
    }


    detach() {
        // this.object = new Group();
        this.visible = false;
        this.dispatchEvent(EVENTS.UPDATE);
    }

    onMouseHover(coord) {
        if (!(this.object.children && this.object.children.length > 0)) {
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
        if (!picker) {
            return false;
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
        if (!(this.object.children && this.object.children.length > 0) || !this.axis) {
            return false;
        }

        this.ray.setFromCamera(coord, this.camera);

        const intersect = this.ray.intersectObject(this.plane, true)[0];
        if (!intersect) {
            return false;
        }


        this.quaternionStart.copy(this.object.quaternion);
        this.scaleStart.copy(this.object.scale);
        this.positionStart.copy(this.object.position);


        // pointStart is in world space
        this.pointStart.copy(intersect.point);
        this.dragging = true;

        return true;
    }

    onMouseMove(coord) {
        this.object.shouldUpdateBoundingbox = false;
        if (!(this.object.children && this.object.children.length > 0) || !this.axis || !this.dragging) {
            return false;
        }

        this.ray.setFromCamera(coord, this.camera);

        const intersect = this.ray.intersectObject(this.plane, true)[0];
        if (!intersect) {
            return false;
        }
        this.pointEnd.copy(intersect.point);

        // translate
        if (this.inProgress) {
            return true;
        }
        switch (this.mode) {
            case 'translate': {
                const offset = new Vector3().subVectors(this.pointEnd, this.pointStart);
                offset.x = (this.axis.indexOf('X') !== -1 ? offset.x : 0);
                offset.y = (this.axis.indexOf('Y') !== -1 ? offset.y : 0);
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
                const objectPosition = new Vector3().copy(this.object.position); // TODO: optimize?
                const parentSVec = new Vector3().copy(this.pointStart).sub(objectPosition).applyQuaternion(this.parentQuaternionInv);
                const parentEVec = new Vector3().copy(this.pointEnd).sub(objectPosition).applyQuaternion(this.parentQuaternionInv);
                parentEVec.divide(parentSVec);

                if (this.object.uniformScalingState === true) {
                    if (this.axis === 'X') {
                        parentEVec.y = parentEVec.x;
                        parentEVec.z = parentEVec.x;
                    } else if (this.axis === 'Y') {
                        parentEVec.z = parentEVec.y;
                        parentEVec.x = parentEVec.y;
                    } else {
                        parentEVec.y = parentEVec.z;
                        parentEVec.x = parentEVec.z;
                    }
                } else {
                    parentEVec.x = (this.axis === 'X' ? parentEVec.x : 1);
                    parentEVec.y = (this.axis === 'Y' ? parentEVec.y : 1);
                    parentEVec.z = (this.axis === 'Z' ? parentEVec.z : 1);
                }
                if (this.shouldApplyScaleToObjects(parentEVec)) {
                    this.object.scale.copy(this.scaleStart).multiply(parentEVec);
                }

                break;
            }
            default:
                break;
        }


        this.dispatchEvent(EVENTS.UPDATE);

        return true;
    }

    onMouseUp() {
        this.updateBoundingBox();
        this.dragging = false;

        this.dispatchEvent(EVENTS.UPDATE);
    }

    shouldApplyScaleToObjects(parentEVec) {
        return this.object.children.every((meshObject) => {
            if (Math.abs(parentEVec.x * this.object.scale.x * meshObject.scale.x) < 0.01
              || Math.abs(parentEVec.y * this.object.scale.y * meshObject.scale.y) < 0.01
              || Math.abs(parentEVec.z * this.object.scale.z * meshObject.scale.z) < 0.01
            ) {
                return false; // should disable
            }
            return true;
        });
    }

    // Calculate the bbox of each model in the selectedGroup
    updateBoundingBox() {
        this.object.shouldUpdateBoundingbox = true;
    }
}

export default TransformControls;
