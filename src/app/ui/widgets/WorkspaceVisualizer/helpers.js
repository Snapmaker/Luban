import noop from 'lodash/noop';
import { TextureLoader } from 'three';

const loadTexture = (url, callback) => {
    callback = callback || noop;

    const onLoad = (texture) => {
        callback(null, texture);
    };
    const onProgress = () => {
    };
    const onError = () => {
        callback(new Error(`Failed to load texture with the url ${JSON.stringify(url)}`));
    };

    const loader = new TextureLoader();
    loader.load(url, onLoad, onProgress, onError);
};

export {
    loadTexture
};
