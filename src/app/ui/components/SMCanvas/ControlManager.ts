/**
 * Controls for canvas based on OrbitControls.
 *
 * Reference: [OrbitControls](https://github.com/mrdoob/three.js/blob/master/examples/js/controls/OrbitControls.js)
 */
import EventEmitter from 'events';
import { isUndefined, throttle } from 'lodash';
import * as THREE from 'three';
import { Vector3 } from 'three';

import { SELECTEVENT } from '../../../constants';
import log from '../../../lib/log';
import { CLIPPING_LINE_COLOR } from '../../../models/ModelGroup';
import TransformControls from './TransformControls';
import TransformControls2D from './TransformControls2D';
import Control, { Pointer } from './Control';

const EPS = 0.000001;

const STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TRANSFORM: 3,
    SUPPORT: 4,
    ROTATE_PLACEMENT: 5,
};

// Events sent by Controls
export const EVENTS = {
    UPDATE: 'update',
    CONTEXT_MENU: 'contextmenu',
    SELECT_OBJECTS: 'object:select',
    // UNSELECT_OBJECT: 'object:unselect',
    BEFORE_TRANSFORM_OBJECT: 'object:beforetransform',
    TRANSFORM_OBJECT: 'object:transform',
    AFTER_TRANSFORM_OBJECT: 'object:aftertransform',
    SELECT_PLACEMENT_FACE: 'placement:select',
    PAN_SCALE: 'pan:scale',
    UPDATE_CAMERA: 'update:camera'
};

let inputDOM = null;
let inputDOM2 = null; // translate has two input for X and Y axis

class ControlManager extends EventEmitter {
    private camera = null;

    private group = null;

    private domElement = null;

    private transformControl = null;

    private state = STATE.NONE;
    private prevState = null;

    // "target" is where the camera orbits around
    private target = new Vector3();

    private lastPosition = new Vector3();

    private lastQuaternion = new THREE.Quaternion();

    private minDistance = 10;

    // calculation temporary variables
    // spherical rotation
    private enableRotate = true;

    private maxDistance = 3500;

    // rotate
    private spherical = new THREE.Spherical();
    private sphericalDelta = new THREE.Spherical();
    private rotateStart = new THREE.Vector2();
    private rotateMoved = false;

    // pan
    private panOffset = new THREE.Vector3();
    private panPosition = new THREE.Vector2();
    private panMoved = false;
    private panScale = 1; // pan zoom factor, when distance is 700, the init panScale is 1

    // scale
    private scale = 1;
    private scaleRate = 0.90;
    private minScale: number;
    private maxScale: number;
    private scaleSize: number;

    // calculation only
    private offset = new THREE.Vector3();

    // detection
    private selectableObjects = null;
    private highlightableObjects = null;
    private highlightLine = null;
    private pointer = new THREE.Vector2();

    private shouldForbidSelect = false;

    private selectedGroup = null;

    // Set to true to zoom to cursor ,panning may have to be enabled
    private zoomToCursor = false;

    private mouse3D = new THREE.Vector3();

    private ray = new THREE.Raycaster();

    private horizontalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    // Track if mouse moved during "mousedown" to "mouseup".
    private mouseDownPosition = null;

    private clickEnabled = true;

    private isMouseDown = false;

    private isClickOnPeripheral = false;

    private highLightOnMouseMove = throttle(() => {
        this.hoverLine();
    }, 300);

    // controls
    /**
     * mode:
     *  - default mode: MSR
     *  - custom mode: race between custom control and MSR
     */
    private mode: string = '';
    private controls: Control[] = [];
    private modeControlMap: Map<string, Control> = new Map();

    // TODO: Refactor this
    private sourceType: string;
    private displayedType: string;
    private onScale: () => void;
    private onPan: () => void;
    private supportActions: object;
    private isPrimeTower: boolean;

