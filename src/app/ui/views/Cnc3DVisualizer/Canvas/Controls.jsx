/**
 * Controls for canvas based on OrbitControls.
 *
 * Reference:
 * - https://github.com/mrdoob/three.js/blob/master/examples/js/controls/OrbitControls.js
 */
import * as THREE from 'three';
import EventEmitter from 'events';

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

    scaleRate = 0.90;

    // calculation only
    offset = new THREE.Vector3();

    // detection
    selectableObjects = null;

    shouldForbidSelect = false;

    modelGroup = null;

    selectedGroup = null;

    ray = new THREE.Raycaster();

    horizontalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    // Track if mouse moved during "mousedown" to "mouseup".
    mouseDownPosition = null;

    constructor(camera, group, domElement) {
        super();

        this.camera = camera;
        this.group = group;
        this.domElement = (domElement !== undefined) ? domElement : document;

        this.bindEventListeners();
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

        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1 // Y axis up is positive
        };
    }

    onMouseDown = (event) => {
        // Prevent the browser from scrolling.
        event.preventDefault();
        this.mouseDownPosition = this.getMouseCoord(event);
        // mousedown on support mode
        this.prevState = null;
        if (this.state === STATE.SUPPORT) {
            this.prevState = STATE.SUPPORT;
        }

        switch (event.button) {
            case THREE.MOUSE.LEFT: {
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
                // should not trigger click here
                // this.onClick(event, true);
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
            default:
                break;
        }
    };

    onDocumentMouseUp = () => {
        this.state = this.prevState || STATE.NONE;

        document.removeEventListener('mousemove', this.onDocumentMouseMove, false);
        // mouse up needed no matter mousedowm on support mode
        // document.removeEventListener('mouseup', this.onDocumentMouseUp, false);
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

    handleMouseWheel = (event) => {
        if (event.deltaY < 0) {
            this.dollyIn();
        } else {
            this.dollyOut();
        }

        this.updateCamera();
    };


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

            this.spherical.radius *= this.scale;
            this.spherical.radius = Math.max(this.spherical.radius, 0.05);

            spherialOffset.setFromSpherical(this.spherical);

            if (this.camera.up.z === 1) {
                this.offset.set(spherialOffset.x, -spherialOffset.z, spherialOffset.y);
            } else {
                this.offset.copy(spherialOffset);
            }
            // if (this.spherical.radius <= 10) {
            //     const scalar = this.target.z > 20 ? 10 : 1;
            //     const cameraWorldDir = new THREE.Vector3();
            //     this.camera.getWorldDirection(cameraWorldDir);
            //     if (this.target.z > 20 && this.target.z + cameraWorldDir.z * scalar >= 10) {
            //         this.target.add(cameraWorldDir.multiplyScalar(scalar));
            //     }
            // }

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
