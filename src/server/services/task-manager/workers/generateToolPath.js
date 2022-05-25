import fs from 'fs';
import { generateRandomPathName } from '../../../../shared/lib/random-utils';
import { editorProcess } from '../../../lib/editor/process';
import { SOURCE_TYPE_RASTER, TOOLPATH_TYPE_VECTOR } from '../../../constants';
import slice from '../../../slicer/call-engine';
import sendMessage from '../utils/sendMessage';

const generateLaserToolPathFromEngine = (allTasks, onProgress) => {
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
                const result = await editorProcess(modelInfo);
                modelInfo.uploadName = result.filename;
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

const generateToolPath = allTasks => {
    const { headType } = allTasks[0];
    if (!['laser', 'cnc'].includes(headType)) {
        return sendMessage({ status: 'fail', value: `Unsupported type: ${headType}` });
    }

    const onProgress = num => {
        sendMessage({ status: 'progress', value: num });
    };

    return new Promise((resolve, reject) => {
        generateLaserToolPathFromEngine(allTasks, onProgress)
            .then(ret => {
                resolve(sendMessage({ status: 'complete', value: ret }));
            })
            .catch(err => {
                reject(sendMessage({ status: 'fail', value: err }));
            });
    });
};

export default generateToolPath;
