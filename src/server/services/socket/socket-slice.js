import { noop, throttle } from 'lodash';
import path from 'path';
import { parseLubanGcodeHeader } from '../../lib/parseGcodeHeader';
import slice, { generateSupport, simplifyModel, repairModel, checkModel } from '../../slicer/slice';

const progressHandle = throttle((socket, topic, progress) => {
    return socket.emit(topic, progress);
}, 300);

const handleSlice = (socket, params) => {
    socket.emit('slice:started');
    slice(
        params,
        (progress) => {
            progressHandle(socket, 'slice:progress', progress);
        },
        (sliceResult) => {
            const { gcodeFilename, gcodeFileLength, printTime, filamentLength, filamentWeight, gcodeFilePath, renderGcodeFileName } = { ...sliceResult };

            const gcodeHeader = parseLubanGcodeHeader(gcodeFilePath);
            socket.emit('slice:completed', {
                gcodeFilename,
                gcodeFileLength,
                printTime,
                filamentLength,
                filamentWeight,
                gcodeFilePath,
                renderGcodeFileName,
                gcodeHeader
            });
        },
        (err) => {
            socket.emit('slice:error', err);
        }
    );
};

const repairSupport = (files, size) => {
    const promises = files.map((file) => {
        return new Promise((resolve, reject) => {
            const uploadName = file.supportStlFilename;
            const extname = path.extname(uploadName);
            const outputName = uploadName.slice(
                0,
                uploadName.indexOf(extname)
            );

            repairModel({
                complete: resolve,
                next: noop,
                error: reject
            }, {
                uploadName,
                modelID: file.modelID,
                size,
                outputName
            });
        });
    });
    return Promise.allSettled(promises);
};

const handleGenerateSupport = (socket, params) => {
    socket.emit('generate-support:started');
    generateSupport(
        params,
        (progress) => {
            progressHandle(socket, 'generate-support:progress', progress);
        },
        async (result) => {
            await repairSupport(result.files, params.size);

            socket.emit('generate-support:completed', {
                supportFilePaths: result.files
            });
        },
        (err) => {
            socket.emit('generate-support:error', err);
        }
    );
};

const handleSimplifyModel = (socket, params) => {
    socket.emit('simplify-model:started', {
        firstTime: params.isFirstTime,
        uploadName: params.uploadName,
        transformation: params.transformation,
        originModel: params.originModel
    });
    simplifyModel(
        params,
        (progress) => {
            progressHandle(socket, 'simplify-model:progress', progress);
        },
        (simplifyConfig) => {
            socket.emit('simplify-model:completed', simplifyConfig);
        },
        (err) => {
            socket.emit('simplify-model:error', err);
        }
    );
};

const handleRepairModel = (actions, params) => {
    actions.next({
        type: 'started',
        uploadName: params.uploadName,
        fileType: params.fileType,
        modelID: params.modelID
    });
    repairModel(actions, params);
};

const handleCheckModel = (actions, params) => {
    actions.next({
        type: 'started',
        uploadName: params.uploadName,
        fileType: params.fileType,
        modelID: params.modelID
    });
    checkModel(actions, params);
};

export default {
    handleSlice,
    handleGenerateSupport,
    handleSimplifyModel,
    handleRepairModel,
    handleCheckModel
};
