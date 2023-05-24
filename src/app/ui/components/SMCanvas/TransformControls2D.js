import {
    Vector3, Quaternion,
    Object3D, Raycaster
} from 'three';
import ThreeUtils from '../../../scene/three-extensions/ThreeUtils';
import { isZero } from '../../../../shared/lib/utils';
import Peripheral from './Peripheral';
import { SELECTEVENT } from '../../../constants';


const EVENTS = {
    UPDATE: { type: 'update' }
};

/**
 * TransformControls2D
 *
 * Interfaces:
 *  - mode: translate, rotate, scale
 *  - constructor(camera)
 *  - addEventListener()
 *  - onMouseHover()
 *  - onMouseDown()
 *  - onMouseMove()
 *  - onMouseUp()
 *  - attach()
 *  - detach()
 */
class TransformControls2D extends Object3D {
    camera = null;

    objects = [];

    peripherals = [];

    mode = null;

    pickers = [];

    // ray for intersect calculation
    ray = new Raycaster();

    dragging = false;

    // object matrix
    positionStart = new Vector3();

    // quaternionStart = new Quaternion();

    scaleStart = new Vector3();

    // event
    pointStart = new Vector3();

    pointEnd = new Vector3();

    // scale helper variables
    scalePivotPoint = new Vector3();

    scaleCenterPoint = new Vector3();

    scaleMovingPoint = new Vector3();

    constructor(camera) {
        super();

        this.camera = camera;
        this.visible = false;

        // this.initFramePeripherals();
        // this.initTranslatePeripherals();
        // this.initRotatePeripherals();
        // this.initScalePeripherals();
    }

    // createPeripheral(definitions) {
    //     const peripheral = new Object3D();
    //
    //     for (const definition of definitions) {
    //         const [label, object, position, rotation, scale] = definition;
    //         object.label = label;
    //
    //         if (position) {
    //             object.position.set(position[0], position[1], position[2]);
    //         }
    //
    //         if (rotation) {
    //             object.rotation.set(rotation[0], rotation[1], rotation[2]);
    //         }
    //
    //         if (scale) {
    //             object.scale.set(scale[0], scale[1], scale[2]);
    //         }
    //
    //         // place the geometry natural at origin
    //         object.updateMatrix();
    //         object.geometry.applyMatrix(object.matrix);
    //
    //         object.position.set(0, 0, 0);
    //         object.rotation.set(0, 0, 0);
    //         object.scale.set(1, 1, 1);
    //
    //         peripheral.add(object);
    //     }
    //
    //     return peripheral;
    // }

    initDefaults() {
        this.defaults = {};
    }

    destroyDefaults() {
        this.defaults = null;
    }

    // initFramePeripherals() {
    //     const material = new LineDashedMaterial({
    //         color: BLUE,
    //         dashSize: 2,
    //         gapSize: 1
    //     });
    //     const frame = new Line(geometry, material);
    //     // frame.computeLineDistances(); // ?
    //
    //     this.framePeripheral = this.createPeripheral([
    //         ['frame', frame]
    //     ]);
    //     this.add(this.framePeripheral);
    // }

    // initTranslatePeripherals() {
    //     // translate
    //     const plane = new Mesh(
    //         new PlaneGeometry(1, 1),
    //         new MeshBasicMaterial({
    //             wireframe: false,
    //             visible: false,
    //             side: DoubleSide,
    //             transparent: true,
    //             opacity: 0.5
    //         })
    //     );
    //
    //     this.translatePeripheral = this.createPeripheral([
    //         ['translate', plane]
    //     ]);
    //     this.add(this.translatePeripheral);
    //
    //     this.pickers.push(this.translatePeripheral);
    // }

