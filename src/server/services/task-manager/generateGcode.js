import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import DataStorage from '../../DataStorage';
import { GcodeGenerator } from '../../lib/GcodeGenerator';
import logger from '../../lib/logger';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import { isNull } from '../../../shared/lib/utils';

const log = logger('service:TaskManager');

const addHeaderToFile = (header, name, tmpFilePath, filePath, thumbnail, estimatedTime, boundingBox) => {
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
                    maxX: boundingBox.max.x,
                    maxY: boundingBox.max.y,
                    minX: boundingBox.min.x,
                    minY: boundingBox.min.y,
                    name: name,
                    uploadName: name,
                    size: ws.bytesWritten,
                    lastModified: +new Date(),
                    estimatedTime,
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

export const generateGcode = (toolPaths, onProgress) => {
    if (!toolPaths && !_.isArray(toolPaths) && toolPaths.length === 0) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }
    onProgress(0.05);

    const { headType } = toolPaths[0];
    if (!_.includes(['laser', 'cnc'], headType)) {
        return Promise.reject(new Error(`Unsupported type: ${headType}`));
    }

    const suffix = headType === 'laser' ? '.nc' : '.cnc';

    let fileTotalLines = 0;
    let estimatedTime = 0;

    let boundingBox = null;

    const { baseName } = toolPaths[0];
    const outputFilename = pathWithRandomSuffix(path.parse(baseName).name + suffix);
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;
    const outputFilePathTmp = `${outputFilePath}.tmp`;

    const writeStream = fs.createWriteStream(outputFilePathTmp, 'utf-8');

    let isRotate;
    let diameter;

    for (let i = 0; i < toolPaths.length; i++) {
        const toolPath = toolPaths[i];
        const { toolPathFiles, gcodeConfig } = toolPath;

        for (let j = 0; j < toolPathFiles.length; j++) {
            const toolPathFilePath = `${DataStorage.tmpDir}/${toolPathFiles[j]}`;
            const data = fs.readFileSync(toolPathFilePath, 'utf8');
            const toolPathObj = JSON.parse(data);

            const gcodeGenerator = new GcodeGenerator();
            let gcodeLines;
            if (headType === 'laser') {
                gcodeLines = gcodeGenerator.parseAsLaser(toolPathObj, gcodeConfig);
            } else {
                gcodeLines = gcodeGenerator.parseAsCNC(toolPathObj, gcodeConfig);
            }

            const renderMethod = gcodeConfig.movementMode === 'greyscale-dot' ? 'point' : 'line';

            if (i > 0 || j > 0) {
                const header = '\n\n'
                    + ';Header Start\n'
                    + `;renderMethod: ${renderMethod}\n`
                    + ';Header End\n'
                    + '\n';
                writeStream.write(header);
                fileTotalLines += header.split('\n').length - 2;
            }

            fileTotalLines += gcodeLines.length;

            writeStream.write(gcodeLines.join('\n'));

            if (gcodeConfig.multiPassEnabled) {
                estimatedTime += toolPathObj.estimatedTime * gcodeConfig.multiPasses;
            } else {
                estimatedTime += toolPathObj.estimatedTime;
            }

            isRotate = toolPathObj.isRotate;
            diameter = toolPathObj.diameter;

            const { positionX = 0, positionY = 0, rotationB = 0 } = toolPathObj;
            toolPathObj.boundingBox.max.x += positionX;
            toolPathObj.boundingBox.min.x += positionX;
            toolPathObj.boundingBox.max.y += positionY;
            toolPathObj.boundingBox.min.y += positionY;
            toolPathObj.boundingBox.max.b += rotationB;
            toolPathObj.boundingBox.min.b += rotationB;

            if (boundingBox === null) {
                boundingBox = toolPathObj.boundingBox;
            } else {
                boundingBox.max.x = Math.max(boundingBox.max.x, toolPathObj.boundingBox.max.x);
                boundingBox.max.y = Math.max(boundingBox.max.y, toolPathObj.boundingBox.max.y);
                boundingBox.max.z = Math.max(boundingBox.max.z, toolPathObj.boundingBox.max.z);
                boundingBox.max.b = Math.max(boundingBox.max.b, toolPathObj.boundingBox.max.b);

                boundingBox.min.x = Math.min(boundingBox.min.x, toolPathObj.boundingBox.min.x);
                boundingBox.min.y = Math.min(boundingBox.min.y, toolPathObj.boundingBox.min.y);
                boundingBox.min.z = Math.min(boundingBox.min.z, toolPathObj.boundingBox.min.z);
                boundingBox.min.b = Math.min(boundingBox.min.b, toolPathObj.boundingBox.min.b);
            }

            checkoutBoundingBoxIsNull(boundingBox);
        }

        onProgress((i + 1) / toolPathFiles.length);
    }

    const { gcodeConfig, thumbnail } = toolPaths[0];
    const renderMethod = gcodeConfig.movementMode === 'greyscale-dot' ? 'point' : 'line';

    const power = gcodeConfig.fixedPowerEnabled ? gcodeConfig.fixedPower : 0;

    let headerStart = ';Header Start\n'
        + `;header_type: ${headType}\n`
        + `;renderMethod: ${renderMethod}\n`
        + ';file_total_lines: fileTotalLines\n'
        + `;estimated_time(s): ${estimatedTime}\n`
        + `;is_rotate: ${isRotate}\n`
        + `;diameter: ${diameter}\n`
        + `;max_x(mm): ${boundingBox.max.x}\n`
        + `;max_y(mm): ${boundingBox.max.y}\n`
        + `;max_z(mm): ${boundingBox.max.z}\n`
        + `;max_b(mm): ${boundingBox.max.b}\n`
        + `;min_x(mm): ${boundingBox.min.x}\n`
        + `;min_y(mm): ${boundingBox.min.y}\n`
        + `;min_b(mm): ${boundingBox.min.b}\n`
        + `;min_z(mm): ${boundingBox.min.z}\n`
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
            const res = await addHeaderToFile(headerStart, outputFilename, outputFilePathTmp, outputFilePath, thumbnail, estimatedTime, boundingBox);
            resolve(res);
        });
        writeStream.on('error', (err) => {
            reject(err);
        });
    });
};
