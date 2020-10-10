import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import DataStorage from '../../DataStorage';
import { GcodeGenerator } from '../../lib/GcodeGenerator';
import logger from '../../lib/logger';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import { isNull } from '../../../shared/lib/utils';

const log = logger('service:TaskManager');

const addHeaderToFile = (header, name, tmpFilePath, filePath, thumbnail) => {
    return new Promise((resolve, reject) => {
        const rs = fs.createReadStream(tmpFilePath, 'utf-8');
        const ws = fs.createWriteStream(filePath, 'utf-8');
        rs.on('close', () => {
            fs.unlinkSync(tmpFilePath);
        });
        rs.on('open', () => {
            ws.write(header);
            rs.pipe(ws);
        });
        rs.on('error', (err) => {
            ws.end();
            log.error(err);
            reject(err);
        });
        ws.on('error', (err) => {
            ws.end();
            log.error(err);
            reject(err);
        });
        ws.on('close', () => {
            resolve({
                gcodeFile: {
                    name: name,
                    uploadName: name,
                    size: ws.bytesWritten,
                    lastModifiedDate: new Date().getTime(),
                    thumbnail: thumbnail
                }
            });
        });
    });
};

const checkoutBoundingBoxIsNull = (boundingBox) => {
    if (!boundingBox) {
        return;
    }
    if (isNull(boundingBox.max.x)) {
        boundingBox.max.x = 0;
    }
    if (isNull(boundingBox.min.x)) {
        boundingBox.min.x = 0;
    }
    if (isNull(boundingBox.max.y)) {
        boundingBox.max.y = 0;
    }
    if (isNull(boundingBox.min.y)) {
        boundingBox.min.y = 0;
    }
    if (isNull(boundingBox.max.z)) {
        boundingBox.max.z = 0;
    }
    if (isNull(boundingBox.min.z)) {
        boundingBox.min.z = 0;
    }
    if (isNull(boundingBox.max.b)) {
        boundingBox.max.b = 0;
    }
    if (isNull(boundingBox.min.b)) {
        boundingBox.min.b = 0;
    }
};

export const generateGcode = (modelInfos, onProgress) => {
    if (!modelInfos && !_.isArray(modelInfos) && modelInfos.length === 0) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    const { headType } = modelInfos[0];
    if (!_.includes(['laser', 'cnc'], headType)) {
        return Promise.reject(new Error(`Unsupported type: ${headType}`));
    }

    const suffix = headType === 'laser' ? '.nc' : '.cnc';

    let fileTotalLines = 0;
    let estimatedTime = 0;

    let boundingBox = null;

    const { uploadName } = modelInfos[0];
    const outputFilename = pathWithRandomSuffix(path.parse(uploadName).name) + suffix;
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;
    const outputFilePathTmp = `${outputFilePath}.tmp`;

    const writeStream = fs.createWriteStream(outputFilePathTmp, 'utf-8');

    let isRotate;
    let diameter;
    let isCW;

    for (let i = 0; i < modelInfos.length; i++) {
        const modelInfo = modelInfos[i];
        const { toolPathFilename, gcodeConfig, mode } = modelInfo;
        const toolPathFilePath = `${DataStorage.tmpDir}/${toolPathFilename}`;
        const data = fs.readFileSync(toolPathFilePath, 'utf8');
        const toolPathObj = JSON.parse(data);

        const gcodeGenerator = new GcodeGenerator();
        let gcodeLines;
        if (headType === 'laser') {
            gcodeLines = gcodeGenerator.parseAsLaser(toolPathObj, gcodeConfig);
        } else {
            gcodeLines = gcodeGenerator.parseAsCNC(toolPathObj, gcodeConfig);
        }

        const renderMethod = mode === 'greyscale' && gcodeConfig.movementMode === 'greyscale-dot' ? 'point' : 'line';

        if (i > 0) {
            const header = '\n'
                + ';Header Start\n'
                + `;renderMethod: ${renderMethod}\n`
                + ';Header End'
                + '\n';
            writeStream.write(header);
            fileTotalLines += header.split('\n').length;
        }
        fileTotalLines += gcodeLines.length;

        writeStream.write(gcodeLines.join('\n'));

        estimatedTime += toolPathObj.estimatedTime;
        if (gcodeConfig.multiPassEnabled) {
            estimatedTime *= gcodeConfig.multiPasses;
        }

        isRotate = toolPathObj.isRotate;
        diameter = toolPathObj.diameter;
        isCW = toolPathObj.isCW;

        if (boundingBox === null) {
            boundingBox = toolPathObj.boundingBox;
        } else {
            boundingBox.max.x = Math.max(boundingBox.max.x, toolPathObj.boundingBox.max.x);
            boundingBox.max.y = Math.max(boundingBox.max.y, toolPathObj.boundingBox.max.y);
            boundingBox.min.x = Math.min(boundingBox.min.x, toolPathObj.boundingBox.min.x);
            boundingBox.min.y = Math.min(boundingBox.min.y, toolPathObj.boundingBox.min.y);
        }

        checkoutBoundingBoxIsNull(boundingBox);

        onProgress((i + 1) / modelInfos.length);
    }

    const { gcodeConfig, thumbnail, mode } = modelInfos[0];
    const renderMethod = mode === 'greyscale' && gcodeConfig.movementMode === 'greyscale-dot' ? 'point' : 'line';

    const power = gcodeConfig.fixedPowerEnabled ? gcodeConfig.fixedPower : 0;

    let headerStart = ';Header Start\n'
        + `;header_type: ${headType}\n`
        + `;renderMethod: ${renderMethod}\n`
        + ';file_total_lines: fileTotalLines\n'
        + `;estimated_time(s): ${estimatedTime}\n`
        + `;is_rotate: ${isRotate}\n`
        + `;diameter: ${diameter}\n`
        + `;is_cw: ${isCW}\n`
        + `;max_x(mm): ${boundingBox.max.x}\n`
        + `;max_y(mm): ${boundingBox.max.y}\n`
        + `;max_z(mm): ${boundingBox.max.z}\n`
        + `;max_b(mm): ${boundingBox.max.b}\n`
        + `;min_x(mm): ${boundingBox.min.x}\n`
        + `;min_y(mm): ${boundingBox.min.y}\n`
        + `;min_b(mm): ${boundingBox.min.b}\n`
        + `;work_speed(mm/minute): ${gcodeConfig.workSpeed}\n`
        + `;jog_speed(mm/minute): ${gcodeConfig.jogSpeed}\n`
        + `;power(%): ${power}\n`
        + `;thumbnail: ${thumbnail}\n`
        + ';Header End\n'
        + '\n';

    fileTotalLines += headerStart.split('\n').length - 1;

    headerStart = headerStart.replace(/fileTotalLines/g, fileTotalLines);


    writeStream.end();

    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
        writeStream.on('close', async () => {
            const res = await addHeaderToFile(headerStart, outputFilename, outputFilePathTmp, outputFilePath, thumbnail);
            resolve(res);
        });
        writeStream.on('error', (err) => {
            reject(err);
        });
    });
};
