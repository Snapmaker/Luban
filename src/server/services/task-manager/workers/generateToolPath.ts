import fs from 'fs';
import { throttle } from 'lodash';

import { generateRandomPathName } from '../../../../shared/lib/random-utils';
import { SOURCE_TYPE_RASTER, TOOLPATH_TYPE_VECTOR } from '../../../constants';
import slice from '../../../slicer/call-engine';
import logger from '../../../lib/logger';
import sendMessage from '../utils/sendMessage';

const log = logger('worker:generateToolPath');

const generateLaserToolPathFromEngine = async (allTasks, onProgress) => {
    // const allResultPromise = [];
    const toolPathLength = allTasks?.length;
    const allResultPromise = allTasks.map(async task => {
        const modelInfos = task.data;
        if (!modelInfos || modelInfos?.length === 0) {
            return Promise.reject(new Error('modelInfo is empty.'));
        }
        const { taskId } = task;
        for (const modelInfo of modelInfos) {
            const { headType, type, sourceType } = modelInfo;
            if ([TOOLPATH_TYPE_VECTOR + SOURCE_TYPE_RASTER].includes(type + sourceType)) {
                modelInfo.uploadName = modelInfo.processImageName;
            }
            if (!/parsed\.svg$/i.test(modelInfo.uploadName)) {
                const newUploadName = modelInfo.uploadName.replace(/\.svg$/i, 'parsed.svg');
                const uploadPath = `${process.env.Tmpdir}/${newUploadName}`;
                if (fs.existsSync(uploadPath)) {
                    modelInfo.uploadName = newUploadName;
                }
            }
            const gcodeConfig = modelInfo?.gcodeConfig;
            if (headType === 'laser') {
                gcodeConfig.fillDensity = 1 / gcodeConfig.fillInterval;
                gcodeConfig.stepOver = gcodeConfig.fillInterval;
                if (gcodeConfig?.pathType === 'path') {
                    gcodeConfig.movementMode = 'greyscale-line';
                }
            } else {
                gcodeConfig.fillDensity = 1 / gcodeConfig.stepOver;
                gcodeConfig.tabHeight -= gcodeConfig.targetDepth;
            }
            modelInfo.toolpathFileName = generateRandomPathName('json');
            modelInfo.identifier = task.identifier;

            // FIXME: Hardcoded for ray
            modelInfo.laserPointOnMode = task.identifier === 'Ray' ? 'inline_mode' : 'switch_mode';
        }

        const sliceParams = {
            headType: modelInfos[0].headType,
            type: modelInfos[0].type,
            data: modelInfos,
            toolPathLength
        };

        return new Promise((resolve, reject) => {
            slice(
                sliceParams,
                onProgress,
                res => {
                    resolve({
                        taskId,
                        filenames: res.filenames
                    });
                },
                () => {
                    reject(new Error('Slice Error'));
                }
            );
        });
    });
    return Promise.all(allResultPromise);
};

const generateToolPath = async (allTasks) => {
    const { headType } = allTasks[0];
    if (!['laser', 'cnc'].includes(headType)) {
        return sendMessage({ status: 'fail', value: `Unsupported type: ${headType}` });
    }

    // Fix: Too frequent communication leads to socket reconnection
    const onProgress = throttle(num => {
        allTasks.length === 1 && sendMessage({ status: 'progress', value: num });

        log.info(`Generating toolpath... progress: ${num}`);
    }, 300);

    try {
        const ret = await generateLaserToolPathFromEngine(allTasks, onProgress);

        // Let onProgress throttle finish
        await new Promise((resolve) => setTimeout(resolve, 500));

        sendMessage({ status: 'complete', value: ret });

        return true;
    } catch (err) {
        return sendMessage({ status: 'fail', value: err });
    }
};

export default generateToolPath;
