/* eslint-disable */

/**
 * @author walker https://github.com/liumingzw
 */

import * as THREE from 'three';
import ThreeUtils from './ThreeUtils';
/**
 * All transformations are in world.
 * All the positions, rotations, scale refer to world.
 * @param camera
 * @param domElement
 * @constructor
 */

const OBJECT_UP = new THREE.Vector3(0, 1, 0);

THREE.TransformControls2D = function (camera, domElement) {
    THREE.Object3D.call(this);

    this.enabled = true;

    var enabledTranslate = true;
    var enabledScale = true;
    var enabledRotate = true;

    this.uniformScale = true;

    var scope = this;
    var object = null; // attached object
    var mode = null; // rotate, translate, scale{1->8}
    const raycaster = new THREE.Raycaster();

    const gizmoArr = [];
    const gizmoGroup = new THREE.Group();
    // gizmo id of scale
    // 2  6  1
    // 7     5
    // 3  8  4
    const scaleGizmoGroup = new THREE.Group();
    const translateGizmoGroup = new THREE.Group();
    const rotateGizmoGroup = new THREE.Group();
    const dashedLineFrameGizmoGroup = new THREE.Group();

    // all the following positions are world position
    var translateStartPos = new THREE.Vector3();
    var translateEndPos = new THREE.Vector3();
    var translateDeltaPos = new THREE.Vector3();


    // width first: 1, 5, 4, 2, 7, 3
    // height first: 6, 8
    var scaleFirst = '';
    var scalePivot = ''; // top_left, top_right, bottom_left, bottom_right
    var scalePivotPos = new THREE.Vector3();
    var scaleEndPos = new THREE.Vector3();
    var scaleStartDistance = 0;

    var scalePivotLinePoint1 = new THREE.Vector3();
    var scalePivotLinePoint2 = new THREE.Vector3();

    var mouseDownEvent = { type: "mouseDown" };
    var mouseUpEvent = { type: "mouseUp", mode: scope.mode };
    var objectChangeEvent = { type: "objectChange" };

    function addListeners() {
        domElement.addEventListener('mousedown', onMouseDown, false);
        domElement.addEventListener('mousemove', onMouseMove, true);
        domElement.addEventListener('mouseup', onMouseUp, false);
    }

    function removeListeners() {
        domElement.removeEventListener('mousedown', onMouseDown, false);
        domElement.removeEventListener('mousemove', onMouseMove, true);
        domElement.removeEventListener('mouseup', onMouseUp, false);
    }

    function dispose() {
		removeListeners();
    }

    function onMouseDown(event) {
        if (!object || !scope.enabled){
            return;
        }

        if (!enabledTranslate && !enabledRotate && !enabledScale){
            return;
        }

        if (event.button === THREE.MOUSE.LEFT){
            event.preventDefault();
            raycaster.setFromCamera(ThreeUtils.getMouseXY(event, domElement), camera);
            var intersects = raycaster.intersectObjects(gizmoArr);
            if (intersects.length > 0) {
                mode = intersects[0].object.name;
                if (mode === 'translate'){
                    enabledTranslate && translateStartPos.copy(ThreeUtils.getEventWorldPosition(event, domElement, camera));
                } else if (mode.indexOf('scale') !== -1){
                    if (enabledScale) {
                        var pivotName = '';
                        var scalePivotLinePoint1Name = '';
                        var scalePivotLinePoint2Name = '';
                        switch (mode) {
                            case 'scale1':
                                pivotName = 'scale3';
                                scalePivot = 'bottom_left';
                                break;
                            case 'scale2':
                                pivotName = 'scale4';
                                scalePivot = 'bottom_right';
                                break;
                            case 'scale3':
                                pivotName = 'scale1';
                                scalePivot = 'top_right';
                                break;
                            case 'scale4':
                                pivotName = 'scale2';
                                scalePivot = 'top_left';
                            case 'scale5':
                            case 'scale8':
                                pivotName = 'scale2';
                                scalePivot = 'top_left';
                                break;
                            case 'scale7':
                                pivotName = 'scale1';
                                scalePivot = 'top_right';
                                break;
                            case 'scale6':
                                pivotName = 'scale3';
                                scalePivot = 'bottom_left';
                                break;
                        }
                        switch (mode) {
                            case 'scale1':
                            case 'scale4':
                            case 'scale5':
                                scalePivotLinePoint1Name = 'scale2';
                                scalePivotLinePoint2Name = 'scale3';
                                break;
                            case 'scale2':
                            case 'scale3':
                            case 'scale7':
                                scalePivotLinePoint1Name = 'scale1';
                                scalePivotLinePoint2Name = 'scale4';
                                break;
                            case 'scale6':
                                scalePivotLinePoint1Name = 'scale3';
                                scalePivotLinePoint2Name = 'scale4';
                                break;
                            case 'scale8':
                                scalePivotLinePoint1Name = 'scale1';
                                scalePivotLinePoint2Name = 'scale2';
                                break;
                        }
                        switch (mode) {
                            case 'scale1':
                            case 'scale2':
                            case 'scale3':
                            case 'scale4':
                            case 'scale5':
                            case 'scale7':
                                scaleFirst = 'width';
                                break;
                            case 'scale6':
                            case 'scale8':
                                scaleFirst = 'height';
                                break;
                        }
                        scalePivotLinePoint1 = ThreeUtils.getObjectWorldPosition(scaleGizmoGroup.getObjectByName(scalePivotLinePoint1Name));
                        scalePivotLinePoint2 = ThreeUtils.getObjectWorldPosition(scaleGizmoGroup.getObjectByName(scalePivotLinePoint2Name));

                        const scaleTouchPoint = ThreeUtils.getObjectWorldPosition(scaleGizmoGroup.getObjectByName(mode));
                        scaleStartDistance = computePointToLineDistance(scalePivotLinePoint1, scalePivotLinePoint2, scaleTouchPoint);

                        const pivotObject = scaleGizmoGroup.getObjectByName(pivotName);
                        scalePivotPos = ThreeUtils.getObjectWorldPosition(pivotObject);
                    }
                }
                scope.dispatchEvent( mouseDownEvent );
            }
        }
    }

    function onMouseMove(event) {
        if (!scope.enabled) {
            return;
        }

        if (!enabledTranslate && !enabledRotate && !enabledScale){
            return;
        }

        // change mouse cursor
        if (!object) {
            setMouseCursor('');
        } else {
            raycaster.setFromCamera(ThreeUtils.getMouseXY(event, domElement), camera);
            var intersects = raycaster.intersectObjects(gizmoArr);
            if (intersects.length > 0) {
                const mouseCursor = intersects[0].object.name;
                setMouseCursor(mouseCursor);
            } else {
                setMouseCursor('');
            }
        }

        if (!object || !mode){
            return;
        }

        switch (mode) {
            case 'translate':
                enabledTranslate && handleMouseMoveTranslate(event);
                break;
            case 'rotate':
                enabledRotate && handleMouseMoveRotate(event);
                break;
            default: // scale
                enabledScale && handleMouseMoveScale(event);
                break;
        }
        scope.dispatchEvent( objectChangeEvent );
    }

    function onMouseUp(event) {
        mode = null;
        // todo: on after move
        scope.dispatchEvent( mouseUpEvent );
    }

    function attach(obj) {
        if (object !== obj) {
            object = obj;
            setMouseCursor('translate');
            updateGizmo();
        }
    }

    function detach() {
        object = null;
        setMouseCursor('');
        updateGizmo();
    }

    function updateGizmo() {
        if (!object || !scope.enabled){
            gizmoGroup.visible = false;
            return;
        }
        if (!enabledTranslate && !enabledRotate && !enabledScale){
            gizmoGroup.visible = false;
            return;
        }
        gizmoGroup.visible = true;

        // make world position, world rotation of both equal
        ThreeUtils.setObjectWorldPosition(gizmoGroup, ThreeUtils.getObjectWorldPosition(object));

        // var q = ThreeUtils.getObjectWorldQuaternion(object);
        // q.normalize();
        // gizmoGroup.setRotationFromQuaternion(q);

        ThreeUtils.setObjectWorldQuaternion(gizmoGroup, ThreeUtils.getObjectWorldQuaternion(object));

        // Move the gizmoGroup a little higher so that it won't be overlapped by model
        gizmoGroup.position.z = 0.1;

        const worldScale = new THREE.Vector3();
        object.getWorldScale(worldScale);
        const originSize2D = ThreeUtils.getGeometrySize(object.geometry, true);
        const width = originSize2D.x * worldScale.x;
        const height = originSize2D.y * worldScale.y;

        if (enabledTranslate) {
            const translateGizmo = translateGizmoGroup.getObjectByName('translate');
            translateGizmo.scale.set(width, height, 1);
        }

        if (enabledScale) {
            const offset = 0;
            const name = 'scale';
            const z = 0;
            scaleGizmoGroup.getObjectByName(name + 1).position.set(width/2 + offset, height/2 + offset, z);
            scaleGizmoGroup.getObjectByName(name + 2).position.set(-width/2 - offset, height/2 + offset, z);
            scaleGizmoGroup.getObjectByName(name + 3).position.set(-width/2 - offset, -height/2 - offset, z);
            scaleGizmoGroup.getObjectByName(name + 4).position.set(width/2 + offset, -height/2 - offset, z);

            scaleGizmoGroup.getObjectByName(name + 5).position.set(width/2 + offset, 0, z);
            scaleGizmoGroup.getObjectByName(name + 6).position.set(0, height/2 + offset, z);
            scaleGizmoGroup.getObjectByName(name + 7).position.set(-width/2 - offset, 0, z);
            scaleGizmoGroup.getObjectByName(name + 8).position.set(0, -height/2 - offset, z);

            const scale = Math.max(width, height) / 40;
            for (let i = 1; i <= 8; i++) {
                scaleGizmoGroup.getObjectByName(name + i).scale.set(scale, scale, 1);
            }
        }

        if (enabledRotate) {
            const rotateGizmo = rotateGizmoGroup.getObjectByName('rotate');
            const scale = Math.max(width, height) / 40;
            rotateGizmo.position.x = 0;
            rotateGizmo.position.y = height / 2 + 5 * scale;
            rotateGizmo.scale.set(scale, scale, 1);
        }

        {
            const offset = 0;
            const line = dashedLineFrameGizmoGroup.children[0];
            const geometry = line.geometry; // new THREE.Geometry();
            geometry.vertices = [];
            geometry.vertices.push(new THREE.Vector3(width / 2 + offset, height / 2 + offset, 0));
            geometry.vertices.push(new THREE.Vector3(-width / 2 - offset, height / 2 + offset, 0));
            geometry.vertices.push(new THREE.Vector3(-width / 2 - offset, -height / 2 - offset, 0));
            geometry.vertices.push(new THREE.Vector3(width / 2 + offset, -height / 2 - offset, 0));
            geometry.vertices.push(new THREE.Vector3(width / 2 + offset, height / 2 + offset, 0));
            geometry.verticesNeedUpdate = true;
            line.computeLineDistances();
        }
    }

    function generateScaleGizmo() {
        var scaleGizmo = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 10),
            new THREE.MeshBasicMaterial({ color: 0x000000, visible: false, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
        );
        {
            var geometry = new THREE.CircleGeometry( 1.2, 32 );
            var material = new THREE.MeshBasicMaterial( { color: 0x000000 } );
            var circle = new THREE.Mesh( geometry, material );
            scaleGizmo.add( circle );
        }
        {
            var geometry = new THREE.CircleGeometry( 1, 32 );
            var material = new THREE.MeshBasicMaterial( { color: 0xffffff } );
            var circle = new THREE.Mesh( geometry, material );
            scaleGizmo.add( circle );
        }
        return scaleGizmo;
    }

    function generateRotateGizmo() {
        var rotateGizmo = new THREE.Mesh (
            new THREE.PlaneGeometry(5, 5),
            new THREE.MeshBasicMaterial({ color: 0x000000, visible: false, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
        );
        {
            var geometry = new THREE.CircleGeometry( 1.2, 32 );
            var material = new THREE.MeshBasicMaterial( { color: 0x000000 } );
            var circle = new THREE.Mesh( geometry, material );
            rotateGizmo.add( circle );
        }
        {
            var geometry = new THREE.CircleGeometry( 1, 32 );
            var material = new THREE.MeshBasicMaterial( { color: 0x28a7e1 } );
            var circle = new THREE.Mesh( geometry, material );
            rotateGizmo.add( circle );
        }
        {
            var geometry = new THREE.Geometry();
            geometry.vertices.push(new THREE.Vector3( 0, 0, 0) );
            geometry.vertices.push(new THREE.Vector3( 0, -5, 0) );
            var line = new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0x28a7e1 }) );
            rotateGizmo.add(line);
        }
        return rotateGizmo;
    }

    function initGizmo() {
        gizmoGroup.visible = false;
        scope.add(gizmoGroup);

        gizmoGroup.add(translateGizmoGroup);
        gizmoGroup.add(scaleGizmoGroup);
        gizmoGroup.add(rotateGizmoGroup);
        gizmoGroup.add(dashedLineFrameGizmoGroup);

        {
            // dashed line frame
            const geometry = new THREE.Geometry();
            const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({
                color: 0x28a7e1,
                scale: 2,
                dashSize: 2,
                gapSize: 1
            }));
            line.computeLineDistances();
            dashedLineFrameGizmoGroup.add(line);
        }

        {
            // translate
            var translateGizmo = new THREE.Mesh (
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({ wireframe: false, visible: false, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
            );
            translateGizmo.name = 'translate';
            translateGizmoGroup.add(translateGizmo);
            gizmoArr.push(translateGizmo);
        }

        {
            // scale
            var scaleGizmo = generateScaleGizmo();
            for (var i = 1; i < 9; i++){
                const gizmo = scaleGizmo.clone();
                gizmo.name = 'scale' + i;
                scaleGizmoGroup.add(gizmo);
                gizmoArr.push(gizmo);
            }
        }

        {
            // rotate
            var rotateGizmo = generateRotateGizmo();
            rotateGizmo.name = 'rotate';
            rotateGizmoGroup.add(rotateGizmo);
            gizmoArr.push(rotateGizmo);
        }
    }

    // todo
    function setMouseCursor(cursorMode) {
        // http://www.hangge.com/blog/cache/detail_2065.html
        if (!cursorMode) {
            domElement.style.cursor = 'default';
        } else {
            if (cursorMode.indexOf('scale') !== -1) {
                // TODO: Set cursor style on selection/rotation, rather than on mouse movement.
                let anchorRadian = 0;
                switch (cursorMode) {
                    case 'scale1': anchorRadian = -Math.PI / 4; break;
                    case 'scale2': anchorRadian = Math.PI / 4; break;
                    case 'scale3': anchorRadian = Math.PI / 4 * 3; break;
                    case 'scale4': anchorRadian = Math.PI / 4 * 5; break;
                    case 'scale5': anchorRadian = -Math.PI / 2; break;
                    case 'scale6': anchorRadian = 0; break;
                    case 'scale7': anchorRadian = Math.PI / 2; break;
                    case 'scale8': anchorRadian = Math.PI; break;
                }

                let currentAnchorRadian = anchorRadian + object.rotation.z;
                if (currentAnchorRadian > Math.PI) {
                    currentAnchorRadian -= Math.PI * 2;
                }
                if (currentAnchorRadian < -Math.PI) {
                    currentAnchorRadian += Math.PI * 2;
                }
                const currentAnchorDirection = Math.round(currentAnchorRadian / (Math.PI / 4));

                switch (currentAnchorDirection) {
                    case 0: domElement.style.cursor = 'n-resize'; break;
                    case 1: domElement.style.cursor = 'nw-resize'; break;
                    case 2: domElement.style.cursor = 'w-resize'; break;
                    case 3: domElement.style.cursor = 'sw-resize'; break;
                    case 4:
                    case -4: domElement.style.cursor = 's-resize'; break;
                    case -3: domElement.style.cursor = 'se-resize'; break;
                    case -2: domElement.style.cursor = 'e-resize'; break;
                    case -1: domElement.style.cursor = 'ne-resize'; break;
                }
            } else if (cursorMode === 'translate') {
                domElement.style.cursor = 'all-scroll';
            } else if (cursorMode === 'rotate') {
                domElement.style.cursor = 'url(images/cursor/rotate_16x16.ico), default';
            }
        }
    }

    function handleMouseMoveTranslate(event) {
        if (!enabledTranslate) return;

        translateEndPos.copy(ThreeUtils.getEventWorldPosition(event, domElement, camera));
        translateDeltaPos.subVectors(translateEndPos, translateStartPos);
        const targetPos = ThreeUtils.getObjectWorldPosition(object).add(translateDeltaPos);
        ThreeUtils.setObjectWorldPosition(object, targetPos);
        translateStartPos.copy(translateEndPos);

        updateGizmo();
    }

    function handleMouseMoveRotate(event) {
        if (!enabledRotate) return;

        const eventWorldPos = ThreeUtils.getEventWorldPosition(event, domElement, camera);
        const objectWorldPos = ThreeUtils.getObjectWorldPosition(object);
        const v1 = new THREE.Vector3().subVectors(eventWorldPos, objectWorldPos);
        const quaternion = ThreeUtils.getQuaternionBetweenVector3(v1, OBJECT_UP);
        object.setRotationFromQuaternion(quaternion);

        updateGizmo();
    }

    // todo: not as expected when object is rotated
    function handleMouseMoveScale(event) {
        scaleEndPos.copy(ThreeUtils.getEventWorldPosition(event, domElement, camera));
        const distance = computePointToLineDistance(scalePivotLinePoint1, scalePivotLinePoint2, scaleEndPos);
        const targetDistance = scaleStartDistance + (distance - scaleStartDistance) * 2;
        const geometrySize = ThreeUtils.getGeometrySize(object.geometry, true);
        const ratio = geometrySize.y / geometrySize.x;
        var targetHeight = 0, targetWidth = 0;
        if (scaleFirst === 'width'){
            targetWidth = targetDistance;
            targetHeight = targetWidth * ratio;
        } else if (scaleFirst === 'height'){
            targetHeight = targetDistance;
            targetWidth = targetHeight / ratio;
        }

        const targetScaleX = targetWidth / geometrySize.x;
        const targetScaleY = targetHeight / geometrySize.y;
        object.scale.set(targetScaleX, targetScaleY, 1);

        updateGizmo();
    }

    function setEnabledTranslate(enable) {
        enabledTranslate = enable;
        translateGizmoGroup.visible = enabledTranslate;
        translateGizmoGroup.traverse(function(child) {
            child.visible = enabledTranslate;
        });
    }

    function setEnabledScale(enable) {
        enabledScale = enable;
        scaleGizmoGroup.visible = enabledScale;
        scaleGizmoGroup.traverse(function(child) {
            child.visible = enabledScale;
        });
    }

    function setEnabledRotate(enable) {
        enabledRotate = enable;
        rotateGizmoGroup.visible = enabledRotate;
        rotateGizmoGroup.traverse(function(child) {
            child.visible = enabledRotate;
        });
    }

    function computePointToLineDistance(p1, p2, p) {
        const a = p2.y - p1.y;
        const b = -(p2.x - p1.x);
        const c = -(p2.y - p1.y) * p1.x + (p2.x - p1.x) * p1.y;
        const distance = Math.abs((a * p.x + b * p.y + c) / (Math.sqrt(a * a + b * b)));
        return distance;
    }

    addListeners();
    initGizmo();

    // API
    this.dispose = dispose;
    this.attach = attach;
    this.detach = detach;
    this.updateGizmo = updateGizmo;

    this.setEnabledTranslate = setEnabledTranslate;
    this.setEnabledScale = setEnabledScale;
    this.setEnabledRotate = setEnabledRotate;
};

THREE.TransformControls2D.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {
    constructor: THREE.TransformControls2D
} );

export default THREE.TransformControls2D;
