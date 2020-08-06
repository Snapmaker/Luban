import fs from 'fs';
import _ from 'lodash';
import * as martinez from 'martinez-polygon-clipping';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import DataStorage from '../../DataStorage';
import SVGParser from '../../../shared/lib/SVGParser';
import { parseDxf, dxfToSvg, updateDxfBoundingBox } from '../../../shared/lib/DXFParser/Parser';
import CncToolPathGenerator from '../../lib/ToolPathGenerator/CncToolPathGenerator';
import CncReliefToolPathGenerator from '../../lib/ToolPathGenerator/CncReliefToolPathGenerator';
import logger from '../../lib/logger';
import { PROCESS_MODE_GREYSCALE, SOURCE_TYPE_IMAGE3D } from '../../constants';
import { editorProcess } from '../../lib/editor/process';

const log = logger('service:TaskManager');

const generateCncViewPath = async (modelInfo, onProgress) => {
    const { sourceType, mode, uploadName, processImageName, config } = modelInfo;
    let modelPath = `${DataStorage.tmpDir}/${uploadName}`;
    if (config.svgNodeName === 'text') {
        const result = await editorProcess(modelInfo);
        modelPath = `${DataStorage.tmpDir}/${result.filename}`;
    }

    if (((sourceType === 'svg' || sourceType === 'dxf') && (mode === 'vector' || mode === 'trace')) || (sourceType === 'raster' && mode === 'vector')) {
        let viewPath;
        if (sourceType === 'dxf') {
            let { svg } = await parseDxf(modelPath);
            svg = dxfToSvg(svg);
            updateDxfBoundingBox(svg);

            const generator = new CncToolPathGenerator(modelInfo);
            generator.on('progress', (p) => onProgress(p));
            viewPath = await generator.generateViewPathObj(svg, modelInfo);
        } else {
            const svgParser = new SVGParser();
            const svg = await svgParser.parseFile(modelPath);

            const generator = new CncToolPathGenerator(modelInfo);
            generator.on('progress', (p) => {
                onProgress(p);
            });
            viewPath = await generator.generateViewPathObj(svg, modelInfo);
        }
        return new Promise((resolve) => {
            resolve(viewPath);
        });
    } else if (sourceType === 'raster' && mode === 'greyscale') {
        const generator = new CncReliefToolPathGenerator(modelInfo, modelPath);
        generator.on('progress', (p) => onProgress(p));

        const viewPath = await generator.generateViewPathObj();

        return new Promise((resolve) => {
            resolve(viewPath);
        });
    } else if (sourceType === SOURCE_TYPE_IMAGE3D && mode === PROCESS_MODE_GREYSCALE) {
        modelPath = `${DataStorage.tmpDir}/${processImageName}`;

        const generator = new CncReliefToolPathGenerator(modelInfo, modelPath);
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
        const box = [[min.x, min.y], [min.x, max.y], [max.x, max.y], [max.x, min.y], [min.x, min.y]];
        rectangle = rectangle === null ? [[box]] : martinez.union(rectangle, [[box]]);
    }
    const boxPoints = [];
    for (const rectangleElement of rectangle) {
        boxPoints.push(rectangleElement[0].map(v => { return { x: v[0], y: v[1] }; }));
    }
    return boxPoints;
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

export const generateViewPath = (modelInfos, onProgress) => {
    if (!modelInfos && !_.isArray(modelInfos) && modelInfos.length === 0) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    const suffix = '.json';
    const { uploadName, materials } = modelInfos[0];
    const outputFilename = pathWithRandomSuffix(`${uploadName}.${suffix}`);
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;

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
                    reject(err);
                } else {
                    resolve({
                        viewPathFile: outputFilename
                    });
                }
            });
        }).catch(e => {
            reject(e);
        });
    });
};
