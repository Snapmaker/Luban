import * as THREE from 'three';

const loadTexture = (url, callback) => {
    callback = callback || ((err, texture) => {});

    const onLoad = (texture) => {
        callback(null, texture);
    };
    const onProgress = (xhr) => {
    };
    const onError = (xhr) => {
        callback(new Error('Failed to load texture with the url ' + JSON.stringify(url)));
    };

    const loader = new THREE.TextureLoader();
    loader.load(url, onLoad, onProgress, onError);
};

export {
    loadTexture
};
