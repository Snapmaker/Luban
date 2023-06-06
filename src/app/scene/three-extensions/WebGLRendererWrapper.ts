import { isUndefined } from 'lodash';
import type { WebGLRendererParameters } from 'three';
import { Color, WebGLRenderer } from 'three';

import log from '../../lib/log';
import Detector from './Detector';

type WebGLRendererOptions = WebGLRendererParameters & {
    clearColor?: Color;
    clearAlpha?: number;
}

/**
 * Simple wrapper of WebGLRenderer.
 *
 * Given basic renderer method mirrors and default configuration.
 */
class WebGLRendererWrapper {
    private renderer: WebGLRenderer;

    public constructor(options: WebGLRendererOptions) {
        if (Detector.isWebGLAvailable()) {
            this.renderer = new WebGLRenderer(options);

            if (options.clearColor) {
                this.renderer.setClearColor(options.clearColor);
            } else {
                this.renderer.setClearColor(new Color(0xF5F5F7), 1);
            }

            if (!isUndefined(options.clearAlpha)) {
                this.setClearAlpha(options.clearAlpha);
            }

            this.renderer.shadowMap.enabled = true;
            this.renderer.localClippingEnabled = true;
        } else {
            this.renderer = null;
        }
    }

    public isInitialized(): boolean {
        return !!this.renderer;
    }

    public get domElement() {
        return this.renderer.domElement;
    }

    public setClearColor(color: Color | string | number, alpha?: number): void {
        this.renderer.setClearColor(color, alpha);
    }

    public setClearAlpha(alpha: number): void {
        this.renderer.setClearAlpha(alpha);
    }

    public setSize(width: number, height: number): void {
        this.renderer && this.renderer.setSize(width, height);
    }

    public setSortObjects(bool) {
        this.renderer.sortObjects = bool;
    }

    public render(scene, camera) {
        this.renderer.render(scene, camera);
    }

    public dispose() {
        if (!this.renderer) {
            return;
        }
        try {
            this.renderer.forceContextLoss();
            this.renderer.domElement = null;
            this.renderer.dispose();
            this.renderer = null;
        } catch (e) {
            log.warn(e);
        }
    }
}

export default WebGLRendererWrapper;
