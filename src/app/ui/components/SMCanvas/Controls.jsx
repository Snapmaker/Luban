/**
 * Controls for canvas based on OrbitControls.
 * Update part of OrbitControls
 * Reference:
 * - https://github.com/mrdoob/three.js/blob/master/examples/js/controls/OrbitControls.js
 */
import * as THREE from 'three';
import EventEmitter from 'events';
import { isUndefined } from 'lodash';
import TransformControls from './TransformControls';
import TransformControls2D from './TransformControls2D';
// const EPSILON = 0.000001;
import { SELECTEVENT } from '../../../constants';

const EPS = 0.000001;

const STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TRANSFORM: 3,
    SUPPORT: 4
};

// Events sent by Controls
export const EVENTS = {
    UPDATE: 'update',
    CONTEXT_MENU: 'contextmenu',
    SELECT_OBJECTS: 'object:select',
    // UNSELECT_OBJECT: 'object:unselect',
    TRANSFORM_OBJECT: 'object:transform',
    AFTER_TRANSFORM_OBJECT: 'object:aftertransform'
};

class Controls extends EventEmitter {
    camera = null;

    group = null;

    domElement = null;

    transformControl = null;

    state = STATE.NONE;

    prevState = null;

    // "target" is where the camera orbits around
    target = new THREE.Vector3();

    lastPosition = new THREE.Vector3();

    lastQuaternion = new THREE.Quaternion();

    // calculation temporary variables
    // spherical rotation
    enableRotate = true;

    spherical = new THREE.Spherical();

    sphericalDelta = new THREE.Spherical();

    rotateStart = new THREE.Vector2();

    rotateMoved = false;

    // pan
    panOffset = new THREE.Vector3();

    panPosition = new THREE.Vector2();

    panMoved = false;

    // scale
    scale = 1;

    scaleRate = 0.98;

    // calculation only
    offset = new THREE.Vector3();

    // detection
    selectableObjects = null;

    shouldForbidSelect = false;

    modelGroup = null;

    selectedGroup = null;

    // Set to true to zoom to cursor ,panning may have to be enabled
    zoomToCursor = false;

    mouse3D = new THREE.Vector3();

    ray = new THREE.Raycaster();

    horizontalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    // Track if mouse moved during "mousedown" to "mouseup".
    mouseDownPosition = null;

    clickEnabled = true;

    constructor(sourceType, camera, group, domElement, onScale, onPan, supportActions) {
        super();

        this.sourceType = sourceType;
        this.camera = camera;
        this.group = group;
        this.domElement = (domElement !== undefined) ? domElement : document;
        this.onScale = onScale;
        this.onPan = onPan;
        this.zoomToCursor = (sourceType === '3D');

        this.initTransformControls();
        this.supportActions = supportActions;

        this.bindEventListeners();
    }


    initTransformControls() {
        if (this.sourceType === '3D') {
            this.transformControl = new TransformControls(this.camera);
        } else {
            this.transformControl = new TransformControls2D(this.camera);
        }
        this.transformControl.addEventListener('update', () => {
            this.emit(EVENTS.UPDATE);
        });
        this.transformControl.mode = 'translate';

        this.group.add(this.transformControl);
    }

    setTransformMode(mode) {
        if (this.transformControl) {
            this.transformControl.mode = mode;
        }
    }

    setInProgress(inProgress) {
        if (this.transformControl) {
            this.transformControl.inProgress = inProgress;
        }
    }

    setTarget(target) {
        this.target = target;

        this.updateCamera();
    }

    bindEventListeners() {
        this.domElement.addEventListener('mousedown', this.onMouseDown, false);
        this.domElement.addEventListener('mousemove', this.onMouseHover, false);
        this.domElement.addEventListener('wheel', this.onMouseWheel, false);
        this.domElement.addEventListener('click', this.onClick, false);

        document.addEventListener('contextmenu', this.onDocumentContextMenu, false);
    }

    rotateLeft(angle) {
        this.sphericalDelta.theta -= angle;
    }

    rotateUp(angle) {
        this.sphericalDelta.phi -= angle;
    }

    rotate(deltaX, deltaY) {
        const elem = this.domElement === document ? document.body : this.domElement;

        this.rotateLeft(2 * Math.PI * deltaX / elem.clientHeight); // yes, height
        this.rotateUp(2 * Math.PI * deltaY / elem.clientHeight);
    }

    panLeft(distance, matrix) {
        const v = new THREE.Vector3().setFromMatrixColumn(matrix, 0); // Get X column
        v.multiplyScalar(-distance);
        this.panOffset.add(v);
    }

    panUp(distance, matrix) {
        const v = new THREE.Vector3().setFromMatrixColumn(matrix, 1); // Get Y column
        v.multiplyScalar(distance);
        this.panOffset.add(v);
    }

