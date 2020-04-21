/**
 * ManualCalibrationControls
 *
 * @author walker https://github.com/liumingzw
 */

import * as THREE from 'three';
import ThreeUtils from './ThreeUtils';

/**
 *
 * @param camera
 * @param domElement
 * @param scale
 * @param remapBox2
 * @param cornerPositions { leftTop, leftBottom, rightBottom, rightTop }
 * @constructor
 */
function ManualCalibrationControls(camera, domElement, scale, remapBox2, cornerPositions) {
    THREE.Object3D.call(this);

    this.position.z = 1;

    // TODO: pass size to the control
    const initialSize = 100;

    if (!remapBox2) {
        // TODO: hardcoded bound size
        remapBox2 = new THREE.Box2(
            new THREE.Vector2(0, 0),
            new THREE.Vector2(initialSize, initialSize)
        );
    }

    if (!cornerPositions) {
        const pos = initialSize / 2;
        cornerPositions = {
            leftTop: new THREE.Vector3(-pos, pos, 0),
            leftBottom: new THREE.Vector3(-pos, -pos, 0),
            rightBottom: new THREE.Vector3(pos, -pos, 0),
            rightTop: new THREE.Vector3(pos, pos, 0)
        };
    }

    this.enabled = true;

    let leftTopGizmo, leftBottomGizmo, rightTopGizmo, rightBottomGizmo;
    let dashedLine;
    const gizmoArr = [];
    let selectedGizmo;

    const scope = this;
    const raycaster = new THREE.Raycaster();

    function generateGizmo() {
        const gizmo = new THREE.Mesh(
            new THREE.PlaneGeometry(30, 30),
            new THREE.MeshBasicMaterial({ color: 0x000000, visible: false, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
        );

        // TODO: make the circle transparent so we can see beneath engrave trace
        {
            const geometry = new THREE.CircleGeometry(scale * 10, 64);
            const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const circle = new THREE.Mesh(geometry, material);
            gizmo.add(circle);
        }
        {
            const geometry = new THREE.CircleGeometry(scale * 7.2, 64);
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const circle = new THREE.Mesh(geometry, material);
            gizmo.add(circle);
        }
        return gizmo;
    }

    function updateDashedLine() {
        const geometry = dashedLine.geometry;
        geometry.vertices = [];
        geometry.vertices.push(rightTopGizmo.position);
        geometry.vertices.push(rightBottomGizmo.position);
        geometry.vertices.push(leftBottomGizmo.position);
        geometry.vertices.push(leftTopGizmo.position);
        geometry.vertices.push(rightTopGizmo.position);
        geometry.verticesNeedUpdate = true;
        dashedLine.computeLineDistances();
    }

    function init() {
        leftTopGizmo = generateGizmo();
        leftBottomGizmo = generateGizmo();
        rightTopGizmo = generateGizmo();
        rightBottomGizmo = generateGizmo();

        scope.add(leftTopGizmo);
        scope.add(leftBottomGizmo);
        scope.add(rightTopGizmo);
        scope.add(rightBottomGizmo);

        gizmoArr.push(leftTopGizmo);
        gizmoArr.push(leftBottomGizmo);
        gizmoArr.push(rightTopGizmo);
        gizmoArr.push(rightBottomGizmo);

        leftTopGizmo.position.copy(cornerPositions.leftTop);
        leftBottomGizmo.position.copy(cornerPositions.leftBottom);
        rightTopGizmo.position.copy(cornerPositions.rightTop);
        rightBottomGizmo.position.copy(cornerPositions.rightBottom);

        const geometry = new THREE.Geometry();
        dashedLine = new THREE.Line(geometry, new THREE.LineDashedMaterial({
            color: 0x28a7e1,
            scale: 1,
            dashSize: 4,
            gapSize: 3
        }));
        scope.add(dashedLine);
        updateDashedLine();
    }

    function ensureRange(point, min, max) {
        point = point > max ? max : point;
        point = point < min ? min : point;
        return point;
    }

    function updateRectangleSize(pointArray, width, height) {
        remapBox2 = new THREE.Box2(
            new THREE.Vector2(-width / 2, -height / 2),
            new THREE.Vector2(width / 2, height / 2)
        );
        const [leftBottomX, leftBottomY] = [
            ensureRange(pointArray[3].x - width / 2, -width / 2, 0),
            ensureRange(-(pointArray[3].y - height / 2), -height / 2, 0)];
        const [rightBottomX, rightBottomY] = [
            ensureRange(pointArray[2].x - width / 2, 0, width / 2),
            ensureRange(-(pointArray[2].y - height / 2), -height / 2, 0)];
        const [rightTopX, rightTopY] = [
            ensureRange(pointArray[1].x - width / 2, 0, width / 2),
            ensureRange(-(pointArray[1].y - height / 2), 0, height / 2)];
        const [leftTopX, leftTopY] = [
            ensureRange(pointArray[0].x - width / 2, -width / 2, 0),
            ensureRange(-(pointArray[0].y - height / 2), 0, height / 2)];
        cornerPositions = {
            leftTop: new THREE.Vector3(leftTopX, leftTopY, 0),
            rightTop: new THREE.Vector3(rightTopX, rightTopY, 0),
            rightBottom: new THREE.Vector3(rightBottomX, rightBottomY, 0),
            leftBottom: new THREE.Vector3(leftBottomX, leftBottomY, 0)
        };
        // cornerPositions = {
        //     leftTop: new THREE.Vector3((pointArray[0].x - width / 2), -(pointArray[0].y - height / 2), 0),
        //     rightTop: new THREE.Vector3((pointArray[1].x - width / 2), -(pointArray[1].y - height / 2), 0),
        //     rightBottom: new THREE.Vector3((pointArray[2].x - width / 2), -(pointArray[2].y - height / 2), 0),
        //     leftBottom: new THREE.Vector3((pointArray[3].x - width / 2), -(pointArray[3].y - height / 2), 0)
        // };
    }


    function onMouseDown(event) {
        if (!scope.enabled || !scope.visible) {
            return;
        }

        if (event.button === THREE.MOUSE.LEFT) {
            event.preventDefault();
            raycaster.setFromCamera(ThreeUtils.getMouseXY(event, domElement), camera);
            const intersects = raycaster.intersectObjects(gizmoArr);
            if (intersects.length > 0) {
                selectedGizmo = intersects[0].object;
            }
        }
    }

    function onMouseMove(event) {
        if (!scope.visible) {
            return;
        }
        event.preventDefault();
        raycaster.setFromCamera(ThreeUtils.getMouseXY(event, domElement), camera);
        const intersects = raycaster.intersectObjects(gizmoArr);
        if (intersects.length > 0) {
            domElement.style.cursor = 'all-scroll';
        } else {
            domElement.style.cursor = 'default';
        }

        if (!scope.enabled || !selectedGizmo) {
            return;
        }

        const pos = ThreeUtils.getEventWorldPosition(event, domElement, camera);

        if (pos.x < remapBox2.min.x) {
            pos.x = remapBox2.min.x;
        }
        if (pos.x > remapBox2.max.x) {
            pos.x = remapBox2.max.x;
        }
        if (pos.y < remapBox2.min.y) {
            pos.y = remapBox2.min.y;
        }
        if (pos.y > remapBox2.max.y) {
            pos.y = remapBox2.max.y;
        }

        if (selectedGizmo === leftTopGizmo) {
            if (pos.x > 0) {
                pos.x = 0;
            }
            if (pos.y < 0) {
                pos.y = 0;
            }
            selectedGizmo.position.copy(pos);
        } else if (selectedGizmo === leftBottomGizmo) {
            if (pos.x > 0) {
                pos.x = 0;
            }
            if (pos.y > 0) {
                pos.y = 0;
            }
            selectedGizmo.position.copy(pos);
        } else if (selectedGizmo === rightTopGizmo) {
            if (pos.x < 0) {
                pos.x = 0;
            }
            if (pos.y < 0) {
                pos.y = 0;
            }
            selectedGizmo.position.copy(pos);
        } else if (selectedGizmo === rightBottomGizmo) {
            if (pos.x < 0) {
                pos.x = 0;
            }
            if (pos.y > 0) {
                pos.y = 0;
            }
            selectedGizmo.position.copy(pos);
        }

        updateDashedLine();
    }

    function onMouseUp() {
        selectedGizmo = null;
    }

    function getCornerPositions() {
        return {
            leftTop: leftTopGizmo.position.clone(),
            leftBottom: leftBottomGizmo.position.clone(),
            rightBottom: rightBottomGizmo.position.clone(),
            rightTop: rightTopGizmo.position.clone()
        };
    }

    function resetCornerPositions() {
        rightTopGizmo.position.copy(cornerPositions.rightTop);
        rightBottomGizmo.position.copy(cornerPositions.rightBottom);
        leftTopGizmo.position.copy(cornerPositions.leftTop);
        leftBottomGizmo.position.copy(cornerPositions.leftBottom);
        updateDashedLine();
    }

    function addListeners() {
        domElement.addEventListener('mousedown', onMouseDown, false);
        domElement.addEventListener('mousemove', onMouseMove, false);
        domElement.addEventListener('mouseup', onMouseUp, false);
    }

    function removeListeners() {
        domElement.removeEventListener('mousedown', onMouseDown, false);
        domElement.removeEventListener('mousemove', onMouseMove, false);
        domElement.removeEventListener('mouseup', onMouseUp, false);
    }

    function dispose() {
        removeListeners();
    }

    addListeners();
    init();

    // API
    this.dispose = dispose;
    this.updateRectangleSize = updateRectangleSize;
    this.getCornerPositions = getCornerPositions;
    this.resetCornerPositions = resetCornerPositions;
}

ManualCalibrationControls.prototype = Object.assign(Object.create(THREE.Object3D.prototype), {
    constructor: ManualCalibrationControls
});

export default ManualCalibrationControls;