    public constructor(
        sourceType,
        displayedType,
        camera,
        group,
        domElement,
        onScale,
        onPan,
        supportActions,
        minScale = undefined,
        maxScale = undefined,
        scaleSize = undefined
    ) {
        super();

        this.sourceType = sourceType;
        this.displayedType = displayedType;
        this.camera = camera;
        this.group = group;
        this.domElement = (domElement !== undefined) ? domElement : document;
        this.onScale = onScale;
        this.onPan = onPan;
        this.zoomToCursor = (sourceType === '3D');

        this.initTransformControls();
        this.supportActions = supportActions;

        this.minScale = minScale;
        this.maxScale = maxScale;
        this.scaleSize = scaleSize;
        this.isPrimeTower = false;

        this.bindEventListeners();
        this.ray.params.Line.threshold = 0.5;
    }

    public getControl(mode: string): Control | null {
        return this.modeControlMap.get(mode) || null;
    }

    private removeControl(mode: string, silent: boolean = false): Control | null {
        const control = this.modeControlMap.get(mode);

        if (control) {
            this.modeControlMap.delete(mode);

            const index = this.controls.indexOf(control);
            this.controls.splice(index, 1);

            return control;
        } else {
            if (!silent) {
                log.warn(`Control with mode ${mode} not found.`);
            }
            return null;
        }
    }

    public registerControl(mode: string, control: Control): void {
        this.removeControl(mode, true);

        // Add mode -> control mapping
        this.modeControlMap.set(mode, control);

        this.controls.push(control);

        // sort controls by priority
        this.controls.sort((a, b) => a.getPriority() - b.getPriority());
    }

    public unregisterControl(mode: string): void {
        this.removeControl(mode, false);
    }

    public setMode(mode: string): void {
        this.mode = mode;

        for (const [controlMode, control] of this.modeControlMap.entries()) {
            if (controlMode === mode) {
                control.setEnabled(true);
            } else {
                control.setEnabled(false);
            }
        }
    }

    private initTransformControls() {
        if (this.sourceType === '3D') {
            this.transformControl = new TransformControls(this.camera);
        } else {
            this.transformControl = new TransformControls2D(this.camera);
        }
        this.transformControl.addEventListener('update', () => {
            this.emit(EVENTS.UPDATE);
        });
        this.group.add(this.transformControl);
    }

    public removeTransformControls() {
        this.group.remove(this.transformControl);
    }

    public getTransformControls() {
        return this.transformControl;
    }

    public recoverTransformControls(_isPrimeTower = false, mode) {
        if (_isPrimeTower) {
            this.transformControl = new TransformControls(this.camera, _isPrimeTower);
        } else {
            this.transformControl = new TransformControls(this.camera);
        }
        this.transformControl.addEventListener('update', () => {
            this.emit(EVENTS.UPDATE);
        });
        mode && this.setTransformMode(mode);
        this.group.add(this.transformControl);
    }

    public setTransformMode(mode) {
        if (this.transformControl) {
            this.transformControl.mode = mode;
        }
    }

    public setInProgress(inProgress) {
        if (this.transformControl) {
            this.transformControl.inProgress = inProgress;
        }
    }

    public setTarget(target) {
        this.target = target;

        this.updateCamera();
    }

    public setPrimeTower(value) {
        this.isPrimeTower = value;
    }

    public bindEventListeners() {
        this.domElement.addEventListener('mousedown', this.onMouseDown, false);
        this.domElement.addEventListener('mousemove', this.onMouseMove, false);
        this.domElement.addEventListener('wheel', this.onMouseWheel, false);
        this.domElement.addEventListener('click', this.onClick, false);

        document.addEventListener('contextmenu', this.onDocumentContextMenu, { capture: true });
    }

    public rotateLeft(angle) {
        this.sphericalDelta.theta -= angle;
    }

    public rotateUp(angle) {
        this.sphericalDelta.phi -= angle;
    }

    public rotate(deltaX, deltaY) {
        const elem = this.domElement === document ? document.body : this.domElement;

        this.rotateLeft(2 * Math.PI * deltaX / elem.clientHeight); // yes, height
        this.rotateUp(2 * Math.PI * deltaY / elem.clientHeight);
    }

