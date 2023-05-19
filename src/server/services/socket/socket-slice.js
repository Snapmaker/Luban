import { noop, throttle } from 'lodash';
import path from 'path';

import logger from '../../lib/logger';
import { parseLubanGcodeHeader } from '../../lib/parseGcodeHeader';
import { generateSupport, simplifyModel, repairModel, checkModel } from '../../slicer/slice';

import { Slicer } from '../../slicer';

const log = logger('socket-slice');


const progressHandle = throttle((socket, topic, progress) => {
    return socket.emit(topic, progress);
}, 200);

/**
 * Handle slicer request.
 *
 * @param socket
 * @param params
 *
 * Example:
 * {
 *     version: 1,
 *     model: ['abc.stl'],
 *     definition: ['abc.def.json'],
 *     support: [],
 *     originalName: 'abc.stl',
 *     boundingBox: {
 *         min: { x, y, z },
 *         max: { x, y, z },
 *     },
 *     thumbnail: 'data:image/png;base64,',
 *     renderGcodeFileName: 'abc_suffix',
 *     layerCount: 0,
 *     material0: 'PLA-White',
 *     material1: null,
 *     printToolHead: 'Snapmaker XYZ Tool Head',
 *     series: 'Snapmaker X',
 * }
 *
 * TODO: Refactor params api structure
 */
const handleSlice = (socket, params) => {
    log.info('Start slicing...');
    const {
        version = 0,
        thumbnail = '',
        originalName = 'model',
        series = 'Unknown',
        material0 = 'Unknown',
        material1 = 'Unknown',
        printingToolhead = 'Unknown',
        boundingBox = null,
        layerCount = 0,
        renderGcodeFileName = 'model',
        metadata = {},
    } = params;

    const slicer = new Slicer();
    slicer.setVersion(version);
    slicer.setModels(params.model);
    slicer.setModelDefinitions(params.definition);
    slicer.setSupportModels(params.support);
    slicer.setMetadata({
        originalName,
        thumbnail,
        series,
        printingToolhead,
        material0,
        material1,
        boundingBox,
        layerCount,
        renderGcodeFileName,
        ...metadata,
    });

    slicer.on('started', () => {
        socket.emit('slice:started');
    });
    slicer.on('progress', (progress) => {
        progressHandle(socket, 'slice:progress', progress);
    });
    slicer.on('completed', (sliceResult) => {
        const { gcodeFilename, gcodeFileLength, printTime, filamentLength, filamentWeight, gcodeFilePath } = { ...sliceResult };

        const gcodeHeader = parseLubanGcodeHeader(gcodeFilePath);
        socket.emit('slice:completed', {
            gcodeFilename,
            gcodeFileLength,
            printTime,
            filamentLength,
            filamentWeight,
            gcodeFilePath,
            renderGcodeFileName: sliceResult.renderGcodeFileName,
            gcodeHeader
        });
    });
    slicer.on('failed', (err) => {
        socket.emit('slice:error', err);
    });

    slicer.startSlice();
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
    handleCheckModel,
};
