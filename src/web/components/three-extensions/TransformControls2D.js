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
    this.enabledTranslate = true;
    this.enabledScale = true;
    this.enabledRotate = true;

    this.uniformScale = true;

    var scope = this;
    var object = null; // attached object
    var mode = null; // rotate, translate, scale
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

        if (!scope.enabledTranslate && !scope.enabledRotate && !scope.enabledScale){
            return;
        }

        if (event.button === THREE.MOUSE.LEFT){
            event.preventDefault();
            raycaster.setFromCamera(ThreeUtils.getMouseXY(event, domElement), camera);
            var intersects = raycaster.intersectObjects(gizmoArr);
            if (intersects.length > 0) {
                const gizmo = intersects[0].object;
                mode = gizmo.name;
                if (mode === 'translate'){
                    translateStartPos.copy(ThreeUtils.getEventWorldPosition(event, domElement, camera));
                } else if (mode.indexOf('scale') !== -1){
                    var pivotName = '';
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
                    const pivotObject = scaleGizmoGroup.getObjectByName(pivotName);
                    scalePivotPos = ThreeUtils.getObjectWorldPosition(pivotObject);
                }
                scope.dispatchEvent( mouseDownEvent );
            }
        }
    }

    function onMouseMove(event) {
        // change mouse cursor
        raycaster.setFromCamera(ThreeUtils.getMouseXY(event, domElement), camera);
        var intersects = raycaster.intersectObjects(gizmoArr);
        if (intersects.length > 0) {
            const gizmo = intersects[0].object;
            setMouseCursor(gizmo.name);
        } else {
            setMouseCursor(null);
        }

        if (!object || !mode || !scope.enabled){
            return;
        }

        if (!scope.enabledTranslate && !scope.enabledRotate && !scope.enabledScale){
            return;
        }

        switch (mode) {
            case 'translate':
                handleMouseMoveTranslate(event);
                break;
            case 'rotate':
                handleMouseMoveRotate(event);
                break;
            default: // scale
                handleMouseMoveScale(event);
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
        if (object !== obj){
            object = obj;
            updateGizmo();
        }
    }

    function detach() {
        object = null;
        updateGizmo();
    }

    function updateGizmo() {
        if (!object || !scope.enabled){
            gizmoGroup.visible = false;
            return;
        }
        if (!scope.enabledTranslate && !scope.enabledRotate && !scope.enabledScale){
            gizmoGroup.visible = false;
            return;
        }
        gizmoGroup.visible = true;

        translateGizmoGroup.visible = scope.enabledTranslate;
        scaleGizmoGroup.visible = scope.enabledScale;
        rotateGizmoGroup.visible = scope.enabledRotate;

        // make world position, world rotation of both equal
        ThreeUtils.setObjectWorldPosition(gizmoGroup, ThreeUtils.getObjectWorldPosition(object));

        // var q = ThreeUtils.getObjectWorldQuaternion(object);
        // q.normalize();
        // gizmoGroup.setRotationFromQuaternion(q);

        ThreeUtils.setObjectWorldQuaternion(gizmoGroup, ThreeUtils.getObjectWorldQuaternion(object));

        const worldScale = new THREE.Vector3();
        object.getWorldScale(worldScale);
        const originSize2D = ThreeUtils.getGeometrySize(object.geometry, true);
        const width = originSize2D.x * worldScale.x;
        const height = originSize2D.y * worldScale.y;

        if(scope.enabledTranslate) {
            const translateGizmo = translateGizmoGroup.getObjectByName('translate');
            translateGizmo.scale.set(width, height, 1);
        }

        if (scope.enabledScale){
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
        }

        if (scope.enabledRotate){
            const rotateGizmo = rotateGizmoGroup.getObjectByName('rotate');
            rotateGizmo.position.x = 0;
            rotateGizmo.position.y = height/2 + 10;
        }

        {
            const offset = 0;
            const z = 0;
            const line = dashedLineFrameGizmoGroup.children[0];
            const geometry = line.geometry; //new THREE.Geometry();
            geometry.vertices = [];
            geometry.vertices.push(new THREE.Vector3(width/2 + offset, height/2 + offset, z));
            geometry.vertices.push(new THREE.Vector3(-width/2 - offset, height/2 + offset, z));
            geometry.vertices.push(new THREE.Vector3(-width/2 - offset, -height/2 - offset, z));
            geometry.vertices.push(new THREE.Vector3(width/2 + offset, -height/2 - offset, z));
            geometry.vertices.push(new THREE.Vector3(width/2 + offset, height/2 + offset, z));
            geometry.verticesNeedUpdate = true;
            line.computeLineDistances();
        }
    }

    function generateScaleGizmo() {
        var scaleGizmo = new THREE.Mesh (
            new THREE.PlaneGeometry(10, 10),
            new THREE.MeshBasicMaterial({ color: 0x000000, visible: false, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
        );
        {
            var geometry = new THREE.CircleGeometry( 1.5, 32 );
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
            new THREE.PlaneGeometry(10, 10),
            new THREE.MeshBasicMaterial({ color: 0x000000, visible: false, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
        );
        {
            var geometry = new THREE.CircleGeometry( 1.5, 32 );
            var material = new THREE.MeshBasicMaterial( { color: 0x0000ff } );
            var circle = new THREE.Mesh( geometry, material );
            rotateGizmo.add( circle );
        }
        {
            var geometry = new THREE.CircleGeometry( 1, 32 );
            var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
            var circle = new THREE.Mesh( geometry, material );
            rotateGizmo.add( circle );
        }
        {
            var geometry = new THREE.Geometry();
            geometry.vertices.push(new THREE.Vector3( 0, 0, 0) );
            geometry.vertices.push(new THREE.Vector3( 0, -10, 0) );
            var line = new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0x0000ff }) );
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
            var geometry = new THREE.Geometry();
            var line = new THREE.Line( geometry, new THREE.LineDashedMaterial( { color: 0x0000ff, dashSize: 3, gapSize: 2 } ) );
            line.computeLineDistances();
            dashedLineFrameGizmoGroup.add(line);
        }
        {
            // translate
            var translateGizmo = new THREE.Mesh (
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({ wireframe: false, visible: false, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
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
    function setMouseCursor(gizmoName){
        // http://www.hangge.com/blog/cache/detail_2065.html
        if (!gizmoName){
            domElement.style.cursor = 'default';
        } else {
            if (gizmoName.indexOf('scale') !== -1){
                domElement.style.cursor = 'ew-resize';
            } else if (gizmoName === 'translate'){
                domElement.style.cursor = 'all-scroll';
            } else if (gizmoName === 'rotate'){
                domElement.style.cursor = 'cell';
            }
        }
    }

    function handleMouseMoveTranslate(event) {
        if (!scope.enabledTranslate) return;

        translateEndPos.copy(ThreeUtils.getEventWorldPosition(event, domElement, camera));
        translateDeltaPos.subVectors(translateEndPos, translateStartPos);
        const targetPos = ThreeUtils.getObjectWorldPosition(object).add(translateDeltaPos);
        ThreeUtils.setObjectWorldPosition(object, targetPos);
        translateStartPos.copy(translateEndPos);

        updateGizmo();
    }

    function handleMouseMoveRotate(event) {
        if (!scope.enabledRotate) return;

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

        const size = new THREE.Vector3().subVectors(scaleEndPos, scalePivotPos);

        if (scope.uniformScale){
            const originSize2D = ThreeUtils.getGeometrySize(object.geometry, true);
            const angle = Math.atan2(originSize2D.y, originSize2D.x);
            const length = size.length();
            var targetWidth =  length * Math.cos(angle);
            var targetHeight =  length * Math.sin(angle);

            const r = originSize2D.y / originSize2D.x;
            if (scaleFirst === 'width'){
                targetHeight = targetWidth * r;
            } else if (scaleFirst === 'height'){
                targetWidth = targetHeight / r;
            }
        }
        const targetSize = new THREE.Vector2(Math.abs(targetWidth), Math.abs(targetHeight));
        ThreeUtils.scaleObjectToWorldSize(object, targetSize, scalePivot);

        updateGizmo();
    }

    addListeners();
    initGizmo();

    // API
    this.dispose = dispose;
    this.attach = attach;
    this.detach = detach;
    this.updateGizmo = updateGizmo;
};

THREE.TransformControls2D.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {
    constructor: THREE.TransformControls2D
} );

export default THREE.TransformControls2D;
