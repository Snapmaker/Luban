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
    LineBasicMaterial,
    Math as ThreeMath,
} from 'three';
// import * as THREE from 'three';
import { throttle } from 'lodash';
import ThreeUtils from '../../../scene/three-extensions/ThreeUtils';


import { ArcBufferGeometry } from './ArcGeometry';
import { SCALE_MODE, TRANSLATE_MODE } from '../../../constants';

const EVENTS = {
    UPDATE: { type: 'update' }
};

const OUTLINE = 'OUTLINE';
// let objectCase = null;

export const emitUpdatePositionEvent = throttle((transformData) => {
    return window.dispatchEvent(
        new CustomEvent('update-position', {
            detail: transformData
        })
    );
}, 300);

export const emitUpdateScaleEvent = throttle((transformData) => {
    return window.dispatchEvent(
        new CustomEvent('update-scale', {
            detail: transformData
        })
    );
}, 300);

export const emitUpdateRotateEvent = throttle((transformData) => {
    return window.dispatchEvent(
        new CustomEvent('update-rotate', {
            detail: transformData
        })
    );
}, 300);

export const emitUpdateControlInputEvent = throttle((transformData) => {
    return window.dispatchEvent(
        new CustomEvent('update-control-input', {
            detail: transformData
        })
    );
}, 300);

