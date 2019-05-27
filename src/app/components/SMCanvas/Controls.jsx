/**
 * Controls for canvas based on OrbitControls.
 *
 * Reference:
 * - https://github.com/mrdoob/three.js/blob/master/examples/js/controls/OrbitControls.js
 */
import * as THREE from 'three';
import EventEmitter from 'events';
import TransformControls from './TransformControls';
import TransformControls2D from './TransformControls2D';
// const EPSILON = 0.000001;

const EPS = 0.000001;

const STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TRANSFORM: 3
};

// Events sent by Controls
export const EVENTS = {
    UPDATE: 'update',
    CONTEXT_MENU: 'contextmenu',
    SELECT_OBJECT: 'object:select',
    UNSELECT_OBJECT: 'object:unselect',
    TRANSFORM_OBJECT: 'object:transform',
    AFTER_TRANSFORM_OBJECT: 'object:aftertransform'
};

class Controls extends EventEmitter {
    camera = null;

    group = null;

    domElement = null;

    transformControl = null;

    state = STATE.NONE;

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

    selectedObject = null;

    ray = new THREE.Raycaster();

    constructor(modelType, camera, group, domElement) {
        super();

        this.modelType = modelType;
        this.camera = camera;
        this.group = group;
        this.domElement = (domElement !== undefined) ? domElement : document;

        this.initTransformControls();

        this.bindEventListeners();
    }

    initTransformControls() {
        if (this.modelType === '3D') {
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

    setTarget(target) {
        this.target = target;

        this.updateCamera();
    }

    bindEventListeners() {
        this.domElement.addEventListener('mousedown', this.onMouseDown, false);
        this.domElement.addEventListener('mousemove', this.onMouseHover, false);
        this.domElement.addEventListener('wheel', this.onMouseWheel, false);

        this.domElement.addEventListener('contextmenu', this.onContextMenu, false);
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

        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1 // Y axis up is positive
        };
    }

    onMouseDown = (event) => {
        // Prevent the browser from scrolling.
        event.preventDefault();

        switch (event.button) {
            case THREE.MOUSE.LEFT: {
                // Transform on selected object
                if (this.selectedObject) {
                    const coord = this.getMouseCoord(event);
                    // Call hover to update axis selected
                    this.transformControl.onMouseHover(coord);
                    if (this.transformControl.onMouseDown(coord)) {
                        this.state = STATE.TRANSFORM;
                        break;
                    }
                }

                // Check if we select a new object
                if (this.selectableObjects) {
                    const coord = this.getMouseCoord(event);
                    this.ray.setFromCamera(coord, this.camera);

                    const intersect = this.ray.intersectObjects(this.selectableObjects, false)[0];
                    if (intersect && intersect.object !== this.selectedObject) {
                        this.selectedObject = intersect.object;
                        this.transformControl.attach(this.selectedObject);
                        this.emit(EVENTS.SELECT_OBJECT, this.selectedObject);
                        this.emit(EVENTS.UPDATE);
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

        if (!this.selectedObject || this.state !== STATE.NONE) {
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
                this.transformControl.onMouseMove(this.getMouseCoord(event));
                this.emit(EVENTS.TRANSFORM_OBJECT);
                break;
            default:
                break;
        }
    };

    onDocumentMouseUp = (event) => {
        switch (this.state) {
            case STATE.ROTATE:
                // Left click to unselect object
                if (!this.rotateMoved) {
                    this.selectedObject = null;
                    this.transformControl.detach();

                    this.emit(EVENTS.UNSELECT_OBJECT);
                    this.emit(EVENTS.UPDATE);
                }
                break;
            case STATE.PAN:
                if (!this.panMoved) { // Right click to open context menu
                    // Note that the event is mouse up, not really contextmenu
                    this.emit(EVENTS.CONTEXT_MENU, event);
                }
                break;
            case STATE.TRANSFORM:
                this.transformControl.onMouseUp();
                this.emit(EVENTS.AFTER_TRANSFORM_OBJECT);
                break;
            default:
                break;
        }

        this.state = STATE.NONE;

        document.removeEventListener('mousemove', this.onDocumentMouseMove, false);
        document.removeEventListener('mouseup', this.onDocumentMouseUp, false);
    };

    onMouseWheel = (event) => {
        if (this.state !== STATE.NONE) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.handleMouseWheel(event);
    };

    onContextMenu = (event) => {
        event.preventDefault();
        // this.emit('contextmenu', event);
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

    handleMouseWheel = (event) => {
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

    attach(object) {
        this.selectedObject = object;
        this.transformControl.attach(object);
    }

    detach() {
        this.selectedObject = null;
        this.transformControl.detach();
    }

    updateCamera() {
        this.offset.copy(this.camera.position).sub(this.target);

        // rotate & scale
        if (this.sphericalDelta.theta !== 0 || this.sphericalDelta.phi !== 0 || this.scale !== 1) {
            this.spherical.setFromVector3(this.offset);
            this.spherical.theta += this.sphericalDelta.theta;
            this.spherical.phi += this.sphericalDelta.phi;
            this.spherical.makeSafe();

            this.spherical.radius *= this.scale;
            this.spherical.radius = Math.max(this.spherical.radius, 0.05);

            this.offset.setFromSpherical(this.spherical);

            this.sphericalDelta.set(0, 0, 0);
            this.scale = 1;
        }

        // pan
        this.target.add(this.panOffset);
        this.panOffset.set(0, 0, 0);

        // re-position camera
        this.camera.position.copy(this.target).add(this.offset);
        this.camera.lookAt(this.target);

        // using small-angle approximation cos(x/2) = 1 - x^2 / 8
        if (this.lastPosition.distanceToSquared(this.camera.position) > EPS ||
            8 * (1 - this.lastQuaternion.dot(this.camera.quaternion)) > EPS) {
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
    }
}

export default Controls;
