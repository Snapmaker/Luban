import {
    DoubleSide,
    Vector3, Quaternion,
    Object3D, Raycaster,
    Geometry, PlaneGeometry, CircleGeometry,
    LineBasicMaterial, LineDashedMaterial, MeshBasicMaterial,
    Line, Mesh
} from 'three';
import ThreeUtils from '../three-extensions/ThreeUtils';


const EVENTS = {
    UPDATE: { type: 'update' }
};

const BLUE = 0x00b7ee;

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

    object = null;

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
    scaleCenterPoint = new Vector3();

    scaleMovingPoint = new Vector3();

    constructor(camera) {
        super();

        this.camera = camera;
        this.visible = false;

        this.initFramePeripherals();
        this.initTranslatePeripherals();
        this.initRotatePeripherals();
        this.initScalePeripherals();
    }

    createPeripheral(definitions) {
        const peripheral = new Object3D();

        for (const definition of definitions) {
            const [label, object, position, rotation, scale] = definition;
            object.label = label;

            if (position) {
                object.position.set(position[0], position[1], position[2]);
            }

            if (rotation) {
                object.rotation.set(rotation[0], rotation[1], rotation[2]);
            }

            if (scale) {
                object.scale.set(scale[0], scale[1], scale[2]);
            }

            // place the geometry natural at origin
            object.updateMatrix();
            object.geometry.applyMatrix(object.matrix);

            object.position.set(0, 0, 0);
            object.rotation.set(0, 0, 0);
            object.scale.set(1, 1, 1);

            peripheral.add(object);
        }

        return peripheral;
    }

    initDefaults() {
        this.defaults = {};
    }

    destroyDefaults() {
        this.defaults = null;
    }

    initFramePeripherals() {
        // dashed line frame
        const frame = new Line(new Geometry(), new LineDashedMaterial({
            color: BLUE,
            dashSize: 2,
            gapSize: 1
        }));
        frame.computeLineDistances(); // ?

        this.framePeripheral = this.createPeripheral([
            ['frame', frame]
        ]);
        this.add(this.framePeripheral);
    }

    initTranslatePeripherals() {
        // translate
        const plane = new Mesh(
            new PlaneGeometry(1, 1),
            new MeshBasicMaterial({ wireframe: false, visible: false, side: DoubleSide, transparent: true, opacity: 0.5 })
        );

        this.translatePeripheral = this.createPeripheral([
            ['translate', plane]
        ]);
        this.add(this.translatePeripheral);

        this.pickers.push(this.translatePeripheral);
    }

    initRotatePeripherals() {
        // TODO: refactor
        let geometry, material;

        geometry = new CircleGeometry(0.06, 32);
        material = new MeshBasicMaterial({ color: 0x000000 });
        const circleOuter = new Mesh(geometry, material);

        geometry = new CircleGeometry(0.05, 32);
        material = new MeshBasicMaterial({ color: BLUE });
        const circleInner = new Mesh(geometry, material);

        geometry = new Geometry();
        geometry.vertices.push(new Vector3(0, 0, 0));
        geometry.vertices.push(new Vector3(0, 0.5, 0));
        const line = new Line(geometry, new LineBasicMaterial({ color: BLUE }));

        const plane = new Mesh(
            new PlaneGeometry(0.25, 0.25),
            new MeshBasicMaterial({ visible: false, side: DoubleSide, transparent: true, opacity: 0.5 })
        );

        this.rotatePeripheral = this.createPeripheral([
            ['rotate', plane, [0, 0.5, 0]],
            ['rotate', circleOuter, [0, 0.5, 0]],
            ['rotate', circleInner, [0, 0.5, 0]],
            ['rotate', line],
        ]);
        this.add(this.rotatePeripheral);

        this.pickers.push(this.rotatePeripheral);
    }

    initScalePeripherals() {
        let geometry, material;

        const definitions = [];
        for (let i = 0; i < 8; i++) {
            geometry = new CircleGeometry(0.06, 32);
            material = new MeshBasicMaterial({ color: 0x000000 });
            const circleOuter = new Mesh(geometry, material);

            geometry = new CircleGeometry(0.05, 32);
            material = new MeshBasicMaterial({ color: 0xffffff });
            const circleInner = new Mesh(geometry, material);

            circleOuter.tag = i;
            circleInner.tag = i;

            definitions.push(
                ['scale', circleOuter],
                ['scale', circleInner]
            );
        }

        this.scalePeripheral = this.createPeripheral(definitions);
        this.add(this.scalePeripheral);

        const pickerDefinitions = [];
        for (let i = 0; i < 8; i++) {
            const plane = new Mesh(
                new PlaneGeometry(0.25, 0.25),
                new MeshBasicMaterial({ visible: false, side: DoubleSide, transparent: true, opacity: 0.5 })
            );
            plane.tag = i; // record tag for later use

            pickerDefinitions.push(['scale', plane]);
        }
        this.scalePicker = this.createPeripheral(pickerDefinitions);
        this.add(this.scalePicker);

        this.pickers.push(this.scalePicker);
    }

    updateMatrixWorld(force) {
        if (this.object) {
            // object
            const objectPosition = new Vector3();
            const objectQuaternion = new Quaternion();
            const objectScale = new Vector3();

            this.object.updateMatrixWorld();
            this.object.matrixWorld.decompose(objectPosition, objectQuaternion, objectScale);

            const size = ThreeUtils.getGeometrySize(this.object.geometry, true);
            const width = size.x * objectScale.x;
            const height = size.y * objectScale.y;

            const eyeDistance = this.camera.position.z;

            // Update peripherals
            const peripherals = [this.framePeripheral, this.translatePeripheral, this.rotatePeripheral, this.scalePeripheral, this.scalePicker];
            for (const peripheral of peripherals) {
                peripheral.position.copy(objectPosition);
                peripheral.position.z = 0.1;
                peripheral.quaternion.copy(objectQuaternion);
            }

            { // this.framePeripheral
                const offset = 0;
                const line = this.framePeripheral.children[0];
                const geometry = line.geometry; // new THREE.Geometry();
                geometry.vertices = [];
                geometry.vertices.push(new Vector3(width / 2 + offset, height / 2 + offset, 0));
                geometry.vertices.push(new Vector3(-width / 2 - offset, height / 2 + offset, 0));
                geometry.vertices.push(new Vector3(-width / 2 - offset, -height / 2 - offset, 0));
                geometry.vertices.push(new Vector3(width / 2 + offset, -height / 2 - offset, 0));
                geometry.vertices.push(new Vector3(width / 2 + offset, height / 2 + offset, 0));
                geometry.verticesNeedUpdate = true;
                line.computeLineDistances();
            }

            // translate
            this.translatePeripheral.scale.set(width, height, 1);

            // rotate
            const top = new Vector3(0, size.y / 2, 0.1).applyMatrix4(this.object.matrixWorld);
            this.rotatePeripheral.position.copy(top);
            this.rotatePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);

            // scale
            this.scalePeripheral.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);
            this.scalePicker.scale.set(1, 1, 1).multiplyScalar(eyeDistance / 8);
            for (const handle of this.scalePeripheral.children.concat(this.scalePicker.children)) {
                const w = width / (eyeDistance / 8);
                const h = height / (eyeDistance / 8);

                const xDirection = Math.round(Math.cos(handle.tag * (Math.PI / 4)));
                const yDirection = Math.round(Math.sin(handle.tag * (Math.PI / 4)));

                handle.position.set(w / 2 * xDirection, h / 2 * yDirection, 0);
            }
        }

        super.updateMatrixWorld(force);
    }

    updateMouseCursor() {
        switch (this.mode) {
            case 'translate':
                document.body.style.cursor = 'all-scroll';
                break;
            case 'rotate':
                document.body.style.cursor = 'url(images/cursor/rotate_16x16.ico), default';
                break;
            case 'scale': {
                // TODO: Set cursor style on selection/rotation, rather than on mouse movement.
                const anchorRadian = Math.PI * (this.tag / 4);
                const currentAnchorRadian = anchorRadian + this.object.rotation.z;
                const currentAnchorDirection = Math.round(currentAnchorRadian / (Math.PI / 4)) % 8;

                switch (currentAnchorDirection) {
                    case 0:
                        document.body.style.cursor = 'e-resize';
                        break;
                    case 1:
                        document.body.style.cursor = 'ne-resize';
                        break;
                    case 2:
                        document.body.style.cursor = 'n-resize';
                        break;
                    case 3:
                        document.body.style.cursor = 'nw-resize';
                        break;
                    case 4:
                        document.body.style.cursor = 'w-resize';
                        break;
                    case 5:
                        document.body.style.cursor = 'sw-resize';
                        break;
                    case 6:
                        document.body.style.cursor = 's-resize';
                        break;
                    case 7:
                        document.body.style.cursor = 'se-resize';
                        break;
                    default:
                        break;
                }
                break;
            }
            default:
                document.body.style.cursor = 'default';
                break;
        }
    }

    attach(object) {
        this.object = object;
        this.visible = true;
        this.dispatchEvent(EVENTS.UPDATE);
    }

    detach() {
        this.object = null;
        this.visible = false;
        this.dispatchEvent(EVENTS.UPDATE);
    }

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

                this.scaleCenterPoint.set(0, 0, 0).applyMatrix4(this.object.matrixWorld);
                this.scaleMovingPoint.set(size.x / 2 * xDirection, size.y / 2 * yDirection, 0).applyMatrix4(this.object.matrixWorld);
                break;
            }
            default:
                break;
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
                const quaternion = ThreeUtils.getQuaternionBetweenVector3(this.pointEnd, new Vector3(0, 1, 0));
                this.object.quaternion.copy(quaternion);
                break;
            }
            case 'scale': {
                const direction = new Vector3().subVectors(this.scaleMovingPoint, this.scaleCenterPoint).normalize();
                const movement = new Vector3().copy(direction).multiplyScalar(new Vector3().copy(direction).dot(offset));

                const movingPoint = new Vector3().copy(this.scaleMovingPoint).add(movement);

                const l1 = new Vector3().subVectors(this.scaleMovingPoint, this.scaleCenterPoint).length();
                const l2 = new Vector3().subVectors(movingPoint, this.scaleCenterPoint).length();

                this.object.scale.copy(this.scaleStart).multiplyScalar((l2 + l1) / (l1 + l1));
                this.object.position.copy(this.positionStart).add(movement.multiplyScalar(0.5));
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
