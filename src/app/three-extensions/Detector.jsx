import React from 'react';

class Detector {
    static __isWebGLAvailable = undefined;

    // Method inspired by https://github.com/mrdoob/three.js/blob/dev/examples/js/WebGL.js
    // Note that this does not ensure that WebGL context can be created by WebGLRenderer.
    // From initialization of WebGLRenderer (src/renderers/WebGLRenderer.js), we know
    // context attributes should be considered too.
    // Here we only do a simple check to reflect when WebGL context completely can NOT be created.
    static checkWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            const context = window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
            return !!context;
        } catch (e) {
            return false;
        }
    }

    static isWebGLAvailable() {
        if (this.__isWebGLAvailable === undefined) {
            this.__isWebGLAvailable = this.checkWebGLAvailable();
        }

        return this.__isWebGLAvailable;
    }

    // from examples/js/Detector.js
    static getWebGLErrorMessage() {
        return (
            <div
                style={{
                    background: 'fff',
                    textAlign: 'center',
                    width: '400px',
                    margin: '10em auto 5em',
                    padding: '1.5em'
                }}
            >
                Your graphics card does not seem to support <b>WebGL</b>.
                <br />
                Find out how to get it <a href="http://get.webgl.org/" style={{ color: '#28a7e1' }}>here</a>.
            </div>
        );
    }
}

export default Detector;
