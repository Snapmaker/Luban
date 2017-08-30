import * as THREE from 'three';
import log from '../../lib/log';

const TARGET0 = new THREE.Vector3(0, 0, 0);

// http://stackoverflow.com/questions/14614252/how-to-fit-camera-to-object
// https://github.com/mrdoob/three.js/issues/1454
// https://github.com/mrdoob/three.js/issues/1521
class Viewport {
    camera = null;
    width = 0;
    height = 0;
    state = {};

    constructor(camera, width, height) {
        if (!(camera instanceof THREE.CombinedCamera)) {
            log.error('This camera is not supported:', camera);
            return;
        }
        if (width <= 0 || height <= 0) {
            log.error(`Width (${width}) and height (${height}) cannot be less than or equal to zero.`);
            return;
        }

        this.camera = camera;

        this.width = width;
        this.height = height;

        this.state = {
            ...this.state,
            width: this.width,
            height: this.height,
            target: TARGET0
        };

        this.reset();
    }
    reset() {
        this.set(this.width, this.height, TARGET0);
    }
    update() {
        const { width, height, target } = this.state;
        this.set(width, height, target);
    }
    set(width, height, target = TARGET0) {
        if (!this.camera) {
            return;
        }

        this.state = {
            ...this.state,
            width,
            height,
            target
        };

        const visibleWidth = Math.abs(this.camera.right - this.camera.left);
        const visibleHeight = Math.abs(this.camera.top - this.camera.bottom);

        const zoom = Math.min(visibleWidth / width, visibleHeight / height);
        this.camera.setZoom(zoom);
    }
}

export default Viewport;
