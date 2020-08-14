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

    object = new Group();

    _mode = 'translate';

    _axis = null;

    // ray for intersect calculation
    ray = new Raycaster();

    dragging = false;

    handles = [];

    multiObjectScaleCenter = new Vector3();

    // (local space)
    eachObjectPositionStart = [];

    quaternionStart = new Quaternion();

    eachObjectQuaternionStart = [];

    scaleStart = new Vector3();

    eachObjectScaleStart = [];

    // (world space)

    objectQuaternionInv = [];

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

    multiplyVector(vector1, vector2) {
        return new Vector3(vector1.x * vector2.x, vector1.y * vector2.y, vector1.z * vector2.z);
    }

    calculateScalePosition(originalPosition, centerPosition, eVec) {
        const positionX = centerPosition.x + (originalPosition.x - centerPosition.x) * eVec.x;
        const positionY = centerPosition.y + (originalPosition.y - centerPosition.y) * eVec.y;
        const positionZ = originalPosition.z;
        return new Vector3(positionX, positionY, positionZ);
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
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_BLUE.clone()), null, [0, -Math.PI / 2, 0]],
            ['Z', new Mesh(defaults.ARROW.clone(), defaults.MESH_MATERIAL_BLUE.clone()), [0, 0, 1], [Math.PI / 2, 0, 0]]
        ]);
        this.translatePeripheral.visible = false;
        this.add(this.translatePeripheral);

        this.translatePicker = this.createPeripheral([
            ['X', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0.6, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0.6, 0]],
            ['Z', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0, 0.6], [Math.PI / 2, 0, 0]]
        ]);
        this.translatePicker.visiable = false;
        this.add(this.translatePicker);
    }

    initSelectedPeripherals() {
        const defaults = this.defaults;
        // bottom
        this.selectedFrontLeftBottom = this.createPeripheral([
            ['X', new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [0.2, 0.2, 0.2]],
            ['Y', new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [0.2, 0.2, 0.2]],
            ['Z', new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [0.2, 0.2, 0.2]]
        ]);
        this.selectedFrontRightBottom = this.createPeripheral([
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [-0.2, 0.2, 0.2]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [0.2, 0.2, 0.2]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [0.2, 0.2, 0.2]]
        ]);
        this.selectedBackLeftBottom = this.createPeripheral([
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [0.2, 0.2, 0.2]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [-0.2, 0.2, 0.2]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [0.2, 0.2, 0.2]]
        ]);
        this.selectedBackRightBottom = this.createPeripheral([
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [-0.2, 0.2, 0.2]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [-0.2, 0.2, 0.2]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [0.2, 0.2, 0.2]]
        ]);
        // top
        this.selectedFrontLeftTop = this.createPeripheral([
            ['X', new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [0.2, 0.2, 0.2]],
            ['Y', new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [0.2, 0.2, 0.2]],
            ['Z', new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [-0.2, 0.2, 0.2]]
        ]);
        this.selectedFrontRightTop = this.createPeripheral([
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [-0.2, 0.2, 0.2]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [0.2, 0.2, 0.2]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [-0.2, 0.2, 0.2]]
        ]);
        this.selectedBackLeftTop = this.createPeripheral([
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [0.2, 0.2, 0.2]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [-0.2, 0.2, 0.2]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [-0.2, 0.2, 0.2]]
        ]);
        this.selectedBackRightTop = this.createPeripheral([
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [-0.2, 0.2, 0.2]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [-0.2, 0.2, 0.2]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [-0.2, 0.2, 0.2]]
        ]);
        // this.selectedPeripheralLeftBottom.visible = true;
        this.add(this.selectedFrontLeftBottom);
        this.add(this.selectedFrontRightBottom);
        this.add(this.selectedBackLeftBottom);
        this.add(this.selectedBackRightBottom);
        this.add(this.selectedFrontLeftTop);
        this.add(this.selectedFrontRightTop);
        this.add(this.selectedBackLeftTop);
        this.add(this.selectedBackRightTop);
    }

    hideAllPeripherals() {
        this.translatePeripheral.visible = false;
        this.rotatePeripheral.visible = false;
        this.scalePeripheral.visible = false;
    }

    hideSelectedPeripherals() {
        this.selectedFrontLeftBottom.visible = false;
        this.selectedFrontRightBottom.visible = false;
        this.selectedBackLeftBottom.visible = false;
        this.selectedBackRightBottom.visible = false;
        this.selectedFrontLeftTop.visible = false;
        this.selectedFrontRightTop.visible = false;
        this.selectedBackLeftTop.visible = false;
        this.selectedBackRightTop.visible = false;
    }

    showSelectedPeripherals() {
        this.selectedFrontLeftBottom.visible = true;
        this.selectedFrontRightBottom.visible = true;
        this.selectedBackLeftBottom.visible = true;
        this.selectedBackRightBottom.visible = true;
        this.selectedFrontLeftTop.visible = true;
        this.selectedFrontRightTop.visible = true;
        this.selectedBackLeftTop.visible = true;
        this.selectedBackRightTop.visible = true;
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
        if (this.object.children.length === 0) {
            this.hideSelectedPeripherals();
        } else {
            this.showSelectedPeripherals();
        }

        if (this.object.children && this.object.children.length > 0) {
            const cameraPosition = new Vector3();
            const cameraQuaternion = new Quaternion();
            const cameraScale = new Vector3();
            // camera
            this.camera.updateMatrixWorld();
            this.camera.matrixWorld.decompose(cameraPosition, cameraQuaternion, cameraScale);
            const multiObjectPosition = new Vector3();
            const objectQuaternion = new Quaternion();
            const maxObjectPosition = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
            const minObjectPosition = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
            const multiObjectWidth = new Vector3();

            const minObjectBoundingBox = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
            const maxObjectBoundingBox = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

            this.object.children.forEach((objectControl, index) => {
                const objectPosition = new Vector3();
                const objectScale = new Vector3();
                const eachParentPosition = new Vector3();
                const eachParentQuaternion = new Quaternion();
                const eachParentScale = new Vector3();
                // object

                objectControl.updateMatrixWorld();
                // const clone = objectControl.geometry.clone();
                // objectControl.updateMatrix();
                // clone.applyMatrix(objectControl.matrix);
                // clone.computeBoundingBox();
                // objectControl.geometry.boundingBox = clone.boundingBox;


                objectControl.matrixWorld.decompose(objectPosition, objectQuaternion, objectScale);

                maxObjectPosition.x = Math.max(objectPosition.x, maxObjectPosition.x);
                maxObjectPosition.y = Math.max(objectPosition.y, maxObjectPosition.y);
                maxObjectPosition.z = Math.max(objectPosition.z, maxObjectPosition.z);

                minObjectPosition.x = Math.min(objectPosition.x, minObjectPosition.x);
                minObjectPosition.y = Math.min(objectPosition.y, minObjectPosition.y);
                minObjectPosition.z = Math.min(objectPosition.z, minObjectPosition.z);

                minObjectBoundingBox.x = Math.min(objectControl.geometry.boundingBox.min.x * objectScale.x + objectPosition.x, minObjectBoundingBox.x);
                minObjectBoundingBox.y = Math.min(objectControl.geometry.boundingBox.min.y * objectScale.y + objectPosition.y, minObjectBoundingBox.y);
                minObjectBoundingBox.z = Math.min(objectControl.geometry.boundingBox.min.z * objectScale.z + objectPosition.z, minObjectBoundingBox.z);

                maxObjectBoundingBox.x = Math.max(objectControl.geometry.boundingBox.max.x * objectScale.x + objectPosition.x, maxObjectBoundingBox.x);
                maxObjectBoundingBox.y = Math.max(objectControl.geometry.boundingBox.max.y * objectScale.y + objectPosition.y, maxObjectBoundingBox.y);
                maxObjectBoundingBox.z = Math.max(objectControl.geometry.boundingBox.max.z * objectScale.z + objectPosition.z, maxObjectBoundingBox.z);

                objectControl.matrixWorld.decompose(eachParentPosition, eachParentQuaternion, eachParentScale);
                this.objectQuaternionInv[index] = new Quaternion();
                this.objectQuaternionInv[index].copy(eachParentQuaternion).inverse();

                // Update peripherals

                this.translatePeripheral.visible = (this.mode === 'translate' && objectControl.visible);
                this.rotatePeripheral.visible = (this.mode === 'rotate' && objectControl.visible);
                this.scalePeripheral.visible = (this.mode === 'scale' && objectControl.visible);
            });
            this.object.matrixWorld.decompose(this.parentPosition, this.parentQuaternion, this.parentScale);
            // parent
            this.parentQuaternionInv.copy(this.parentQuaternion).inverse();


            multiObjectPosition.x = (maxObjectPosition.x + minObjectPosition.x) / 2;
            multiObjectPosition.y = (maxObjectPosition.y + minObjectPosition.y) / 2;
            multiObjectPosition.z = (maxObjectPosition.z + minObjectPosition.z) / 2;

            if (this.object.children.length > 1) {
                multiObjectWidth.x = (maxObjectBoundingBox.x - minObjectBoundingBox.x);
                multiObjectWidth.y = (maxObjectBoundingBox.y - minObjectBoundingBox.y);
                multiObjectWidth.z = (maxObjectBoundingBox.z - minObjectBoundingBox.z);
            } else {
                multiObjectWidth.x = (maxObjectBoundingBox.x - minObjectBoundingBox.x);
                multiObjectWidth.y = (maxObjectBoundingBox.y - minObjectBoundingBox.y);
                multiObjectWidth.z = (maxObjectBoundingBox.z - minObjectBoundingBox.z);
            }


            const eyeDistance = cameraPosition.distanceTo(multiObjectPosition);
            const zero = new Vector3();
            const unitX = new Vector3(1, 0, 0);
            const unitY = new Vector3(0, 1, 0);
            const unitZ = new Vector3(0, 0, 1);


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

            // Update peripherals as a whole (position, rotation, scale)
            // const handles = [];
            this.selectedFrontLeftBottom.position.copy(FrontLeftBottomPosition);
            this.selectedFrontLeftBottom.scale.set(multiObjectWidth.x, multiObjectWidth.y, multiObjectWidth.z);
            this.selectedFrontRightBottom.position.copy(FrontRightBottomPosition);
            this.selectedFrontRightBottom.scale.set(multiObjectWidth.x, multiObjectWidth.y, multiObjectWidth.z);

            this.selectedBackLeftBottom.position.copy(BackLeftBottomPosition);
            this.selectedBackLeftBottom.scale.set(multiObjectWidth.x, multiObjectWidth.y, multiObjectWidth.z);
            this.selectedBackRightBottom.position.copy(BackRightBottomPosition);
            this.selectedBackRightBottom.scale.set(multiObjectWidth.x, multiObjectWidth.y, multiObjectWidth.z);

            this.selectedFrontLeftTop.position.copy(FrontLeftTopPosition);
            this.selectedFrontLeftTop.scale.set(multiObjectWidth.x, multiObjectWidth.y, multiObjectWidth.z);
            this.selectedFrontRightTop.position.copy(FrontRightTopPosition);
            this.selectedFrontRightTop.scale.set(multiObjectWidth.x, multiObjectWidth.y, multiObjectWidth.z);

            this.selectedBackLeftTop.position.copy(BackLeftTopPosition);
            this.selectedBackLeftTop.scale.set(multiObjectWidth.x, multiObjectWidth.y, multiObjectWidth.z);
            this.selectedBackRightTop.position.copy(BackRightTopPosition);
            this.selectedBackRightTop.scale.set(multiObjectWidth.x, multiObjectWidth.y, multiObjectWidth.z);

            this.handles.push(...this.selectedFrontLeftBottom.children);
            this.handles.push(...this.selectedFrontRightBottom.children);
            this.handles.push(...this.selectedBackLeftBottom.children);
            this.handles.push(...this.selectedBackRightBottom.children);

            this.handles.push(...this.selectedFrontLeftTop.children);
            this.handles.push(...this.selectedFrontRightTop.children);
            this.handles.push(...this.selectedBackLeftTop.children);
            this.handles.push(...this.selectedBackRightTop.children);

            if (this.mode === 'translate') {
                this.translatePeripheral.position.copy(multiObjectPosition);
                this.translatePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.translatePicker.position.copy(multiObjectPosition);
                this.translatePicker.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.handles.push(...this.translatePeripheral.children);
            } else if (this.mode === 'rotate') {
                this.rotatePeripheral.position.copy(multiObjectPosition);
                this.rotatePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.rotatePicker.position.copy(multiObjectPosition);
                this.rotatePicker.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.handles.push(...this.rotatePeripheral.children);
            } else if (this.mode === 'scale') {
                this.scalePeripheral.position.copy(multiObjectPosition);
                this.scalePeripheral.quaternion.copy(this.parentQuaternion);
                this.scalePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.scalePicker.position.copy(multiObjectPosition);
                this.scalePicker.quaternion.copy(this.parentQuaternion);
                this.scalePicker.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

                this.handles.push(...this.scalePeripheral.children);
            }


            // Highlight peripherals internals based on axis selected
            for (const handle of this.handles) {
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
                    if (handle.label === this.axis || handle.label.includes(this.axis)) {
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
                const unitXLocal = new Vector3(1, 0, 0).applyQuaternion(this.parentQuaternion);
                const unitYLocal = new Vector3(0, 1, 0).applyQuaternion(this.parentQuaternion);
                const unitZLocal = new Vector3(0, 0, 1).applyQuaternion(this.parentQuaternion);

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
        this.object = new Group();
        this.visible = true;
        objects.forEach((item, index) => {
            // can't use add operation, use '=' to make sure it's a reference
            this.object.children[index] = item;
        });

        this.dispatchEvent(EVENTS.UPDATE);
    }


    detach() {
        this.object = new Group();
        this.visible = false;
        this.hideSelectedPeripherals();
        this.hideAllPeripherals();

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


        // this.positionStart.copy(this.object.position);
        this.quaternionStart.copy(this.object.quaternion);
        this.scaleStart.copy(this.object.scale);
        const maxObjectPosition = new Vector3();
        const minObjectPosition = new Vector3();

        this.object.children.forEach((item, index) => {
            this.eachObjectPositionStart[index] = new Vector3();
            this.eachObjectPositionStart[index].copy(item.position);
            this.eachObjectScaleStart[index] = new Vector3();
            this.eachObjectScaleStart[index].copy(item.scale);
            this.eachObjectQuaternionStart[index] = new Quaternion();
            this.eachObjectQuaternionStart[index].copy(item.quaternion);

            maxObjectPosition.x = Math.max(item.position.x, maxObjectPosition.x);
            maxObjectPosition.y = Math.max(item.position.y, maxObjectPosition.y);
            maxObjectPosition.z = Math.max(item.position.z, maxObjectPosition.z);

            minObjectPosition.x = Math.min(item.position.x, minObjectPosition.x);
            minObjectPosition.y = Math.min(item.position.y, minObjectPosition.y);
            minObjectPosition.z = Math.min(item.position.z, minObjectPosition.z);
        });

        if (this.object.children.length > 1) {
            this.multiObjectScaleCenter.x = (maxObjectPosition.x + minObjectPosition.x) / 2;
            this.multiObjectScaleCenter.y = (maxObjectPosition.y + minObjectPosition.y) / 2;
            this.multiObjectScaleCenter.z = (maxObjectPosition.z + minObjectPosition.z) / 2;
        } else {
            this.multiObjectScaleCenter.x = (maxObjectPosition.x + minObjectPosition.x);
            this.multiObjectScaleCenter.y = (maxObjectPosition.y + minObjectPosition.y);
            this.multiObjectScaleCenter.z = (maxObjectPosition.z + minObjectPosition.z);
        }


        // pointStart is in world space
        this.pointStart.copy(intersect.point);


        this.dragging = true;

        return true;
    }

    onMouseMove(coord) {
        if (!(this.object.children && this.object.children.length > 0) || !this.axis || !this.dragging) {
            return false;
        }

        this.ray.setFromCamera(coord, this.camera);

        const intersect = this.ray.intersectObject(this.plane, true)[0];
        if (!intersect) {
            return false;
        }

        this.pointEnd.copy(intersect.point);
        // const MatrixCoor = this.object.parent.matrixWorld;

        const MatrixCoor = [];
        this.object.children.forEach((item, index) => {
            MatrixCoor[index] = item.parent.matrixWorld;
        });

        // translate
        switch (this.mode) {
            case 'translate': {
                this.object.children.forEach((eachObject, index) => {
                    const offset = new Vector3().subVectors(this.pointEnd, this.pointStart);

                    offset.x = (this.axis === 'X' ? offset.x : 0);
                    offset.y = (this.axis === 'Y' ? offset.y : 0);
                    offset.z = (this.axis === 'Z' ? offset.z : 0);
                    // Dive in to object local offset
                    offset.applyQuaternion(this.parentQuaternionInv).divide(this.parentScale);

                    // still need to copy the start position
                    eachObject.position.copy(this.eachObjectPositionStart[index]).add(offset);
                });

                break;
            }
            case 'rotate': {
                const offset = new Vector3().subVectors(this.pointEnd, this.pointStart);
                const cameraPosition = new Vector3().setFromMatrixPosition(this.camera.matrixWorld);

                this.object.children.forEach((item, index) => {
                    const objectPosition = new Vector3().copy(item.position).applyMatrix4(MatrixCoor[index]); // TODO: optimize?
                    const eyeDistance = cameraPosition.distanceTo(objectPosition);
                    const ROTATION_SPEED = 20 / eyeDistance;

                    const rotationAxis = new Vector3((this.axis === 'X') ? 1 : 0, (this.axis === 'Y') ? 1 : 0, (this.axis === 'Z') ? 1 : 0);
                    const rotationAngle = offset.dot(new Vector3().crossVectors(rotationAxis, cameraPosition).normalize()) * ROTATION_SPEED;
                    rotationAxis.applyQuaternion(this.parentQuaternionInv);
                    const quaternion = new Quaternion().setFromAxisAngle(rotationAxis, rotationAngle);

                    item.quaternion.copy(quaternion).multiply(this.eachObjectQuaternionStart[index]).normalize();
                    // item.quaternion.copy(this.multiplyQuaternion(quaternion, this.eachObjectQuaternionStart[index])).multiply(this.eachObjectQuaternionStart[index]).normalize();
                });


                break;
            }
            case 'scale': {
                this.object.children.forEach((item, index) => {
                    const objectPosition = new Vector3().copy(this.object.position).applyMatrix4(MatrixCoor[index]); // TODO: optimize?
                    const sVec = new Vector3().copy(this.pointStart).sub(objectPosition).applyQuaternion(this.objectQuaternionInv[index]);
                    const eVec = new Vector3().copy(this.pointEnd).sub(objectPosition).applyQuaternion(this.objectQuaternionInv[index]);
                    eVec.divide(sVec);
                    if (item.uniformScalingState === true) {
                        if (this.axis === 'X') {
                            eVec.y = eVec.x;
                            eVec.z = eVec.x;
                        } else if (this.axis === 'Y') {
                            eVec.z = eVec.y;
                            eVec.x = eVec.y;
                        } else {
                            eVec.y = eVec.z;
                            eVec.x = eVec.z;
                        }
                    } else {
                        eVec.x = (this.axis === 'X' ? eVec.x : 1);
                        eVec.y = (this.axis === 'Y' ? eVec.y : 1);
                        eVec.z = (this.axis === 'Z' ? eVec.z : 1);
                    }
                    item.position.copy(this.calculateScalePosition(this.eachObjectPositionStart[index], this.multiObjectScaleCenter, eVec));
                    item.scale.copy(this.multiplyVector(this.scaleStart, this.eachObjectScaleStart[index])).multiply(eVec);
                });
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
