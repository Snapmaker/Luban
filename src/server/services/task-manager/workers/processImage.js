import { processMode } from '../../../lib/ProcessMode';
import sendMessage from '../utils/sendMessage';

const processImage = async (modelInfo) => {
    const onProgress = (num) => {
        sendMessage({ status: 'progress', value: num });
    };


    if (!modelInfo) {
        return sendMessage({ status: 'fail', value: 'modelInfo is empty.' });
    }

    return new Promise((resolve, reject) => {
        processMode(modelInfo, onProgress).then((ret) => {
            sendMessage({ status: 'complete', value: ret });
            resolve();
        }).catch((e) => {
            sendMessage({ status: 'fail', value: e });
            reject();
        });
    });
};

export default processImage;
