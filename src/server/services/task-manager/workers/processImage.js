import { editorProcess } from '../../../lib/editor/process';
import global from '../../../lib/global';
import sendMessage from '../utils/sendMessage';

const _processImage = async (modelInfo, onProgress) => {
    return editorProcess(modelInfo, onProgress);
};

const processImage = (modelInfo, tmpDir) => {
    global.tmpDir = tmpDir;
    const onProgress = (num) => {
        sendMessage({ status: 'progress', value: num });
    };


    if (!modelInfo) {
        return sendMessage({ status: 'fail', value: 'modelInfo is empty.' });
    }

    return new Promise((resolve, reject) => {
        _processImage(modelInfo, onProgress).then((ret) => {
            resolve(
                sendMessage({ status: 'complete', value: ret })
            );
        }).catch((e) => {
            reject(
                sendMessage({ status: 'fail', value: e })
            );
        });
    });
};

export default processImage;
