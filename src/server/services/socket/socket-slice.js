import { parseLubanGcodeHeader } from '../../lib/parseGcodeHeader';
import slice, { generateSupport, simplifyModel, repairModel } from '../../slicer/slice';

const handleSlice = (socket, params) => {
    socket.emit('slice:started');
    slice(
        params,
        (progress) => {
            socket.emit('slice:progress', progress);
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

const handleGenerateSupport = (socket, params) => {
    socket.emit('generate-support:started');
    generateSupport(
        params,
        (progress) => {
            socket.emit('generate-support:progress', progress);
        },
        (result) => {
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
        modelName: params.modelName,
        fileType: params.fileType,
        transformation: params.transformation,
        originModel: params.originModel
    });
    simplifyModel(
        params,
        (progress) => {
            socket.emit('simplify-model:progress', progress);
        },
        (simplifyConfig) => {
            socket.emit('simplify-model:completed', simplifyConfig);
        },
        (err) => {
            socket.emit('simplify-model:error', err);
        }
    );
};

const handleRepairModel = (subscriber, params) => {
    subscriber.next({
        type: 'started',
        uploadName: params.uploadName,
        fileType: params.fileType,
        modelID: params.modelID
    });
    repairModel(
        params,
        (progress) => {
            subscriber.next({
                type: 'progress',
                progress
            });
        },
        (res) => {
            subscriber.complete({
                type: 'completed',
                ...res
            });
        },
        (err) => {
            subscriber.next({
                type: 'error',
                err
            });
        }
    );
};


export default {
    handleSlice,
    handleGenerateSupport,
    handleSimplifyModel,
    handleRepairModel
};
