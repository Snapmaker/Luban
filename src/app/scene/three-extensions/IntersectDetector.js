/* eslint-disable */

/**
 * @author walker https://github.com/liumingzw
 */

import * as THREE from 'three';

THREE.IntersectDetector = function (objects, camera, domElement) {
    var raycaster = new THREE.Raycaster();
    var scope = this;
	function addListeners() {
		domElement.addEventListener('mousedown', onMouseDown, false);
	}

	function removeListeners() {
		domElement.removeEventListener('mousedown', onMouseDown, false);
	}

	function dispose() {
		removeListeners();
	}

	function onMouseDown(event) {
        if (scope.enabled === false) return;
        // only detect when left-mouse-down
        if (event.button === THREE.MOUSE.LEFT){
            event.preventDefault();
            raycaster.setFromCamera(getMousePosition(event), camera);
            var intersects = raycaster.intersectObjects(objects, false);
            if (intersects.length > 0) {
                var detectedObject = intersects[0].object;
                scope.dispatchEvent({type: 'detected', object: detectedObject});
            }
        }
	}

    function getMousePosition(event) {
        var rect = domElement.getBoundingClientRect();
        return new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
		)
    }

	addListeners();

	// API
	this.enabled = true;
	this.dispose = dispose;
};

THREE.IntersectDetector.prototype = Object.create(THREE.EventDispatcher.prototype);
THREE.IntersectDetector.prototype.constructor = THREE.IntersectDetector;

export default THREE.IntersectDetector;