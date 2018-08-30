/* eslint-disable */

// control: move + scale + rotate
// move scale rotate controls
// move&rotate: operate object
// scale: change camera.position.z

import * as THREE from "three";

THREE.MSRControls = function (object, camera, domElement ) {
    this.object = object;
    this.camera = camera;
    this.domElement = ( domElement !== undefined ) ? domElement : document;

    const INITIAL_STATE = {
        cameraPosition: this.camera.position.clone(),
        objectPosition: this.object.position.clone(),
        objectRotation: this.object.rotation.clone()
    };

    const EVENTS = {
        mouseDown: {type: "mouseDown"},
        mouseUp: {type: "mouseUp"},
        moveStart: {type: "moveStart"},
        moveEnd: {type: "moveEnd"}
    };

    var isMoving = false;

    var cameraMinZ = -30;
    var cameraMaxZ = 600;

    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var scope = this;
    var STATE = {NONE: - 1, DOWN_LEFT: 0, DOWN_RIGHT: 1};
    var state = STATE.NONE;

    scope.domElement.addEventListener( 'mousedown', onMouseDown, false );
    scope.domElement.addEventListener( 'mouseup', onMouseUp, false );

    scope.domElement.addEventListener( 'wheel', onMouseWheel, false );
    scope.domElement.addEventListener( 'contextmenu', onContextMenu, false );

    this.enabled = true;

    this.dispose = function () {
        scope.domElement.removeEventListener( 'mousedown', onMouseDown, false );
        scope.domElement.removeEventListener( 'mouseup', onMouseUp, false );

        scope.domElement.removeEventListener( 'wheel', onMouseWheel, false );
        scope.domElement.removeEventListener( 'contextmenu', onContextMenu, false );

        scope.domElement.removeEventListener( 'mousemove', onMouseMove, true );
    };

    this.reset = function () {
        scope.object.position.set(INITIAL_STATE.objectPosition.x, INITIAL_STATE.objectPosition.y, INITIAL_STATE.objectPosition.z);
        scope.object.rotation.set(INITIAL_STATE.objectRotation.x, INITIAL_STATE.objectRotation.y, INITIAL_STATE.objectRotation.z);
        scope.camera.position.z = INITIAL_STATE.cameraPosition.z;
        state = STATE.NONE;
    };

    function onMouseDown( event ) {
        if ( scope.enabled === false ) return;
        event.preventDefault();
        scope.dispatchEvent(EVENTS.mouseDown);

        switch ( event.button ) {
            case THREE.MOUSE.LEFT:
                //rotate
				state = STATE.DOWN_LEFT;
                rotateStart.set( event.clientX, event.clientY );
                break;
            case THREE.MOUSE.RIGHT:
                state = STATE.DOWN_RIGHT;
                //pan
                panStart.set( event.clientX, event.clientY );
                break;
            case THREE.MOUSE.MIDDLE:
                state = STATE.NONE;
                break;
        }
        if ( state !== STATE.NONE ) {
            document.addEventListener( 'mousemove', onMouseMove, true );
            document.addEventListener( 'mouseup', onMouseUp, false );
        }
    }

    function onMouseUp( event ) {

        if ( scope.enabled === false ) return;

        isMoving && scope.dispatchEvent(EVENTS.moveEnd);
        isMoving = false;
        state = STATE.NONE;

        scope.dispatchEvent({type: "mouseUp", domEvent: event});

        document.removeEventListener( 'mousemove', onMouseMove, true );
        document.removeEventListener( 'mouseup', onMouseUp, false );
    }

    function onMouseWheel( event ) {
        if ( scope.enabled === false ) return;
        event.preventDefault();
        event.stopPropagation();
        if ( event.deltaY < 0 ) {
        	if (scope.camera.position.z <= cameraMinZ){
        		return;
			}
            scope.camera.position.z -=15;
        } else if ( event.deltaY > 0 ) {
            if (scope.camera.position.z >= cameraMaxZ){
                return;
            }
            scope.camera.position.z +=15;
        }
    }

    function onContextMenu( event ) {
        if ( scope.enabled === false ) return;
        event.preventDefault();
    }

    function onMouseMove( event ) {
        if ( scope.enabled === false ) return;
        event.preventDefault();
        if (!isMoving){
            scope.dispatchEvent(EVENTS.moveStart);
            isMoving = true;
        }
        switch ( state ) {
            case STATE.DOWN_LEFT:
                handleMouseMoveRotate( event );
                break;
            case STATE.DOWN_RIGHT:
                handleMouseMovePan( event );
                break;
        }
    }

    function handleMouseMovePan( event ) {
        panEnd.set( event.clientX, event.clientY );
        panDelta.subVectors( panEnd, panStart );
        //pan object
		scope.object.position.sub( new THREE.Vector3(-panDelta.x/2.5, panDelta.y/2.5));
        panStart.copy( panEnd );
    }

    function handleMouseMoveRotate( event ) {
        rotateEnd.set( event.clientX, event.clientY );
        rotateDelta.subVectors( rotateEnd, rotateStart );
        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;
        scope.object.rotateOnAxis(new THREE.Vector3(0,1,0), 2 * Math.PI * rotateDelta.x / element.clientHeight);
        scope.object.rotateOnWorldAxis(new THREE.Vector3(1,0,0), 2 * Math.PI * rotateDelta.y / element.clientHeight);
        rotateStart.copy( rotateEnd );
    }
};

THREE.MSRControls.prototype = Object.create( THREE.Object3D.prototype );
THREE.MSRControls.prototype.constructor = THREE.MSRControls;

export default THREE.MSRControls;