    // updateMatrixWorld(force) {
    //     if (this.object) {
    //         // object
    //         const objectPosition = new Vector3();
    //         const objectQuaternion = new Quaternion();
    //         const objectScale = new Vector3();
    //
    //         this.object.updateMatrixWorld();
    //         this.object.matrixWorld.decompose(objectPosition, objectQuaternion, objectScale);
    //
    //         const size = ThreeUtils.getGeometrySize(this.object.geometry, true);
    //         const width = size.x * objectScale.x;
    //         const height = size.y * objectScale.y;
    //
    //         // const eyeDistance = this.camera.position.z;
    //
    //         // Update peripherals
    //         const peripherals = [this.framePeripheral, this.translatePeripheral];
    //         for (const peripheral of peripherals) {
    //             peripheral.position.copy(objectPosition);
    //             peripheral.position.z = 0.1;
    //             peripheral.quaternion.copy(objectQuaternion);
    //         }
    //
    //         { // this.framePeripheral
    //             const offset = 0;
    //             const line = this.framePeripheral.children[0];
    //             const geometry = line.geometry; // new THREE.Geometry();
    //             geometry.vertices = [];
    //             geometry.vertices.push(new Vector3(width / 2 + offset, height / 2 + offset, 0));
    //             geometry.vertices.push(new Vector3(-width / 2 - offset, height / 2 + offset, 0));
    //             geometry.vertices.push(new Vector3(-width / 2 - offset, -height / 2 - offset, 0));
    //             geometry.vertices.push(new Vector3(width / 2 + offset, -height / 2 - offset, 0));
    //             geometry.vertices.push(new Vector3(width / 2 + offset, height / 2 + offset, 0));
    //             geometry.verticesNeedUpdate = true;
    //             line.computeLineDistances();
    //         }
    //
    //         // translate
    //         this.translatePeripheral.scale.set(width, height, 1);
    //     }
    //
    //     super.updateMatrixWorld(force);
    // }

    updateMouseCursor() {
        /*
        switch (this.mode) {
            case 'translate':
                document.body.style.cursor = 'pointer';
                break;
            default:
                document.body.style.cursor = 'default';
                break;
        }
        */
    }


    attach(object, selectEvent) {
        if (!selectEvent) {
            return;
        }
        if (selectEvent === SELECTEVENT.UNSELECT_ADDSELECT) {
            for (const peripheral of this.peripherals) {
                this.remove(peripheral);
            }
            this.objects = [];
            this.peripherals = [];

            this.objects.push(object);
            const peripheral = new Peripheral(object);
            this.peripherals.push(peripheral);
            this.add(peripheral);
        } else if (selectEvent === SELECTEVENT.ADDSELECT) {
            if (!this.objects.includes(object)) {
                this.objects.push(object);
                const peripheral = new Peripheral(object);
                this.peripherals.push(peripheral);
                this.add(peripheral);
            }
        } else if (selectEvent === SELECTEVENT.REMOVESELECT) {
            const index = this.objects.findIndex(o => o === object);
            this.objects.splice(index, 1);
            const removePeripherals = this.peripherals.splice(index, 1);
            this.remove(removePeripherals[0]);
        } else {
            for (const peripheral of this.peripherals) {
                this.remove(peripheral);
            }
        }

        this.visible = true;

        this.dispatchEvent(EVENTS.UPDATE);
    }

    detach() {
        for (const peripheral of this.peripherals) {
            this.remove(peripheral);
        }
        this.objects = [];
        this.peripherals = [];

        this.visible = false;
        if (this.mode) {
            this.mode = null;
            this.updateMouseCursor();
        }
        this.dispatchEvent(EVENTS.UPDATE);
    }

    // updateFramePeripheralVisible(visible) {
    //     this.framePeripheral.visible = visible;
    //     this.dispatchEvent(EVENTS.UPDATE);
    // }


    onMouseHover(coord) {
        if (!this.object) {
            return false;
        }

        this.ray.setFromCamera(coord, this.camera);

        const intersect = this.ray.intersectObjects(this.pickers, true)[0];
        if (intersect) {
            this.mode = intersect.object.label;
            this.tag = intersect.object.tag;
        } else {
            this.mode = null;
        }

        this.updateMouseCursor();

        return true;
    }

