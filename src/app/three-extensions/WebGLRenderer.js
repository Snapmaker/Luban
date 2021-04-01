import { Color, WebGLRenderer } from 'three';

import Detector from './Detector';

/**
 * Simple wrapper of WebGLRenderer.
 *
 * Given basic renderer method mirrors and default configuration.
 */
class WebGLRendererWrapper {
    constructor(options) {
        if (Detector.isWebGLAvailable()) {
            this.renderer = new WebGLRenderer(options);
            this.renderer.setClearColor(new Color(0xfafafa), 1);
            this.renderer.shadowMap.enabled = true;
        } else {
            this.renderer = null;
        }
    }

    isInitialized() {
        return !!this.renderer;
    }

    get domElement() {
        return this.renderer.domElement;
    }

    setSize(width, height) {
        this.renderer && this.renderer.setSize(width, height);
    }

    render(scene, camera) {
        this.renderer.render(scene, camera);
    }
}

export default WebGLRendererWrapper;
