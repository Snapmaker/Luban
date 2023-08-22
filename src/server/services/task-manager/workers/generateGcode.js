import fs from 'fs';
import _ from 'lodash';
import path from 'path';

import { pathWithRandomSuffix } from '../../../../shared/lib/random-utils';
import { isNull } from '../../../../shared/lib/utils';
import { GcodeGenerator } from '../../../lib/GcodeGenerator';
import logger from '../../../lib/logger';
import sendMessage from '../utils/sendMessage';
import { JobOffsetMode } from '../../../../app/constants/coordinate';


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
                    boundingBox: boundingBox,
                    name: name,
                    uploadName: name,
                    size: ws.bytesWritten,
                    lastModified: +new Date(),
                    estimatedTime,
                    thumbnail: thumbnail,
                },
                filePath
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

// eslint-disable-next-line consistent-return
const generateGcode = ({ toolPaths, size, toolHead, origin, jobOffsetMode, series, metadata }) => {
    if (!toolPaths && !_.isArray(toolPaths) && toolPaths.length === 0) {
        return sendMessage({ status: 'fail', value: 'modelInfo is empty.' });
    }
    sendMessage({ status: 'progress', value: 0.05 });

    const { headType } = toolPaths[0];
    if (!_.includes(['laser', 'cnc'], headType)) {
        return sendMessage({ status: 'fail', value: `Unsupported type: ${headType}` });
    }

    const suffix = headType === 'laser' ? '.nc' : '.cnc';

    let fileTotalLines = 0;
    let estimatedTime = 0;

    let boundingBox = null;

    const { baseName } = toolPaths[0];
    const outputFilename = pathWithRandomSuffix(path.parse(baseName).name + suffix);
    const outputFilePath = `${process.env.Tmpdir}/${outputFilename}`;
    const outputFilePathTmp = `${outputFilePath}.tmp`;

    const writeStream = fs.createWriteStream(outputFilePathTmp, 'utf-8');

    let isRotate;
    let diameter;

    for (let i = 0; i < toolPaths.length; i++) {
        const toolPath = toolPaths[i];
        const { toolPathFiles, gcodeConfig } = toolPath;

        for (let j = 0; j < toolPathFiles.length; j++) {
            const toolPathFilePath = `${process.env.Tmpdir}/${toolPathFiles[j]}`;
            const data = fs.readFileSync(toolPathFilePath, 'utf8');
            const toolPathObj = JSON.parse(data);

            const gcodeGenerator = new GcodeGenerator();
            let gcodeLines;
            if (headType === 'laser') {
                if (metadata?.gcodeFlavor === 'grbl') {
                    gcodeLines = gcodeGenerator.parseAsGrblLaser(toolPathObj, gcodeConfig);
                } else {
                    gcodeLines = gcodeGenerator.parseAsLaser(toolPathObj, gcodeConfig);
                }
            } else {
                gcodeLines = gcodeGenerator.parseAsCNC(toolPathObj, gcodeConfig);
            }

            const renderMethod = gcodeConfig.movementMode === 'greyscale-dot' ? 'point' : 'line';
            const maxPowerNumber = metadata?.gcodeFlavor === 'grbl' ? 1000 : 255;
            const maxPower = (gcodeConfig.fixedPowerEnabled ? gcodeConfig.fixedPower : 100) / 100 * maxPowerNumber;

            if (i > 0 || j > 0) {
                const header = '\n\n'
                    + ';Header Start\n'
                    + `;renderMethod: ${renderMethod}\n`
                    + `;max_power: ${maxPower}\n`
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

        sendMessage({ status: 'progress', value: (i + 1) / toolPathFiles.length });
    }

    const { gcodeConfig, thumbnail } = toolPaths[0];
    const renderMethod = gcodeConfig.movementMode === 'greyscale-dot' ? 'point' : 'line';
    const maxPowerNumber = metadata?.gcodeFlavor === 'grbl' ? 1000 : 255;
    const maxPower = (gcodeConfig.fixedPowerEnabled ? gcodeConfig.fixedPower : 100) / 100 * maxPowerNumber;

    const power = gcodeConfig.fixedPowerEnabled ? gcodeConfig.fixedPower : 0;

    const hasThumbnail = series !== 'Ray';

    const headerGcodes = [];
    let headerStart = ';Header Start\n'
        + `;header_type: ${headType}\n`
        + `;tool_head: ${toolHead}\n`
        + `;machine: ${series}\n`
        + `;gcode_flavor: ${metadata?.gcodeFlavor ? metadata?.gcodeFlavor : 'marlin'}\n`
        + `;renderMethod: ${renderMethod}\n`
        + `;max_power: ${maxPower}\n`
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
        + `;work_size_x: ${size.x}\n`
        + `;work_size_y: ${size.y}\n`
        + `;origin: ${origin}\n`;

    // thumbnail
    if (hasThumbnail) {
        headerGcodes.push(
            `;thumbnail: ${thumbnail}`,
        );
    }

    if (headType === 'laser' && jobOffsetMode === JobOffsetMode.Crosshair) {
        headerGcodes.push(
            'M2003', // crosshair offset
            'M2004', // move
        );
    }

    // header end
    headerGcodes.push(
        ';Header End',
        '',
    );

    // add header codes
    headerStart += headerGcodes.join('\n');

    fileTotalLines += headerStart.split('\n').length - 1;

    headerStart = headerStart.replace(/fileTotalLines/g, fileTotalLines);

    writeStream.end();

    return new Promise((resolve, reject) => {
        writeStream.on('close', async () => {
            addHeaderToFile(headerStart, outputFilename, outputFilePathTmp, outputFilePath, thumbnail, estimatedTime, boundingBox).then((res) => {
                resolve(
                    sendMessage({ status: 'complete', value: res })
                );
            });
        });
        writeStream.on('error', (err) => {
            reject(
                sendMessage({ status: 'fail', value: err })
            );
        });
    });
};

export default generateGcode;
