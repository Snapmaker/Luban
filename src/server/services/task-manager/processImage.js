import process from '../../lib/image-process';

const _processImage = async (modelInfo, onProgress) => {
    try {
        return process(modelInfo, onProgress);
    } catch (e) {
        return Promise.reject(new Error('Unknown error.'));
    }
};

export const processImage = (modelInfo, onProgress) => {
    if (!modelInfo) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    return _processImage(modelInfo, onProgress);
};
