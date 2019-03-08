/* eslint-disable */

// control: move + scale + rotate
// move scale rotate controls
// move&rotate: operate object
// scale: change camera.position.z

import * as THREE from "three";

const MSRControls = function (object, camera, domElement, size) {
    this.object = object;
    this.camera = camera;
    this.domElement = (domElement !== undefined) ? domElement : document;

    const INITIAL_STATE = {
        cameraPosition: this.camera.position.clone(),
        objectPosition: this.object.position.clone(),
        objectRotation: this.object.rotation.clone()
    };

    var isMoving = false;
    let lastScrollDate = 0;

    var cameraMinZ = -30;
    var cameraMaxZ = Math.max(size.x, size.y, size.z) * 2;

    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var scope = this;
    var STATE = { NONE: -1, DOWN_LEFT: 0, DOWN_RIGHT: 1 };
    var state = STATE.NONE;

    scope.domElement.addEventListener('mousedown', onMouseDown, false);
    scope.domElement.addEventListener('mouseup', onMouseUp, false);

    scope.domElement.addEventListener('wheel', onMouseWheel, false);
    scope.domElement.addEventListener('contextmenu', onContextMenu, false);

    this.enabled = true;

    this.enabledRotate = true;
    this.enabledPan = true;
    this.enabledScale = true;

    this.dispose = function () {
        scope.domElement.removeEventListener('mousedown', onMouseDown, false);
        scope.domElement.removeEventListener('mouseup', onMouseUp, false);

        scope.domElement.removeEventListener('wheel', onMouseWheel, false);
        scope.domElement.removeEventListener('contextmenu', onContextMenu, false);

        scope.domElement.removeEventListener('mousemove', onMouseMove, true);
    };

    this.reset = function () {
        scope.object.position.set(INITIAL_STATE.objectPosition.x, INITIAL_STATE.objectPosition.y, INITIAL_STATE.objectPosition.z);
        scope.object.rotation.set(INITIAL_STATE.objectRotation.x, INITIAL_STATE.objectRotation.y, INITIAL_STATE.objectRotation.z);
        scope.camera.position.z = INITIAL_STATE.cameraPosition.z;
        state = STATE.NONE;
    };

    this.updateSize = function (size) {
        cameraMaxZ = Math.max(size.x, size.y, size.z) * 2;
    };

    function onMouseDown(event) {
        if (scope.enabled === false) return;
        event.preventDefault();
        scope.dispatchEvent({ type: "mouseDown", event: event });
        switch (event.button) {
            case THREE.MOUSE.LEFT:
                //rotate
                state = STATE.DOWN_LEFT;
                rotateStart.set(event.clientX, event.clientY);
                break;
            case THREE.MOUSE.RIGHT:
                state = STATE.DOWN_RIGHT;
                //pan
                panStart.copy(getEventWorldPosition(event));
                break;
            case THREE.MOUSE.MIDDLE:
                state = STATE.NONE;
                break;
        }
        if (state !== STATE.NONE) {
            document.addEventListener('mousemove', onMouseMove, true);
            document.addEventListener('mouseup', onMouseUp, false);
        }
    }

    function onMouseUp(event) {
        if (scope.enabled === false) return;
        isMoving && scope.dispatchEvent({ type: "moveEnd", event: event });
        isMoving = false;
        state = STATE.NONE;

        scope.dispatchEvent({ type: "mouseUp", event: event });

        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('mouseup', onMouseUp, false);
    }

    function onMouseWheel(event) {
        if (scope.enabled === false) return;
        event.preventDefault();
        handleMouseWheelScale(event);
    }

    function onContextMenu(event) {
        if (scope.enabled === false) return;
        event.preventDefault();
        event.stopPropagation();
    }

    function onMouseMove(event) {
        if (scope.enabled === false) return;
        event.preventDefault();
        if (!isMoving) {
            scope.dispatchEvent({ type: "moveStart", event: event });
            isMoving = true;
        }
        scope.dispatchEvent({ type: "move" });
        switch (state) {
            case STATE.DOWN_LEFT:
                handleMouseMoveRotate(event);
                break;
            case STATE.DOWN_RIGHT:
                handleMouseMovePan(event);
                break;
        }
    }

    function handleMouseMovePan(event) {
        if (scope.enabledPan === false) return;

        panEnd.copy(getEventWorldPosition(event));
        panDelta.subVectors(panEnd, panStart);
        // pan object
        scope.object.position.add(new THREE.Vector3(panDelta.x, panDelta.y));
        // may need to apply object.matrix when object.matrix does not equal object.matrixWorld
        panStart.copy(panEnd);
    }

    function handleMouseMoveRotate(event) {
        if (scope.enabledRotate === false) return;

        rotateEnd.set(event.clientX, event.clientY);
        rotateDelta.subVectors(rotateEnd, rotateStart);
        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;
        scope.object.rotateOnAxis(new THREE.Vector3(0, 1, 0), 2 * Math.PI * rotateDelta.x / element.clientHeight);
        scope.object.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), 2 * Math.PI * rotateDelta.y / element.clientHeight);
        rotateStart.copy(rotateEnd);
    }

    function handleMouseWheelScale(event) {
        if (scope.enabledScale === false) return;

        // Time throttle to make wheel less sensitive
        const date = +new Date();
        if (date - lastScrollDate < 30) return;
        lastScrollDate = date;

        if (event.deltaY < 0) {
            if (scope.camera.position.z <= cameraMinZ) {
                return;
            }
            scope.camera.position.z -= 10;
        } else if (event.deltaY > 0) {
            if (scope.camera.position.z >= cameraMaxZ) {
                return;
            }
            scope.camera.position.z += 10;
        }
    }

   /**
     * Transform event position in window to world position.
     *
     * Reference: https://github.com/mrdoob/three.js/blob/dev/src/core/Raycaster.js#L81
     *
     * @param event
     * @returns {Vector2}
     */
    function getEventWorldPosition(event) {
        const rect = scope.domElement.getBoundingClientRect();

        // Standard x and y in standard coordinate, range from [-1, 1]
        const standardX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const standardY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Get identity vector from camera to target point
        const vec = new THREE.Vector3().set(standardX, standardY, 0.5);
        vec.unproject(scope.camera);
        vec.sub(scope.camera.position).normalize();

        // Get vector from camera to XY plane
        vec.multiplyScalar(-scope.camera.position.z / vec.z);

        // Get intersect on XY plane
        const pos = new THREE.Vector3().copy(scope.camera.position).add(vec);

        return new THREE.Vector2(pos.x, pos.y);
    }
};

MSRControls.prototype = Object.create(THREE.Object3D.prototype);
MSRControls.prototype.constructor = MSRControls;

export default MSRControls;
