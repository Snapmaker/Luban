export default class Detector {
    private static __isWebGLAvailable = undefined;

    // Method inspired by https://github.com/mrdoob/three.js/blob/dev/examples/js/WebGL.js
    // Note that this does not ensure that WebGL context can be created by WebGLRenderer.
    // From initialization of WebGLRenderer (src/renderers/WebGLRenderer.js), we know
    // context attributes should be considered too.
    // Here we only do a simple check to reflect when WebGL context completely can NOT be created.
    public static checkWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            const context = window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
            return !!context;
        } catch (e) {
            return false;
        }
    }

    public static isWebGLAvailable() {
        if (this.__isWebGLAvailable === undefined) {
            this.__isWebGLAvailable = this.checkWebGLAvailable();
        }

        return this.__isWebGLAvailable;
    }
}