    pan(deltaX, deltaY) {
        const elem = this.domElement === document ? document.body : this.domElement;

        this.offset.copy(this.camera.position).sub(this.target);

        // calculate move distance of target in perspective view of camera
        const distance = 2 * this.offset.length() * Math.tan(this.camera.fov / 2 * Math.PI / 180);

        this.panLeft(distance * deltaX / elem.clientHeight, this.camera.matrix);
        this.panUp(distance * deltaY / elem.clientHeight, this.camera.matrix);
    }

    setScale(scale) {
        this.scale = scale;
    }

    dollyIn = () => {
        this.scale *= this.scaleRate;
    };

    dollyOut = () => {
        this.scale /= this.scaleRate;
    };

    // Normalize mouse / touch pointer and remap to view space
    // Ref: https://github.com/mrdoob/three.js/blob/master/examples/js/controls/TransformControls.js#L515
    getMouseCoord(event) {
        const rect = this.domElement.getBoundingClientRect();
        // TODO: The result is not correct, change all the clientX/clientY as offsetX/offsetY
        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1 // Y axis up is positive
        };
    }

    onMouseDown = (event) => {
        // Prevent the browser from scrolling.
        // event.preventDefault();
        this.mouseDownPosition = this.getMouseCoord(event);
        // mousedown on support mode
        this.prevState = null;
        if (this.state === STATE.SUPPORT) {
            this.prevState = STATE.SUPPORT;
            // if (event.button === THREE.MOUSE.RIGHT) {
            //     this.stopSupportMode();
            // }
            // return;
        }

        switch (event.button) {
            case THREE.MOUSE.LEFT: {
                // Transform on selected object
                if (this.selectedGroup && this.selectedGroup.children.length > 0) {
                    const coord = this.getMouseCoord(event);
                    // Call hover to update axis selected
                    this.transformControl.onMouseHover(coord);
                    if (this.transformControl.onMouseDown(coord)) {
                        this.state = STATE.TRANSFORM;
                        break;
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
        if (this.state !== STATE.NONE) {
            // Track events even when the mouse move outside of window
            document.addEventListener('mousemove', this.onDocumentMouseMove, false);
            document.addEventListener('mouseup', this.onDocumentMouseUp, false);
        }
    };

    onMouseHover = (event) => {
        event.preventDefault();
        // model move with mouse no matter mousedown
        if (this.state === STATE.SUPPORT) {
            const coord = this.getMouseCoord(event);
            this.ray.setFromCamera(coord, this.camera);
            const mousePosition = new THREE.Vector3();
            this.ray.ray.intersectPlane(this.horizontalPlane, mousePosition);
            this.supportActions.moveSupport(mousePosition);
            this.emit(EVENTS.UPDATE);
        }
        if (!(this.selectedGroup && this.selectedGroup.children.length > 0) || this.state !== STATE.NONE) {
            return;
        }

        // Let transform control deal with mouse move
        const coord = this.getMouseCoord(event);
        this.transformControl.onMouseHover(coord);
    };

    onDocumentMouseMove = (event) => {
        event.preventDefault();

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
                    this.transformControl.onMouseMove(this.getMouseCoord(event));
                }
                this.emit(EVENTS.TRANSFORM_OBJECT);
                break;
            default:
                break;
        }
    };

    onDocumentMouseUp = (event) => {
        switch (this.state) {
            case STATE.PAN:
                if (!this.panMoved) {
                    if (this.prevState === STATE.SUPPORT) {
                        // stop support mode on right click
                        this.prevState = null;
                        this.supportActions.stopSupportMode();
                    } else {
                        // check if any model selected
                        this.onClick(event, true);
                        // Right click to open context menu
                        // Note that the event is mouse up, not really contextmenu
                        this.emit(EVENTS.CONTEXT_MENU, event);
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
            default:
                break;
        }

        this.state = this.prevState || STATE.NONE;

        document.removeEventListener('mousemove', this.onDocumentMouseMove, false);
        // mouse up needed no matter mousedowm on support mode
        // document.removeEventListener('mouseup', this.onDocumentMouseUp, false);
    };

    disableClick() {
        this.clickEnabled = false;

        this.transformControl.detach();
        this.emit(EVENTS.SELECT_OBJECTS, null, SELECTEVENT.UNSELECT);
    }

    enableClick() {
        this.clickEnabled = true;
    }

    /**
     * Trigger by mouse event "mousedown" + "mouseup", Check if a new object is selected.
     *
     * @param event
     */
    onClick = (event, isRightClick = false) => {
        if (this.state === STATE.SUPPORT) {
            this.supportActions.saveSupport();
            return;
        }
        if (!this.clickEnabled) {
            return;
        }
        const mousePosition = this.getMouseCoord(event);
        const distance = Math.sqrt((this.mouseDownPosition.x - mousePosition.x) ** 2 + (this.mouseDownPosition.y - mousePosition.y) ** 2);

        if (distance < 0.004 && this.selectableObjects.children) {
            // TODO: selectable objects should not change when objects are selected
            let allObjects = this.selectableObjects.children;

            if (this.selectedGroup && this.selectedGroup.children) {
                allObjects = allObjects.concat(this.selectedGroup.children);
            }

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
                        const objectIndex = this.selectedGroup.children.indexOf(intersect.object);
                        if (objectIndex === -1) {
                            selectEvent = SELECTEVENT.UNSELECT_ADDSELECT;
                        }
                    } else {
                        selectEvent = SELECTEVENT.UNSELECT;
                    }
                } else {
                    if (intersect) {
                        const objectIndex = this.selectedGroup.children.indexOf(intersect.object);
                        if (objectIndex === -1) {
                            selectEvent = SELECTEVENT.ADDSELECT;
                        } else {
                            selectEvent = SELECTEVENT.REMOVESELECT;
                        }
                    }
                }
            } else {
                if (isRightClick) {
                    if (intersect) {
                        const objectIndex = this.selectedGroup.children.indexOf(intersect.object);
                        if (objectIndex === -1) {
                            selectEvent = SELECTEVENT.UNSELECT_ADDSELECT;
                        }
                    } else {
                        selectEvent = SELECTEVENT.UNSELECT;
                    }
                } else if (!isRightClick) {
                    if (intersect) {
                        selectEvent = SELECTEVENT.UNSELECT_ADDSELECT;
                    } else {
                        selectEvent = SELECTEVENT.UNSELECT;
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

    onMouseWheel = (event) => {
        if (this.state !== STATE.NONE) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.handleMouseWheel(event);
    };

    onDocumentContextMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    handleMouseDownRotate = (event) => {
        this.rotateStart.set(event.clientX, event.clientY);
    };

    handleMouseMoveRotate = (event) => {
        if (!this.enableRotate) {
            return;
        }
        this.rotate(event.clientX - this.rotateStart.x, event.clientY - this.rotateStart.y);
        this.rotateStart.set(event.clientX, event.clientY);
        this.updateCamera();
    };

    handleMouseMovePan = (event) => {
        this.pan(event.clientX - this.panPosition.x, event.clientY - this.panPosition.y);
        this.panPosition.set(event.clientX, event.clientY);
        this.updateCamera();
    };

    handleMouseDownPan = (event) => {
        this.panPosition.set(event.clientX, event.clientY);
    };

    // update mouse 3D position
    updateMouse3D = (() => {
        const scope = this;
        const v = new THREE.Vector3();
        const v1 = new THREE.Vector3();
        return (event) => {
            const element = scope.domElement === document ? scope.domElement.body : scope.domElement;
            // Conversion screen coordinates to world coordinates and calculate distance
            // Calculate mouse relative position, use event.offsetY or event.clientY in different situations
            v.set((event.offsetX / element.clientWidth) * 2 - 1, -(event.offsetY / element.clientHeight) * 2 + 1, 0.5);

            v.unproject(scope.camera);

            v.sub(scope.camera.position).normalize();

            const distance = v1.copy(scope.target).sub(scope.camera.position).dot(new THREE.Vector3(1, 1, 1)) / v.dot(new THREE.Vector3(1, 1, 1));

            scope.mouse3D.copy(scope.camera.position).add(v.multiplyScalar(distance));
        };
    })();

    handleMouseWheel = (event) => {
        this.updateMouse3D(event);
        if (event.deltaY < 0) {
            this.dollyIn();
        } else {
            this.dollyOut();
        }

        this.updateCamera();
    };

    setSelectableObjects(objects) {
        this.selectableObjects = objects;
    }
    //
    // setShouldForbidSelect(shouldForbidSelect) {
    //     this.shouldForbidSelect = shouldForbidSelect;
    //     // this.transformControl.updateFramePeripheralVisible(!shouldForbidSelect);
    // }

    updateBoundingBox() {
        this.transformControl.updateBoundingBox();
    }

    attach(objects, selectEvent) {
        this.selectedGroup = objects;
        this.transformControl.attach(objects, selectEvent);
    }

    detach() {
        this.transformControl.detach();
    }

    startSupportMode() {
        this.state = STATE.SUPPORT;
    }

    stopSupportMode() {
        this.state = STATE.NONE;
        this.prevState = STATE.NONE;
    }

    updateCamera() {
        this.offset.copy(this.camera.position).sub(this.target);

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
            // suport zoomToCursor (mouse only)
            if (this.zoomToCursor) {
                this.target.lerp(this.mouse3D, 1 - this.spherical.radius / prevRadius);
            }
            spherialOffset.setFromSpherical(this.spherical);

            if (this.camera.up.z === 1) {
                this.offset.set(spherialOffset.x, -spherialOffset.z, spherialOffset.y);
            } else {
                this.offset.copy(spherialOffset);
            }

            this.sphericalDelta.set(0, 0, 0);
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
    }

    dispose() {
        this.domElement.removeEventListener('mousedown', this.onMouseDown, false);
        this.domElement.removeEventListener('mousemove', this.onMouseHover, false);
        this.domElement.removeEventListener('wheel', this.onMouseWheel, false);

        document.removeEventListener('mousemove', this.onDocumentMouseMove, false);
        document.removeEventListener('mouseup', this.onDocumentMouseUp, false);
        document.removeEventListener('contextmenu', this.onDocumentContextMenu, false);
    }
}

export default Controls;