    public panLeft(distance, matrix) {
        const v = new THREE.Vector3().setFromMatrixColumn(matrix, 0); // Get X column
        v.multiplyScalar(-distance);
        this.panOffset.add(v);
    }

    public panUp(distance, matrix) {
        const v = new THREE.Vector3().setFromMatrixColumn(matrix, 1); // Get Y column
        v.multiplyScalar(distance);
        this.panOffset.add(v);
    }

    public pan(deltaX, deltaY) {
        const elem = this.domElement === document ? document.body : this.domElement;

        this.offset.copy(this.camera.position).sub(this.target);
        // calculate move distance of target in perspective view of camera
        const distance = 2 * this.offset.length() * Math.tan(this.camera.fov / 2 * Math.PI / 180);
        let leftDistance = distance * deltaX / elem.clientWidth;
        let upDistance = distance * deltaY / elem.clientHeight;
        if (Math.abs(distance / elem.clientWidth) < 0.05) {
            leftDistance = 0.05 * deltaX;
        }
        if (Math.abs(distance / elem.clientHeight) < 0.05) {
            upDistance = 0.05 * deltaY;
        }
        this.panLeft(leftDistance, this.camera.matrix);
        this.panUp(upDistance, this.camera.matrix);
    }

    public setScale(scale) {
        this.scale = scale;
    }

    public dollyIn = () => {
        this.scale *= this.scaleRate;
    };

    public dollyOut = () => {
        this.scale /= this.scaleRate;
    };

