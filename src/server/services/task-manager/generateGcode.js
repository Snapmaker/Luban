import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import DataStorage from '../../DataStorage';
import { GcodeGenerator } from '../../lib/GcodeGenerator';
import logger from '../../lib/logger';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';

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

export const generateGcode = (modelInfos, onProgress) => {
    if (!modelInfos && !_.isArray(modelInfos) && modelInfos.length === 0) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    const { headerType } = modelInfos[0];
    if (!_.includes(['laser', 'cnc'], headerType)) {
        return Promise.reject(new Error(`Unsupported type: ${headerType}`));
    }

    const suffix = '.nc';

    let fileTotalLines = 0;
    let estimatedTime = 0;

    let boundingBox = null;

    const { uploadName } = modelInfos[0];
    const outputFilename = pathWithRandomSuffix(path.parse(uploadName).name) + suffix;
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;
    const outputFilePathTmp = `${outputFilePath}.tmp`;

    const writeStream = fs.createWriteStream(outputFilePathTmp, 'utf-8');

    for (let i = 0; i < modelInfos.length; i++) {
        const modelInfo = modelInfos[i];
        const { toolPathFilename, gcodeConfig, config, mode } = modelInfo;
        const toolPathFilePath = `${DataStorage.tmpDir}/${toolPathFilename}`;
        const data = fs.readFileSync(toolPathFilePath, 'utf8');
        const toolPathObj = JSON.parse(data);

        const gcodeGenerator = new GcodeGenerator();
        let gcodeLines;
        if (headerType === 'laser') {
            gcodeLines = gcodeGenerator.parseAsLaser(toolPathObj, gcodeConfig);
        } else {
            gcodeLines = gcodeGenerator.parseAsCNC(toolPathObj, gcodeConfig);
        }

        const renderMethod = mode === 'greyscale' && config.movementMode === 'greyscale-dot' ? 'point' : 'line';

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

        if (boundingBox === null) {
            boundingBox = toolPathObj.boundingBox;
        } else {
            boundingBox.max.x = Math.max(boundingBox.max.x, toolPathObj.boundingBox.max.x);
            boundingBox.max.y = Math.max(boundingBox.max.y, toolPathObj.boundingBox.max.y);
            boundingBox.min.x = Math.min(boundingBox.min.x, toolPathObj.boundingBox.min.x);
            boundingBox.min.y = Math.min(boundingBox.min.y, toolPathObj.boundingBox.min.y);
        }

        onProgress((i + 1) / modelInfos.length);
    }

    const { gcodeConfig, thumbnail, config, mode } = modelInfos[0];
    const renderMethod = mode === 'greyscale' && config.movementMode === 'greyscale-dot' ? 'point' : 'line';

    const power = gcodeConfig.fixedPowerEnabled ? gcodeConfig.fixedPower : 0;

    let headerStart = ';Header Start\n'
        + `;header_type: ${headerType}\n`
        + `;thumbnail: ${thumbnail}\n`
        + `;renderMethod: ${renderMethod}\n`
        + ';file_total_lines: fileTotalLines\n'
        + `;estimated_time(s): ${estimatedTime}\n`
        + `;max_x(mm): ${boundingBox.max.x}\n`
        + `;max_y(mm): ${boundingBox.max.y}\n`
        + `;max_z(mm): ${boundingBox.max.z}\n`
        + `;min_x(mm): ${boundingBox.min.x}\n`
        + `;min_y(mm): ${boundingBox.min.y}\n`
        + `;min_z(mm): ${boundingBox.min.z}\n`
        + `;work_speed(mm/minute): ${gcodeConfig.workSpeed}\n`
        + `;jog_speed(mm/minute): ${gcodeConfig.jogSpeed}\n`
        + `;power(%): ${power}\n`
        + ';Header End\n'
        + '\n';
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