    onMouseDown(coord) {
        if (!this.object || !this.mode) {
            return false;
        }

        this.ray.setFromCamera(coord, this.camera);

        const direction = this.ray.ray.direction;
        const scalar = -this.camera.position.z / direction.z;
        const intersectPoint = new Vector3().copy(this.camera.position).add(direction.multiplyScalar(scalar));

        this.positionStart.copy(this.object.position);
        this.scaleStart.copy(this.object.scale);

        this.pointStart.copy(intersectPoint);

        switch (this.mode) {
            case 'scale': {
                const size = ThreeUtils.getGeometrySize(this.object.geometry, true);

                const xDirection = Math.round(Math.cos(this.tag * (Math.PI / 4)));
                const yDirection = Math.round(Math.sin(this.tag * (Math.PI / 4)));

                this.scalePivotPoint.set(-size.x / 2 * xDirection, -size.y / 2 * yDirection, 0).applyMatrix4(this.object.matrixWorld);
                this.scaleCenterPoint.set(0, 0, 0).applyMatrix4(this.object.matrixWorld);
                this.scaleMovingPoint.set(size.x / 2 * xDirection, size.y / 2 * yDirection, 0).applyMatrix4(this.object.matrixWorld);

                break;
            }
            default:
                // If no event is displayed for the selected object, the operation is returned to STATE.PAN
                return false;
        }

        this.dragging = true;

        return true;
    }

    onMouseMove(coord) {
        if (!this.object || !this.mode || !this.dragging) {
            return false;
        }

        this.ray.setFromCamera(coord, this.camera);

        const direction = this.ray.ray.direction;
        const scalar = -this.camera.position.z / direction.z;
        const intersectPoint = new Vector3().copy(this.camera.position).add(direction.multiplyScalar(scalar));

        this.pointEnd.copy(intersectPoint);

        const offset = new Vector3().subVectors(this.pointEnd, this.pointStart);

        switch (this.mode) {
            case 'translate': {
                this.object.position.copy(this.positionStart).add(offset);
                break;
            }
            case 'rotate': {
                const up = new Vector3(0, 1, 0);
                const clockPoint = new Vector3().subVectors(this.pointEnd, this.object.getWorldPosition());
                const quaternion = ThreeUtils.getQuaternionBetweenVector3(clockPoint, up);
                this.object.quaternion.copy(quaternion);
                break;
            }
            case 'scale': {
                // const direction2 = new Vector3().subVectors(this.scaleMovingPoint, this.scaleCenterPoint).normalize();
                // const movement = new Vector3().copy(direction2).multiplyScalar(new Vector3().copy(direction2).dot(offset));

                // const movingPoint = new Vector3().copy(this.scaleMovingPoint).add(movement);

                // eslint-disable-next-line no-unused-vars
                // const l1 = new Vector3().subVectors(this.scaleMovingPoint, this.scalePivotPoint).length();
                // eslint-disable-next-line no-unused-vars
                // const l2 = new Vector3().subVectors(movingPoint, this.scalePivotPoint).length();
                // eslint-disable-next-line no-unused-vars

                const diagonal = new Vector3().copy(this.scaleMovingPoint).sub(this.scalePivotPoint);
                const nDiagonal = new Vector3().copy(offset).add(diagonal);

                const quaternion = new Quaternion().copy(this.object.quaternion);
                const quaternionInverse = new Quaternion().copy(quaternion).inverse();

                const rDiagonal = new Vector3().copy(diagonal).applyQuaternion(quaternionInverse);
                const rNDiagonal = new Vector3().copy(nDiagonal).applyQuaternion(quaternionInverse);

                const scale = new Vector3(Math.abs(isZero(rDiagonal.x) ? 1 : rNDiagonal.x / rDiagonal.x),
                    Math.abs(isZero(rDiagonal.y) ? 1 : rNDiagonal.y / rDiagonal.y), 1);

                // const movement = new Vector3().subVectors(nDiagonal.multiplyScalar(0.5), diagonal.multiplyScalar(0.5));
                const movement = new Vector3().subVectors(rNDiagonal.multiplyScalar(0.5), rDiagonal.multiplyScalar(0.5));
                movement.x = isZero(rDiagonal.x) ? 0 : movement.x;
                movement.y = isZero(rDiagonal.y) ? 0 : movement.y;

                this.object.scale.copy(this.scaleStart).multiplyVectors(this.scaleStart, scale);
                this.object.position.copy(this.positionStart).add(movement.applyQuaternion(quaternion));

                break;
            }
            default:
                break;
        }

        this.dispatchEvent(EVENTS.UPDATE);

        return true;
    }

    onMouseUp() {
        this.dragging = false;
    }
}

export default TransformControls2D;