    // Normalize mouse / touch pointer and remap to view space
    // Ref: https://github.com/mrdoob/three.js/blob/master/examples/js/controls/TransformControls.js#L515
    // https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/TransformControls.js
    public getMouseCoord(event) {
        const rect = this.domElement.getBoundingClientRect();
        // TODO: The result is not correct, change all the clientX/clientY as offsetX/offsetY
        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1 // Y axis up is positive
        };
    }

    // https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/TransformControls.js
    private getPointer(event: MouseEvent): Pointer {
        if (this.domElement.ownerDocument.pointerLockElement) {
            return new Pointer(0, 0, event.button);
        } else {
            const rect = this.domElement.getBoundingClientRect();

            // convert x, y to range [-1, 1]
            return new Pointer(
                (event.clientX - rect.left) / rect.width * 2 - 1,
                -(event.clientY - rect.top) / rect.height * 2 + 1,
                event.button
            );
        }
    }

    public onMouseDown = (event) => {
        this.isMouseDown = true;
        // Prevent the browser from scrolling.
        // event.preventDefault();
        this.mouseDownPosition = this.getMouseCoord(event);
        if (this.state === STATE.ROTATE_PLACEMENT) {
            this.prevState = STATE.ROTATE_PLACEMENT;
        }

        // controls
        let capturedByControl = false;
        for (const control of this.controls) {
            if (!control.isEnabled()) {
                continue;
            }

            const pointer = this.getPointer(event);
            if (control.onPointerDown(pointer)) {
                capturedByControl = true;
                break;
            }
        }

        if (!capturedByControl) {
            switch (event.button) {
                case THREE.MOUSE.LEFT: {
                    // Support
                    if (this.state === STATE.SUPPORT) {
                        const coord = this.getMouseCoord(event);
                        this.ray.setFromCamera(coord, this.camera);
                        this.ray.firstHitOnly = true;
                        const res = this.ray.intersectObject(this.selectedGroup.children.length ? this.selectedGroup : this.selectableObjects, true);
                        if (res.length) {
                            this.supportActions.applySupportBrush(res);
                            break;
                        }
                    }

                    // Transform on selected object
                    if (this.selectedGroup && this.selectedGroup.children.length > 0) {
                        const coord = this.getMouseCoord(event);
                        // Call hover to update axis selected
                        this.transformControl.onMouseHover(coord);
                        if (this.transformControl.onMouseDown(coord)) {
                            this.state = STATE.TRANSFORM;
                            this.emit(EVENTS.BEFORE_TRANSFORM_OBJECT);
                            this.isClickOnPeripheral = true;
                            break;
                        } else {
                            !inputDOM && (inputDOM = document.getElementById('control-input'));
                            !inputDOM2 && (inputDOM2 = document.getElementById('control-input-2'));
                            inputDOM && (inputDOM.style.display = 'none');
                            inputDOM2 && (inputDOM2.style.display = 'none');
                        }
                    }

                    if (event.ctrlKey || event.metaKey || event.shiftKey) {
                        this.state = STATE.PAN;
                        this.panMoved = !event.ctrlKey;
                        this.handleMouseDownPan(event);
                    } else {
                        this.state = STATE.ROTATE;
                        this.rotateMoved = false;
                        this.handleMouseDownRotate(event);
                    }
                    break;
                }
                case THREE.MOUSE.MIDDLE:
                    this.state = STATE.DOLLY;
                    // TODO
                    // this.handleMouseDownDolly(event);
                    break;
                case THREE.MOUSE.RIGHT:
                    this.state = STATE.PAN;
                    this.panMoved = false;
                    this.handleMouseDownPan(event);
                    break;
                default:
                    break;
            }
        }

        if (this.mode || this.state !== STATE.NONE) {
            // Track events even when the mouse move outside of window
            document.addEventListener('mousemove', this.onDocumentMouseMove, { capture: true });
            document.addEventListener('mouseup', this.onDocumentMouseUp, { capture: true });
        }
    };

    public onMouseMove = (event) => {
        event.preventDefault();

        const coord = this.getMouseCoord(event);
        this.pointer.x = coord.x;
        this.pointer.y = coord.y;

        if (this.state === STATE.NONE) {
            for (const control of this.controls) {
                if (!control.isEnabled()) {
                    continue;
                }

                const pointer = this.getPointer(event);
                if (control.onPointerHover(pointer)) return;
            }
        }

        // model move with mouse no matter mousedown
        if (this.state === STATE.SUPPORT || this.mode === 'mesh-coloring') {
            this.ray.setFromCamera(coord, this.camera);
            this.ray.firstHitOnly = true;
            const res = this.ray.intersectObject(this.selectedGroup.children.length ? this.selectedGroup : this.selectableObjects, true);
            if (res.length) {
                this.supportActions.moveBrush(res);
            }
            this.emit(EVENTS.UPDATE);
            return;
        }

        if (this.state === STATE.ROTATE_PLACEMENT) {
            // Let transform control deal with mouse move
            this.transformControl.onMouseHover(coord);
        }

        this.highLightOnMouseMove();

        if (!(this.selectedGroup && this.selectedGroup.children.length > 0) || this.state !== STATE.NONE) {
            return;
        }

        // Let transform control deal with mouse move
        this.transformControl.onMouseHover(coord);
    };

    public onDocumentMouseMove = (event) => {
        event.preventDefault();

        // controls
        if (this.state === STATE.NONE) {
            for (const control of this.controls) {
                if (!control.isEnabled()) {
                    continue;
                }

                const pointer = this.getPointer(event);
                if (control.onPointerMove(pointer)) return;
            }
        }

        switch (this.state) {
            case STATE.ROTATE:
                this.rotateMoved = true;
                this.handleMouseMoveRotate(event);
                break;
            case STATE.PAN:
                this.panMoved = true;
                this.handleMouseMovePan(event);
                break;
            case STATE.TRANSFORM:
                if (this.canOperateModel) {
                    this.transformControl.onMouseMove(this.getMouseCoord(event), this.isPrimeTower);
                }
                this.emit(EVENTS.TRANSFORM_OBJECT);
                break;
            case STATE.SUPPORT:
                if (this.isMouseDown) {
                    const coord = this.getMouseCoord(event);
                    this.ray.setFromCamera(coord, this.camera);
                    this.ray.firstHitOnly = true;
                    const res = this.ray.intersectObject(this.selectedGroup.children.length ? this.selectedGroup : this.selectableObjects, true);
                    if (res.length) {
                        this.supportActions.applySupportBrush(res);
                    }
                    this.emit(EVENTS.UPDATE);
                    event.stopPropagation();
                }
                break;
            default:
                break;
        }
    };

    public onDocumentMouseUp = (event) => {
        // controls
        let capturedByControl = false;
        if (this.state === STATE.NONE) {
            for (const control of this.controls) {
                if (!control.isEnabled()) {
                    continue;
                }

                const pointer = this.getPointer(event);
                if (control.onPointerUp(pointer)) {
                    capturedByControl = true;
                    break;
                }
            }
        }

        if (!capturedByControl) {
            switch (this.state) {
                case STATE.PAN:
                    if (!this.panMoved) {
                        if (this.prevState === STATE.ROTATE_PLACEMENT) {
                            break;
                        } else {
                            // check if any model selected
                            this.onClick(event, true);
                            // Right click to open context menu
                            // Note that the event is mouse up, not really contextmenu
                            !this.isPrimeTower && this.emit(EVENTS.CONTEXT_MENU, event);
                        }
                    } else {
                        this.onPan();
                    }
                    break;
                case STATE.TRANSFORM:
                    if (this.sourceType === '3D') {
                        this.emit(EVENTS.AFTER_TRANSFORM_OBJECT);
                    }
                    this.transformControl.onMouseUp();
                    break;
                case STATE.ROTATE_PLACEMENT:
                    this.prevState = STATE.ROTATE_PLACEMENT;
                    break;
                case STATE.SUPPORT:
                    this.prevState = STATE.SUPPORT;
                    break;
                default:
                    break;
            }
            this.state = this.prevState || STATE.NONE;
        } else {
            this.state = STATE.NONE;
        }

        document.removeEventListener('mousemove', this.onDocumentMouseMove, false);
        // mouse up needed no matter mousedown on support mode
        document.removeEventListener('mouseup', this.onDocumentMouseUp, false);

        this.isMouseDown = false;
    };

    public disableClick() {
        this.clickEnabled = false;

        this.transformControl.detach();
        this.emit(EVENTS.SELECT_OBJECTS, null, SELECTEVENT.UNSELECT);
    }

    public enableClick() {
        this.clickEnabled = true;
    }

    /**
     * Trigger by mouse event "mousedown" + "mouseup", Check if a new object is selected.
     *
     * @param event
     */
    private onClick = (event, isRightClick = false) => {
        if (this.state === STATE.SUPPORT) {
            return;
        }
        if (!this.clickEnabled) {
            return;
        }
        const mousePosition = this.getMouseCoord(event);
        const distance = Math.sqrt((this.mouseDownPosition.x - mousePosition.x) ** 2 + (this.mouseDownPosition.y - mousePosition.y) ** 2);

        if (distance < 0.004 && this.selectableObjects.children) {
            if (this.state === STATE.ROTATE_PLACEMENT) {
                const coord = this.getMouseCoord(event);
                this.ray.setFromCamera(coord, this.camera);
                const _intersect = this.ray.intersectObjects(this.transformControl.objectConvexMeshGroup.children, false)[0];
                if (_intersect) {
                    this.emit(EVENTS.SELECT_PLACEMENT_FACE, _intersect.object.userData);
                }
                return;
            }
            // TODO: selectable objects should not change when objects are selected
            let allObjects = this.selectableObjects.children;

            if (this.selectedGroup && this.selectedGroup.children) {
                allObjects = allObjects.concat(this.selectedGroup.children);
            }

            allObjects = allObjects.filter((mesh) => {
                return mesh.name !== 'clippingSection';
            });

            // Check if we select a new object
            const coord = this.getMouseCoord(event);
            this.ray.setFromCamera(coord, this.camera);
            /*
                'intersectObjects' will check all intersection between the ray and the objects with or without the descendants.
                If second parameter is true, it also checks all descendants of the objects.
                In 3dp, it should set second parameter as true for support function.
                In laser/cnc, for dxf, should only select the 'Mesh' object.
            */
            const allIntersectObjects = this.ray.intersectObjects(allObjects, true);
            let intersect = allIntersectObjects.filter(intersectObject => intersectObject.object.isMesh)[0];
            const isMultiSelect = event.shiftKey;
            /*
                Temporarily solving meshobject cannot be selected after the canvas rotates 180 degrees around the Y axis in cnc/laser tab
                Solution: Use the selected child object to find the actual parent object
            */
            if (intersect && this.sourceType !== '3D' && isUndefined(intersect.object.uniformScalingState)) {
                intersect = {
                    object: intersect.object.parent
                };
            }

            let selectEvent = '';
            if (isMultiSelect) {
                if (isRightClick) {
                    if (intersect) {
                        if (!this.isObjectInSelectedGroup(intersect.object)) {
                            selectEvent = SELECTEVENT.UNSELECT_ADDSELECT;
                        }
                    } else {
                        selectEvent = SELECTEVENT.UNSELECT;
                    }
                } else {
                    if (intersect) {
                        if (!this.isObjectInSelectedGroup(intersect.object)) {
                            selectEvent = SELECTEVENT.ADDSELECT;
                        } else {
                            selectEvent = SELECTEVENT.REMOVESELECT;
                        }
                    }
                }
            } else {
                if (isRightClick) {
                    if (intersect) {
                        if (!this.isObjectInSelectedGroup(intersect.object)) {
                            selectEvent = SELECTEVENT.UNSELECT_ADDSELECT;
                        }
                    } else {
                        selectEvent = SELECTEVENT.UNSELECT;
                    }
                } else if (!isRightClick) {
                    if (intersect) {
                        selectEvent = SELECTEVENT.UNSELECT_ADDSELECT;
                    } else {
                        if (!this.isClickOnPeripheral) {
                            selectEvent = SELECTEVENT.UNSELECT;
                        } else {
                            this.isClickOnPeripheral = false;
                        }
                    }
                }
            }
            // When in four-axis mode, 'shouldForbidSelect' is true, each click will trigger 'UNSELECT' event
            if (this.shouldForbidSelect) {
                selectEvent = SELECTEVENT.UNSELECT;
            }
            this.emit(EVENTS.SELECT_OBJECTS, intersect, selectEvent);

            if (this.sourceType === '3D') {
                this.transformControl.attach(this.selectedGroup);
            } else {
                // FIXME: temporary solution
                // if (intersect) {
                //     this.transformControl.attach(intersect.object, selectEvent);
                // } else {
                //     this.transformControl.detach();
                // }
            }
            this.emit(EVENTS.UPDATE);
            this.mouseDownPosition = null;
        }
    };

    private isObjectInSelectedGroup(object) {
        let found = false;
        this.selectedGroup.traverse((object3d) => {
            if (object3d === object) {
                found = true;
            }
        });
        return found;
    }

    private onMouseWheel = (event) => {
        const stateListAllowWheel = [STATE.NONE, STATE.ROTATE_PLACEMENT, STATE.SUPPORT];
        if (stateListAllowWheel.includes(this.state)) {
            event.preventDefault();
            event.stopPropagation();

            this.handleMouseWheel(event);
        }
    };

    private onDocumentContextMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    private handleMouseDownRotate = (event) => {
        this.rotateStart.set(event.clientX, event.clientY);
    };

    private handleMouseMoveRotate = (event) => {
        if (!this.enableRotate) {
            return;
        }
        this.rotate(event.clientX - this.rotateStart.x, event.clientY - this.rotateStart.y);
        this.rotateStart.set(event.clientX, event.clientY);
        this.updateCamera();
    };

    private handleMouseMovePan = (event) => {
        this.pan(event.clientX - this.panPosition.x, event.clientY - this.panPosition.y);
        this.panPosition.set(event.clientX, event.clientY);
        this.updateCamera();
    };

    private handleMouseDownPan = (event) => {
        this.panPosition.set(event.clientX, event.clientY);
    };

    public resetPanScale = () => {
        this.panScale = 1;
        this.emit(EVENTS.PAN_SCALE, 1);
    };

    public updatePanScale = () => {
        const v = new THREE.Vector3();

        const distanceAll = v.copy(this.target).sub(this.camera.position).length();
        this.panScale = Math.round((
            Math.log(distanceAll / 355.5)
            / Math.log(this.scaleRate)
        ) * 10) / 10;
        this.emit(EVENTS.PAN_SCALE, this.panScale);
    };

    // update mouse 3D position
    private updateMouse3D = (() => {
        // const scope = this;
        const v = new THREE.Vector3();
        const v1 = new THREE.Vector3();
        return (event) => {
            const element = this.domElement === document ? this.domElement.body : this.domElement;
            // Conversion screen coordinates to world coordinates and calculate distance
            // Calculate mouse relative position, use event.offsetY or event.clientY in different situations
            v.set((event.offsetX / element.clientWidth) * 2 - 1, -(event.offsetY / element.clientHeight) * 2 + 1, 0.5);

            v.unproject(this.camera);

            v.sub(this.camera.position).normalize();
            // now v is Vector3 which is from mouse position camera position
            const distanceAll = v1.copy(this.target).sub(this.camera.position).length();
            this.panScale = Math.round((
                Math.log(distanceAll / 355.5)
                / Math.log(this.scaleRate)
            ) * 10) / 10;
            this.mouse3D.copy(this.camera.position).add(v.multiplyScalar(distanceAll));
            this.emit(EVENTS.PAN_SCALE, this.panScale);
        };
    })();

    private handleMouseWheel = (event) => {
        this.updateMouse3D(event);
        if (event.deltaY < 0) {
            this.dollyIn();
        } else {
            this.dollyOut();
        }

        this.updateCamera(true);
    };

    public setSelectableObjects(objects) {
        this.selectableObjects = objects;
    }

    private clearHighlight() {
        if (this.highlightLine) {
            this.highlightLine.material.color.set(CLIPPING_LINE_COLOR);
            this.highlightLine = null;
        }
    }

    private hoverLine() {
        if (this.highlightableObjects && this.highlightableObjects.children.length) {
            const lines = this.highlightableObjects.children.reduce((p, c) => {
                p.push(...c.children.filter((mesh) => {
                    return mesh.name === 'line' && mesh.visible;
                }));

                return p;
            }, []);
            if (lines.length) {
                this.ray.setFromCamera(this.pointer, this.camera);
                const allIntersectObjects = this.ray.intersectObjects(lines, false);
                if (allIntersectObjects.length) {
                    const highlightLine = allIntersectObjects[0].object;
                    if (this.highlightLine !== highlightLine) {
                        this.clearHighlight();
                        highlightLine.material.color.set('#9254DE');
                        this.highlightLine = highlightLine;
                        this.emit(EVENTS.UPDATE);
                    }
                } else {
                    this.clearHighlight();
                    this.emit(EVENTS.UPDATE);
                }
            }
        } else {
            this.clearHighlight();
            this.emit(EVENTS.UPDATE);
        }
    }

    public setHighlightableObjects(objects) {
        this.highlightableObjects = objects;
    }
    //
    // setShouldForbidSelect(shouldForbidSelect) {
    //     this.shouldForbidSelect = shouldForbidSelect;
    //     // this.transformControl.updateFramePeripheralVisible(!shouldForbidSelect);
    // }

    public updateBoundingBox() {
        this.transformControl.updateBoundingBox();
    }

    public attach(objects, selectEvent) {
        this.selectedGroup = objects;
        this.transformControl.attach(objects, selectEvent);
    }

    public detach() {
        this.transformControl.detach();
    }

    public startSupportMode() {
        this.state = STATE.SUPPORT;
        this.prevState = STATE.SUPPORT;

        this.setMode('edit-support');
    }

    public stopSupportMode() {
        this.state = STATE.NONE;
        this.prevState = STATE.NONE;

        this.setMode('');
    }

    public startMeshColoringMode() {
        this.state = STATE.NONE;
        this.prevState = STATE.NONE;

        this.setMode('mesh-coloring');
    }

    public stopMeshColoringMode() {
        this.state = STATE.NONE;
        this.prevState = STATE.NONE;

        this.setMode('');
    }

    private updateCamera(shouldUpdateTarget = false) {
        this.offset.copy(this.camera.position).sub(this.target);
        // const vector = new THREE.Vector3(0, 0, 0);
        // this.offset.copy(this.camera.position).sub(vector);

        const spherialOffset = new THREE.Vector3();

        // rotate & scale
        if (this.sphericalDelta.theta !== 0 || this.sphericalDelta.phi !== 0 || this.scale !== 1) {
            // Spherical is based on XZ plane, instead of implement a new spherical on XY plane
            // we use a Vector3 to swap Y and Z as a little calculation trick.
            if (this.camera.up.z === 1) {
                spherialOffset.set(this.offset.x, this.offset.z, -this.offset.y);
            } else {
                spherialOffset.copy(this.offset);
            }
            this.spherical.setFromVector3(spherialOffset);

            this.spherical.theta += this.sphericalDelta.theta;
            this.spherical.phi += this.sphericalDelta.phi;

            this.spherical.makeSafe();

            const prevRadius = this.spherical.radius;
            this.spherical.radius *= this.scale;
            this.spherical.radius = Math.max(this.spherical.radius, 0.05);
            if (this.maxScale > 0 && this.spherical.radius < this.scaleSize / this.maxScale) {
                this.spherical.radius = this.scaleSize / this.maxScale;
            }
            if (this.minScale > 0 && (this.spherical.radius > this.scaleSize / this.minScale)) {
                this.spherical.radius = this.scaleSize / this.minScale;
            }
            this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

            // suport zoomToCursor (mouse only)
            if (this.zoomToCursor && shouldUpdateTarget) {
                this.target.lerp(this.mouse3D, 1 - this.spherical.radius / prevRadius);
            }
            spherialOffset.setFromSpherical(this.spherical);

            if (this.camera.up.z === 1) {
                this.offset.set(spherialOffset.x, -spherialOffset.z, spherialOffset.y);
            } else {
                this.offset.copy(spherialOffset);
            }

            if (this.spherical.radius <= 20) {
                const scalar = this.target.z >= 20 ? 10 : 1;
                const cameraWorldDir = new THREE.Vector3();
                this.camera.getWorldDirection(cameraWorldDir);
                if (this.target.z >= 20 && this.target.z + cameraWorldDir.z * scalar >= 10) {
                    this.target.add(cameraWorldDir.multiplyScalar(scalar));
                }
            }

            this.sphericalDelta.set(0, 0, 0);
            this.emit(EVENTS.UPDATE_CAMERA, this.camera.position);
        }

        // pan
        if (this.panOffset.x || this.panOffset.y) {
            this.target.add(this.panOffset);
            this.panOffset.set(0, 0, 0);
        }


        // re-position camera
        this.camera.position.copy(this.target).add(this.offset);
        this.camera.lookAt(this.target);

        // need to update scale after camera position setted,
        // because of camera position used to calculate current scale
        if (this.scale !== 1) {
            this.onScale();
            this.scale = 1;
        }
        // using small-angle approximation cos(x/2) = 1 - x^2 / 8
        if (this.lastPosition.distanceToSquared(this.camera.position) > EPS
            || 8 * (1 - this.lastQuaternion.dot(this.camera.quaternion)) > EPS) {
            this.emit(EVENTS.UPDATE);

            this.lastPosition.copy(this.camera.position);
            this.lastQuaternion.copy(this.camera.quaternion);
        }
        // this
    }

    public dispose() {
        this.domElement.removeEventListener('mousedown', this.onMouseDown, false);
        this.domElement.removeEventListener('mousemove', this.onMouseMove, false);
        this.domElement.removeEventListener('wheel', this.onMouseWheel, false);

        document.removeEventListener('mousemove', this.onDocumentMouseMove, false);
        document.removeEventListener('mouseup', this.onDocumentMouseUp, false);
        document.removeEventListener('contextmenu', this.onDocumentContextMenu, false);
    }

    public setSelectedModelConvexMeshGroup(group) {
        this.state = STATE.ROTATE_PLACEMENT;
        this.transformControl.setObjectConvexMeshGroup(group);
    }
}

export default ControlManager;
