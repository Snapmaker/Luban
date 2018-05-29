/* eslint-disable */

//move scale rotate controls
//move&rotate: operate object
//scale: change camera.position.z
import * as THREE from "three";

THREE.MSRControls = function (object, camera, domElement ) {
    this.object = object;
    this.camera = camera;
    this.domElement = ( domElement !== undefined ) ? domElement : document;

    this.enable = true;

    this.cameraPosition0 = this.camera.position.clone();
    this.objectPosition0 = this.object.position.clone();
    this.objectRotation0 = this.object.rotation.clone();

    var cameraMinZ = 100;
    var cameraMaxZ = 900;

    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var scope = this;
    var STATE = { NONE: - 1, DOWN_LEFT: 0, DOWN_RIGHT: 1 };
    var state = STATE.NONE;

    scope.domElement.addEventListener( 'mousedown', onMouseDown, false );
    scope.domElement.addEventListener( 'mouseup', onMouseUp, false );

    scope.domElement.addEventListener( 'wheel', onMouseWheel, false );
    scope.domElement.addEventListener( 'contextmenu', onContextMenu, false );

    this.dispose = function () {
        scope.domElement.removeEventListener( 'mousedown', onMouseDown, false );
        scope.domElement.removeEventListener( 'mouseup', onMouseUp, false );

        scope.domElement.removeEventListener( 'wheel', onMouseWheel, false );
        scope.domElement.removeEventListener( 'contextmenu', onContextMenu, false );
        scope.domElement.removeEventListener( 'mousemove', onMouseMove, false );
    };
    function onMouseDown( event ) {
        if ( scope.enabled === false ) return;
        event.preventDefault();
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
            document.addEventListener( 'mousemove', onMouseMove, false );
            document.addEventListener( 'mouseup', onMouseUp, false );
        }
    }
    function onMouseUp( event ) {
        if ( scope.enabled === false ) return;
        document.removeEventListener( 'mousemove', onMouseMove, false );
        document.removeEventListener( 'mouseup', onMouseUp, false );
        state = STATE.NONE;
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
    this.reset = function () {
        scope.object.position.set(scope.objectPosition0.x, scope.objectPosition0.y, scope.objectPosition0.z);
        scope.object.rotation.set(scope.objectRotation0.x, scope.objectRotation0.y, scope.objectRotation0.z);
        scope.camera.position.z = scope.cameraPosition0.z;
        state = STATE.NONE;
    };
};

THREE.MSRControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.MSRControls.prototype.constructor = THREE.MSRControls;


export default THREE.MSRControls;