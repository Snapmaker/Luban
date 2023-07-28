import fs from 'fs';
import _ from 'lodash';
import { pathWithRandomSuffix } from '../../../../shared/lib/random-utils';
import SVGParser from '../../../../shared/lib/SVGParser';
import { CncToolPathGenerator, CncReliefToolPathGenerator, CncMeshToolPathGenerator } from '../../../lib/ToolPathGenerator';
import logger from '../../../lib/logger';
import { PROCESS_MODE_MESH } from '../../../constants';
import { polyUnion } from '../../../../shared/lib/clipper/cLipper-adapter';
import sendMessage from '../utils/sendMessage';

const log = logger('service:TaskManager');

const generateCncViewPath = async (modelInfo, onProgress) => {
    const { sourceType, mode, uploadName } = modelInfo;
    const modelPath = `${process.env.Tmpdir}/${uploadName}`;

    if (((sourceType === 'svg') && (mode === 'vector' || mode === 'trace')) || (sourceType === 'raster' && mode === 'vector')) {
        const svgParser = new SVGParser();
        const svg = await svgParser.parseFile(modelPath);

        const generator = new CncToolPathGenerator(modelInfo);
        generator.on('progress', (p) => {
            onProgress(p);
        });
        const viewPath = await generator.generateViewPathObj(svg, modelInfo);
        return new Promise((resolve) => {
            resolve(viewPath);
        });
    } else if ((sourceType === 'raster' || sourceType === 'svg') && mode === 'greyscale') {
        const generator = new CncReliefToolPathGenerator(modelInfo, modelPath);
        generator.on('progress', (p) => onProgress(p));

        const viewPath = await generator.generateViewPathObj();

        return new Promise((resolve) => {
            resolve(viewPath);
        });
    } else if (mode === PROCESS_MODE_MESH) {
        const generator = new CncMeshToolPathGenerator(modelInfo);
        generator.on('progress', (p) => onProgress(p));

        const viewPath = await generator.generateViewPathObj();

        return new Promise((resolve) => {
            resolve(viewPath);
        });
    } else {
        return Promise.reject(new Error(`Unexpected params: type = ${sourceType} mode = ${mode}`));
    }
};

const generateBoxPoints = (results) => {
    let rectangle = null;
    for (const result of results) {
        const { min, max } = result.boundingBox;
        const box = [{ x: min.x, y: min.y }, { x: min.x, y: max.y }, { x: max.x, y: max.y }, { x: max.x, y: min.y }, { x: min.x, y: min.y }];
        rectangle = rectangle === null ? [box] : polyUnion(rectangle, [box]);
    }
    return rectangle;
};

const generateBoxPointsByRotate = (results) => {
    const boxTmp = [];
    for (const result of results) {
        const { min, max } = result.boundingBox;
        boxTmp.push({ left: true, v: min.y });
        boxTmp.push({ left: false, v: max.y });
    }
    boxTmp.sort((a, b) => {
        if (a.v > b.v) {
            return 1;
        } else if (a.v === b.v) {
            return 0;
        } else {
            return -1;
        }
    });
    const boxes = [];
    let lc = 0;
    let max = 0;
    let min = 0;
    for (let i = 0; i < boxTmp.length; i++) {
        if (boxTmp[i].left) {
            if (lc === 0) {
                min = boxTmp[i].v;
            }
            lc++;
        } else {
            lc--;
            if (lc === 0) {
                max = boxTmp[i].v;
                boxes.push({ max: max, min: min });
            }
        }
    }
    return boxes;
};

const generateViewPath = (modelInfos) => {
    const onProgress = (num) => {
        sendMessage({ status: 'progress', value: num });
    };

    if (!modelInfos && !_.isArray(modelInfos) && modelInfos.length === 0) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    const suffix = '.json';
    const { uploadName, materials } = modelInfos[0];
    const outputFilename = pathWithRandomSuffix(`${uploadName}.${suffix}`);
    const outputFilePath = `${process.env.Tmpdir}/${outputFilename}`;

    const reps = [];

    let targetDepth = 0;
    for (let i = 0; i < modelInfos.length; i++) {
        const modelInfo = modelInfos[i];
        targetDepth = Math.max(targetDepth, modelInfo.gcodeConfig.targetDepth);
        reps.push(generateCncViewPath(modelInfo, (p) => {
            onProgress(p * (i + 1) / modelInfos.length);
        }));
    }
    onProgress(1);
    targetDepth += 5;
    return new Promise((resolve, reject) => {
        Promise.all(reps).then(results => {
            const holes = materials.isRotate ? generateBoxPointsByRotate(results) : generateBoxPoints(results);

            const viewPath = {
                holes: holes,
                targetDepth,
                data: results,
                isRotate: materials.isRotate,
                diameter: materials.diameter

            };

            fs.writeFile(outputFilePath, JSON.stringify(viewPath), 'utf8', (err) => {
                if (err) {
                    log.error(err);
                    reject(
                        sendMessage({ status: 'fail', value: err })
                    );
                } else {
                    resolve(
                        sendMessage({
                            status: 'complete',
                            value: {
                                viewPathFile: outputFilename
                            }
                        })
                    );
                }
            });
        }).catch(e => {
            reject(
                sendMessage({ status: 'fail', value: e })
            );
        });
    });
};

export default generateViewPath;