const RED = 0xff5759;
const GREEN = 0x4cb518;
const BLUE = 0x1890ff;
const RED2 = 0xb32426;
const GREEN2 = 0x287303;
const BLUE2 = 0x0064c2;
const GRAY = 0xd5d6d9;
const GRAY2 = 0x2a2c2e;
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

    object = null; // new Group();

    _mode = null;

    _axis = null;

    _inProgress = false;

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

    prevMeshHover = null;

    hoverFace = null;

    boxCenter = new Vector3();

    constructor(camera, isPrimeTower) {
        super();

        this.camera = camera;
        this.visible = false;
        this.isPrimeTower = isPrimeTower;
        this.objectConvexMeshGroup = new Group();

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
        peripheral.name = 'Peripheral';

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

    initDefaults() {
        // geometries
        const lineGeometry = new BufferGeometry();
        lineGeometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 10, 0, 0], 3));

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


        // const RED = 0xe93100;
        // const GREEN = 0x22ac38;
        // const BLUE = 0x00b7ee;
        // const DARKGRAY = 0x2778dd;

        const meshMaterialRed = meshMaterial.clone();
        meshMaterialRed.color.set(RED);

        const meshMaterialGreen = meshMaterial.clone();
        meshMaterialGreen.color.set(GREEN);

        const meshMaterialBlue = meshMaterial.clone();
        meshMaterialBlue.color.set(BLUE);

        const meshMaterialRed2 = meshMaterial.clone();
        meshMaterialRed2.color.set(RED2);

        const meshMaterialGreen2 = meshMaterial.clone();
        meshMaterialGreen2.color.set(GREEN2);

        const meshMaterialBlue2 = meshMaterial.clone();
        meshMaterialBlue2.color.set(BLUE2);

        const meshMaterialGray2 = meshMaterial.clone();
        meshMaterialGray2.color.set(GRAY2);
        meshMaterialGray2.opacity = 0.1;


        const meshMaterialInvisible = meshMaterial.clone();
        meshMaterialInvisible.visible = false;
        meshMaterialInvisible.color.set(BLUE);

        const lineMaterialDarkGray = selectedlineMaterial.clone();
        lineMaterialDarkGray.color.set(BLUE);// DARKGRAY);

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

            MESH_MATERIAL_RED2: meshMaterialRed2,
            MESH_MATERIAL_GREEN2: meshMaterialGreen2,
            MESH_MATERIAL_BLUE2: meshMaterialBlue2,
            MESH_MATERIAL_GRAY2: meshMaterialGray2,

            LINE_MATERIAL_DARKGRAY: lineMaterialDarkGray,
            LINE_MATERIAL_RED: lineMaterialRed,
            LINE_MATERIAL_GREEN: lineMaterialGreen,
            LINE_MATERIAL_BLUE: lineMaterialBlue,
            LINE_MATERIAL_GRAY: lineMaterialGray
        };


        this.defaults.LINE.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
    }

    destroyDefaults() {
        this.defaults = null;
    }

    initTranslatePeripherals() {
        const defaults = this.defaults;
        const xyTranslatePeripheralArr = [
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_RED.clone())],
            ['X', new Mesh(defaults.ARROW.clone(), defaults.MESH_MATERIAL_RED.clone()), [1, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_GREEN.clone()), null, [0, 0, Math.PI / 2]],
            ['Y', new Mesh(defaults.ARROW.clone(), defaults.MESH_MATERIAL_GREEN.clone()), [0, 1, 0]],
            ['XY', new Mesh(defaults.PLANE.clone(), defaults.MESH_MATERIAL_BLUE.clone()), [0.15, 0.15, 0]]
        ];
        const zTranslatePeripheralArr = [
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_BLUE.clone()), null, [0, -Math.PI / 2, 0]],
            ['Z', new Mesh(defaults.ARROW.clone(), defaults.MESH_MATERIAL_BLUE.clone()), [0, 0, 1], [Math.PI / 2, 0, 0]]
        ];
        const tempPeripheralArr = this.isPrimeTower ? xyTranslatePeripheralArr : xyTranslatePeripheralArr.concat(zTranslatePeripheralArr);
        this.translatePeripheral = this.createPeripheral(tempPeripheralArr);
        this.translatePeripheral.visible = false;
        this.add(this.translatePeripheral);

        const xyTranslatePickerArr = [
            ['X', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0.6, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0.6, 0]],
            ['XY', new Mesh(defaults.PLANE.clone(), defaults.MESH_MATERIAL_INVISIBLE.clone()), [0.15, 0.15, 0]]
        ];
        const zTranslatePickerArr = [
            ['Z', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0, 0.6], [Math.PI / 2, 0, 0]]
        ];
        const tempTranslatePickerArr = this.isPrimeTower ? xyTranslatePickerArr : xyTranslatePickerArr.concat(zTranslatePickerArr);
        this.translatePicker = this.createPeripheral(tempTranslatePickerArr);
        this.translatePicker.visiable = false;
        this.add(this.translatePicker);
    }

    initSelectedPeripherals() {
        const defaults = this.defaults;
        // bottom
        this.selectedFrontLeftBottom = this.createPeripheral([
            [OUTLINE, new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, null, [0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, 0, Math.PI / 2], [0.2, 0.2, 0.2]],
            [OUTLINE, new Line(defaults.SELECTEDLINE.clone(), defaults.LINE_MATERIAL_DARKGRAY.clone()), null, [0, -Math.PI / 2, 0], [0.2, 0.2, 0.2]],
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
            this.selectedBackRightTop,
        ];
        this.allSelectedPeripherals.forEach((peripheral) => {
            this.add(peripheral);
        });
    }

    hideAllPeripherals() {
        this.translatePeripheral.visible = false;
        this.rotatePeripheral.visible = false;
        this.scalePeripheral.visible = false;
        this.mirrorPeripheral.visible = false;
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

    setHoverFace(face) {
        this.hoverFace = face;

        switch (face) {
            case 'left':
                this.leftPlane.children[0].material.color.set(BLUE);
                this.leftPlane.children[0].material.opacity = 0.5;
                this.planeArr.forEach((item) => {
                    if (item.children[0].label !== 'LEFTPLANE') {
                        item.children[0].material.color.set(GRAY2);
                        item.children[0].material.opacity = 0.1;
                    }
                    item.visible = true;
                });
                break;
            case 'top':
                this.topPlane.children[0].material.color.set(BLUE);
                this.topPlane.children[0].material.opacity = 0.5;
                this.planeArr.forEach((item) => {
                    if (item.children[0].label !== 'TOPPLANE') {
                        item.children[0].material.color.set(GRAY2);
                        item.children[0].material.opacity = 0.1;
                    }
                    item.visible = true;
                });
                break;
            case 'right':
                this.rightPlane.children[0].material.color.set(BLUE);
                this.rightPlane.children[0].material.opacity = 0.5;
                this.planeArr.forEach((item) => {
                    if (item.children[0].label !== 'RIGHTPLANE') {
                        item.children[0].material.color.set(GRAY2);
                        item.children[0].material.opacity = 0.1;
                    }
                    item.visible = true;
                });
                break;
            case 'front':
                this.frontPlane.children[0].material.color.set(BLUE);
                this.frontPlane.children[0].material.opacity = 0.5;
                this.planeArr.forEach((item) => {
                    if (item.children[0].label !== 'FRONTPLANE') {
                        item.children[0].material.color.set(GRAY2);
                        item.children[0].material.opacity = 0.1;
                    }
                    item.visible = true;
                });
                break;
            case 'back':
                this.backPlane.children[0].material.color.set(BLUE);
                this.backPlane.children[0].material.opacity = 0.5;
                this.planeArr.forEach((item) => {
                    if (item.children[0].label !== 'BACKPLANE') {
                        item.children[0].material.color.set(GRAY2);
                        item.children[0].material.opacity = 0.1;
                    }
                    item.visible = true;
                });
                break;
            default:
                this.planeArr.forEach(item => {
                    item.visible = false;
                });
                break;
        }
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
        this.rotatePeripheral.name = 'Rotate Peripheral';
        this.add(this.rotatePeripheral);

        this.rotatePicker = this.createPeripheral([
            ['X', new Mesh(defaults.ROTATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), null, [0, Math.PI / 2, 0]],
            ['Y', new Mesh(defaults.ROTATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), null, [Math.PI / 2, 0, 0]],
            ['Z', new Mesh(defaults.ROTATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE)]
        ]);
        this.rotatePicker.name = 'Rotate Picker';
        this.rotatePicker.visiable = false;
        this.add(this.rotatePicker);
        this.leftPlane = this.createPeripheral([
            ['LEFTPLANE', new Mesh(new PlaneBufferGeometry(1, 1, 2), defaults.MESH_MATERIAL_GRAY2.clone()), null, [Math.PI / 2, Math.PI / 2, 0], null]
        ]);
        this.rightPlane = this.createPeripheral([
            ['RIGHTPLANE', new Mesh(new PlaneBufferGeometry(1, 1, 2), defaults.MESH_MATERIAL_GRAY2.clone()), null, [Math.PI / 2, Math.PI / 2, 0], null]
        ]);
        this.topPlane = this.createPeripheral([
            ['TOPPLANE', new Mesh(new PlaneBufferGeometry(1, 1, 2), defaults.MESH_MATERIAL_GRAY2.clone()), null, null, null]
        ]);
        this.bottomPlane = this.createPeripheral([
            ['BOTTOMPLANE', new Mesh(new PlaneBufferGeometry(1, 1, 2), defaults.MESH_MATERIAL_GRAY2.clone()), null, null, null]
        ]);
        this.frontPlane = this.createPeripheral([
            ['FRONTPLANE', new Mesh(new PlaneBufferGeometry(1, 1, 2), defaults.MESH_MATERIAL_GRAY2.clone()), null, [Math.PI / 2, 0, 0], null]
        ]);
        this.backPlane = this.createPeripheral([
            ['BACKPLANE', new Mesh(new PlaneBufferGeometry(1, 1, 2), defaults.MESH_MATERIAL_GRAY2.clone()), null, [Math.PI / 2, 0, 0], null]
        ]);
        this.planeArr = [
            this.leftPlane,
            this.rightPlane,
            this.topPlane,
            this.bottomPlane,
            this.frontPlane,
            this.backPlane
        ];
        this.planeArr.forEach(item => {
            item.visible = false;
            this.add(item);
        });
    }

    initScalePeripherals() {
        const defaults = this.defaults;
        const xyScalePeripheral = [
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_RED.clone())],
            ['X', new Mesh(defaults.BOX.clone(), defaults.MESH_MATERIAL_RED.clone()), [1, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_GREEN.clone()), null, [0, 0, Math.PI / 2]],
            ['Y', new Mesh(defaults.BOX.clone(), defaults.MESH_MATERIAL_GREEN.clone()), [0, 1, 0]]
        ];
        const zScalePeripheral = [
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_BLUE.clone()), null, [0, -Math.PI / 2, 0]],
            ['Z', new Mesh(defaults.BOX.clone(), defaults.MESH_MATERIAL_BLUE.clone()), [0, 0, 1], [Math.PI / 2, 0, 0]]
        ];
        const tempPeripheral = this.isPrimeTower ? xyScalePeripheral : xyScalePeripheral.concat(zScalePeripheral);
        this.scalePeripheral = this.createPeripheral(tempPeripheral);
        this.add(this.scalePeripheral);

        const xyScalePickerArr = [
            ['X', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0.6, 0, 0], [0, 0, -Math.PI / 2]],
            ['Y', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0.6, 0]]
        ];
        const zScalePickerArr = [
            ['Z', new Mesh(defaults.TRANSLATE_PICKER.clone(), defaults.MESH_MATERIAL_INVISIBLE), [0, 0, 0.6], [Math.PI / 2, 0, 0]]
        ];
        const tempPickerArr = this.isPrimeTower ? xyScalePickerArr : xyScalePickerArr.concat(zScalePickerArr);
        this.scalePicker = this.createPeripheral(tempPickerArr);
        this.scalePicker.visiable = false;
        this.add(this.scalePicker);

        this.mirrorPeripheral = this.createPeripheral([
            ['X', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_RED.clone())],
            ['Y', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_GREEN.clone()), null, [0, 0, Math.PI / 2]],
            ['Z', new Line(defaults.LINE.clone(), defaults.LINE_MATERIAL_BLUE.clone()), null, [0, -Math.PI / 2, 0]]
        ]);
        this.add(this.mirrorPeripheral);
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
            this.tooglePeripheralVisible();
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

            this.object.matrixWorld.decompose(objectPosition, objectQuaternion, objectScale);
            // parent
            this.object.parent.matrixWorld.decompose(this.parentPosition, this.parentQuaternion, this.parentScale);
            this.parentQuaternionInv.copy(this.parentQuaternion).invert();


            // Update peripherals as a whole (position, rotation, scale)
            const handles = [];
            const eyeDistance = cameraPosition.distanceTo(multiObjectPosition);
            const zero = new Vector3();
            const unitX = new Vector3(1, 0, 0);
            const unitY = new Vector3(0, 1, 0);
            const unitZ = new Vector3(0, 0, 1);
            if (this.object.shouldUpdateBoundingbox) {
                const selectedPeripheralsVisible = (this.objectConvexMeshGroup.children.length === 0);
                this.allSelectedPeripherals.forEach((peripheral) => {
                    peripheral.visible = selectedPeripheralsVisible;
                });
                const boundingBox = ThreeUtils.computeBoundingBox(this.object);
                const maxObjectBoundingBox = boundingBox.max;
                const minObjectBoundingBox = boundingBox.min;
                boundingBox.getCenter(this.boxCenter);
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
                this.leftPlane.position.copy(new Vector3(minObjectBoundingBox.x, (maxObjectBoundingBox.y + minObjectBoundingBox.y) / 2, (minObjectBoundingBox.z + maxObjectBoundingBox.z) / 2));
                this.leftPlane.scale.set(1, 1, 1).multiply(new Vector3(1, maxObjectBoundingBox.y - minObjectBoundingBox.y, maxObjectBoundingBox.z - minObjectBoundingBox.z));

                this.rightPlane.position.copy(new Vector3(maxObjectBoundingBox.x, (maxObjectBoundingBox.y + minObjectBoundingBox.y) / 2, (minObjectBoundingBox.z + maxObjectBoundingBox.z) / 2));
                this.rightPlane.scale.set(1, 1, 1).multiply(new Vector3(1, maxObjectBoundingBox.y - minObjectBoundingBox.y, maxObjectBoundingBox.z - minObjectBoundingBox.z));

                this.topPlane.position.copy(new Vector3((minObjectBoundingBox.x + maxObjectBoundingBox.x) / 2, (minObjectBoundingBox.y + maxObjectBoundingBox.y) / 2, maxObjectBoundingBox.z));
                this.topPlane.scale.set(1, 1, 1).multiply(new Vector3(maxObjectBoundingBox.x - minObjectBoundingBox.x, maxObjectBoundingBox.y - minObjectBoundingBox.y, 1));

                this.bottomPlane.position.copy(new Vector3((minObjectBoundingBox.x + maxObjectBoundingBox.x) / 2, (minObjectBoundingBox.y + maxObjectBoundingBox.y) / 2, minObjectBoundingBox.z));
                this.bottomPlane.scale.set(1, 1, 1).multiply(new Vector3(maxObjectBoundingBox.x - minObjectBoundingBox.x, maxObjectBoundingBox.y - minObjectBoundingBox.y, 1));

                this.frontPlane.position.copy(new Vector3((minObjectBoundingBox.x + maxObjectBoundingBox.x) / 2, minObjectBoundingBox.y, (minObjectBoundingBox.z + maxObjectBoundingBox.z) / 2));
                this.frontPlane.scale.set(1, 1, 1).multiply(new Vector3(maxObjectBoundingBox.x - minObjectBoundingBox.x, 1, maxObjectBoundingBox.z - minObjectBoundingBox.z));

                this.backPlane.position.copy(new Vector3((minObjectBoundingBox.x + maxObjectBoundingBox.x) / 2, maxObjectBoundingBox.y, (minObjectBoundingBox.z + maxObjectBoundingBox.z) / 2));
                this.backPlane.scale.set(1, 1, 1).multiply(new Vector3(maxObjectBoundingBox.x - minObjectBoundingBox.x, 1, maxObjectBoundingBox.z - minObjectBoundingBox.z));
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
            } else if (this.mode === 'mirror') {
                this.mirrorPeripheral.position.copy(multiObjectPosition);
                this.mirrorPeripheral.quaternion.copy(objectQuaternion);
                this.mirrorPeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);
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
                        if (handle.label === 'X') {
                            handle.material.color.set(RED2);
                        } else if (handle.label === 'Y') {
                            handle.material.color.set(GREEN2);
                        } else if (handle.label === 'Z') {
                            handle.material.color.set(BLUE2);
                        } else if (handle.label === 'XY') {
                            handle.material.color.set(BLUE2);
                        }
                    } else {
                        if (handle.label === 'X') {
                            handle.material.color.set(RED);
                        } else if (handle.label === 'Y') {
                            handle.material.color.set(GREEN);
                        } else if (handle.label === 'Z') {
                            handle.material.color.set(BLUE);
                        } else if (handle.label === 'XY') {
                            handle.material.color.set(BLUE);
                        }
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

    hasHideModel(obj = this.object) {
        if (!!obj && !obj.visible) {
            return true;
        }
        if (obj?.children.length) {
            return obj.children.some((child) => {
                return this.hasHideModel(child);
            });
        }
        return false;
    }

    tooglePeripheralVisible() {
        const res = this.hasHideModel();

        this.translatePeripheral.visible = (this.mode === 'translate' && !res);
        this.rotatePeripheral.visible = (this.mode === 'rotate' && !res && !this.isPrimeTower);
        this.scalePeripheral.visible = (this.mode === 'scale' && !res);
        this.mirrorPeripheral.visible = (this.mode === 'mirror' && !res && !this.isPrimeTower);
    }

    attach(objects) {
        this.object = objects;
        this.visible = true;

        this.dispatchEvent(EVENTS.UPDATE);
        this.tooglePeripheralVisible();
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
            case 'rotate-placement':
                picker = this.objectConvexMeshGroup;
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
        if (this.mode === 'rotate-placement') {
            if (intersect) {
                if (this.prevMeshHover !== intersect.object) {
                    intersect.object.material.opacity = 0.9;
                    if (this.prevMeshHover) {
                        this.prevMeshHover.material.opacity = 0.3;
                    }
                    this.prevMeshHover = intersect.object;
                }
            } else {
                if (this.prevMeshHover) {
                    this.prevMeshHover.material.opacity = 0.3;
                }
                this.prevMeshHover = null;
            }
            this.dispatchEvent(EVENTS.UPDATE);
        }

        return true;
    }

    onMouseDown(coord) {
        if (!this.mode) {
            return false;
        }
        if (!(this.object.children && this.object.children.length > 0) || !this.axis) {
            return false;
        }
        this.ray.setFromCamera(coord, this.camera);

        const intersect = this.ray.intersectObject(this.plane, true)[0];
        if (!intersect) {
            return false;
        }
        let data = {};
        if (this.mode?.toLowerCase() === SCALE_MODE) {
            data = {
                x: Math.round(Math.abs(this.object.scale.x) * 1000) / 10,
                y: Math.round(Math.abs(this.object.scale.y) * 1000) / 10,
                z: Math.round(Math.abs(this.object.scale.z) * 1000) / 10
            };
        } else if (this.mode?.toLowerCase() === TRANSLATE_MODE) {
            data = {
                x: Math.round(this.object.position.x * 10) / 10,
                y: Math.round(this.object.position.y * 10) / 10,
                z: Math.round(this.object.position.z * 10) / 10
            };
        }
        emitUpdateControlInputEvent({
            controlValue: {
                mode: this.mode.toLowerCase(),
                axis: this.axis.toLowerCase(),
                data
            }
        });

        this.quaternionStart.copy(this.object.quaternion);
        this.scaleStart.copy(this.object.scale);
        this.positionStart.copy(this.object.position);


        // pointStart is in world space
        this.pointStart.copy(intersect.point);
        this.dragging = true;

        return true;
    }

    onMouseMove(coord, isPrimeTower = false) {
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
                const roundPosition = {
                    x: Math.round(this.object.position.x * 10) / 10,
                    y: Math.round(this.object.position.y * 10) / 10,
                    z: Math.round(this.object.position.z * 10) / 10
                };
                emitUpdatePositionEvent({
                    position: roundPosition
                });
                emitUpdateControlInputEvent({
                    controlValue: {
                        mode: this.mode.toLowerCase(),
                        data: roundPosition,
                        axis: this.axis.toLowerCase()
                    }
                });
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
                const roundRotate = Math.round(ThreeMath.radToDeg(rotationAngle) * 10) / 10;
                emitUpdateRotateEvent({
                    rotate: {
                        [this.axis.toLowerCase()]: roundRotate,
                        rotateAxis: this.axis.toLowerCase()
                    }
                });
                emitUpdateControlInputEvent({
                    controlValue: {
                        mode: this.mode.toLowerCase(),
                        data: {
                            [this.axis.toLowerCase()]: roundRotate
                        },
                        axis: this.axis.toLowerCase()
                    }
                });
                break;
            }
            case 'scale': {
                const objectPosition = new Vector3().copy(this.object.position); // TODO: optimize?
                const absStartVector = new Vector3().copy(this.pointStart).sub(objectPosition);
                const absEndVector = new Vector3().copy(this.pointEnd).sub(objectPosition);
                if (this.axis === 'X') {
                    absStartVector.setX(Math.abs(absStartVector.x));
                    absEndVector.setX(Math.abs(absEndVector.x));
                } else if (this.axis === 'Y') {
                    absStartVector.setY(Math.abs(absStartVector.y));
                    absEndVector.setY(Math.abs(absEndVector.y));
                } else {
                    absStartVector.setZ(Math.abs(absStartVector.z));
                    absEndVector.setZ(Math.abs(absEndVector.z));
                }
                const parentSVec = absStartVector.applyQuaternion(this.parentQuaternionInv);
                const parentEVec = absEndVector.applyQuaternion(this.parentQuaternionInv);
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
                    if (isPrimeTower) {
                        parentEVec.x = this.axis === 'Y' ? parentEVec.y : parentEVec.x;
                        parentEVec.y = this.axis === 'X' ? parentEVec.x : parentEVec.y;
                        parentEVec.z = 1;
                    } else {
                        parentEVec.x = (this.axis === 'X' ? parentEVec.x : 1);
                        parentEVec.y = (this.axis === 'Y' ? parentEVec.y : 1);
                        parentEVec.z = (this.axis === 'Z' ? parentEVec.z : 1);
                    }
                }
                if (this.shouldApplyScaleToObjects(parentEVec)) {
                    this.object.scale.copy(this.scaleStart).multiply(parentEVec);
                }
                const roundScale = {
                    x: Math.round(Math.abs(this.object.scale.x) * 1000) / 10,
                    y: Math.round(Math.abs(this.object.scale.y) * 1000) / 10,
                    z: Math.round(Math.abs(this.object.scale.z) * 1000) / 10
                };
                emitUpdateScaleEvent({
                    scale: roundScale,
                    isPrimeTower,
                    axis: this.axis.toLowerCase()
                });
                emitUpdateControlInputEvent({
                    controlValue: {
                        mode: this.mode.toLowerCase(),
                        axis: this.axis.toLowerCase(),
                        data: roundScale,
                        isPrimeTower
                    }
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
        this.updateBoundingBox();
        this.dragging = false;
        if (this.mode === 'rotate') {
            emitUpdateRotateEvent({
                rotate: {
                    x: null,
                    y: null,
                    z: null,
                    rotateAxis: null
                }
            });
            emitUpdateControlInputEvent({
                controlValue: {
                    mode: this.mode.toLowerCase(),
                    axis: null,
                    data: null
                }
            });
        }
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
        if (this.object) {
            this.object.shouldUpdateBoundingbox = true;
        }
    }

    setObjectConvexMeshGroup(group) {
        this.objectConvexMeshGroup = group;
    }
}

export default TransformControls;
