import fs from 'fs';
import path from 'path';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import DataStorage from '../../DataStorage';
import { editorProcess } from '../../lib/editor/process';
import { LaserToolPathGenerator } from '../../lib/ToolPathGenerator';
import SVGParser from '../../../shared/lib/SVGParser';
import CncToolPathGenerator from '../../lib/ToolPathGenerator/CncToolPathGenerator';
import CncReliefToolPathGenerator from '../../lib/ToolPathGenerator/CncReliefToolPathGenerator';
import logger from '../../lib/logger';
import {
    PROCESS_MODE_GREYSCALE, PROCESS_MODE_MESH,
    PROCESS_MODE_VECTOR, SOURCE_TYPE_RASTER,
    SOURCE_TYPE_SVG, TOOLPATH_TYPE_VECTOR
} from '../../constants';
import CncMeshToolPathGenerator from '../../lib/ToolPathGenerator/MeshToolPath/CncMeshToolPathGenerator';
import slice from '../../slicer/call-engine';

const log = logger('service:TaskManager');

const generateLaserToolPath = async (modelInfo, onProgress) => {
    const suffix = '.json';
    // const { mode, source } = modelInfo;
    // const originFilename = source.filename;
    const { sourceType, mode, uploadName } = modelInfo;
    const outputFilename = pathWithRandomSuffix(path.parse(uploadName).name + suffix);
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;

    let modelPath = null;
    // no need to process model
    if (((sourceType === SOURCE_TYPE_SVG)
        && (mode === PROCESS_MODE_VECTOR))) {
        modelPath = `${DataStorage.tmpDir}/${uploadName}`;
    } else {
        if (uploadName.indexOf('svg') > 0) {
            return Promise.reject(new Error('process image need an image uploadName'));
        }
        // processImage: do "scale, rotate, greyscale/bw"
        try {
            const result = await editorProcess(modelInfo);
            modelPath = `${DataStorage.tmpDir}/${result.filename}`;
        } catch (e) {
            return Promise.reject(new Error(`process Image Error ${e.message}`));
        }
    }

    if (modelPath) {
        const generator = new LaserToolPathGenerator(modelInfo);
        generator.on('progress', (p) => {
            onProgress(p);
        });

        let toolPath;
        try {
            toolPath = await generator.generateToolPathObj(modelInfo, modelPath);
        } catch (e) {
            console.log(e);
        }

        return new Promise((resolve, reject) => {
            fs.writeFile(outputFilePath, JSON.stringify(toolPath), 'utf8', (err) => {
                if (err) {
                    log.error(err);
                    reject(err);
                } else {
                    resolve({
                        filename: outputFilename
                    });
                }
            });
        });
    }

    return Promise.reject(new Error('No model found.'));
};

const generateCncToolPath = async (modelInfo, onProgress) => {
    const suffix = '.json';
    // const { mode, source } = modelInfo;
    // const originFilename = source.filename;
    const { sourceType, mode, uploadName } = modelInfo;
    // const originFilename = uploadName;
    const modelPath = `${DataStorage.tmpDir}/${uploadName}`;

    // const originFilename = uploadName;
    const outputFilename = pathWithRandomSuffix(`${uploadName}.${suffix}`);
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;

    if (((sourceType === 'svg') && (mode === 'vector' || mode === 'trace')) || (sourceType === 'raster' && mode === 'vector')) {
        const svgParser = new SVGParser();
        const svg = await svgParser.parseFile(modelPath);

        const generator = new CncToolPathGenerator(modelInfo);
        generator.on('progress', (p) => onProgress(p));
        const toolPath = await generator.generateToolPathObj(svg, modelInfo);
        // }
        return new Promise((resolve, reject) => {
            fs.writeFile(outputFilePath, JSON.stringify(toolPath), 'utf8', (err) => {
                if (err) {
                    log.error(err);
                    reject(err);
                } else {
                    resolve({
                        filename: outputFilename
                    });
                }
            });
        });
    } else if (mode === PROCESS_MODE_MESH) {
        const generator = new CncMeshToolPathGenerator(modelInfo);
        generator.on('progress', (p) => onProgress(p));

        const toolPath = await generator.generateToolPathObj();

        return new Promise((resolve, reject) => {
            fs.writeFile(outputFilePath, JSON.stringify(toolPath), 'utf8', (err) => {
                if (err) {
                    log.error(err);
                    reject(err);
                } else {
                    resolve({
                        filename: outputFilename
                    });
                }
            });
        });
    } else if (mode === PROCESS_MODE_GREYSCALE) {
        const generator = new CncReliefToolPathGenerator(modelInfo, modelPath);
        generator.on('progress', (p) => onProgress(p));

        const toolPath = await generator.generateToolPathObj();

        return new Promise((resolve, reject) => {
            fs.writeFile(outputFilePath, JSON.stringify(toolPath), 'utf8', (err) => {
                if (err) {
                    log.error(err);
                    reject(err);
                } else {
                    resolve({
                        filename: outputFilename
                    });
                }
            });
        });
    } else {
        return Promise.reject(new Error(`Unexpected params: type = ${sourceType} mode = ${mode}`));
    }
};

const generateLaserToolPathFromEngine = async (modelInfo, onProgress) => {
    const { type, sourceType } = modelInfo;
    if ([TOOLPATH_TYPE_VECTOR + SOURCE_TYPE_RASTER].includes(type + sourceType)) {
        const result = await editorProcess(modelInfo);
        modelInfo.uploadName = result.filename;
    }

    modelInfo.gcodeConfig.stepOver = 1 / modelInfo.gcodeConfig.density;

    modelInfo.toolpathFileName = pathWithRandomSuffix(`${path.parse(modelInfo.uploadName).name}.json`);

    const sliceParams = {
        headType: modelInfo.headType,
        type: modelInfo.type,
        data: [modelInfo]
    };

    return new Promise((resolve, reject) => {
        slice(sliceParams, onProgress, (res) => {
            resolve({
                filename: res.filename
            });
        }, () => {
            reject(new Error('Slice Error'));
        });
    });
};

export const generateToolPath = (modelInfo, onProgress) => {
    if (!modelInfo) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    console.log('modelInfo', JSON.stringify(modelInfo));

    const { headType, useEngine } = modelInfo;
    if (useEngine) {
        return generateLaserToolPathFromEngine(modelInfo, onProgress);
    } else {
        if (headType === 'laser') {
            return generateLaserToolPath(modelInfo, onProgress);
        } else if (headType === 'cnc') {
            return generateCncToolPath(modelInfo, onProgress);
        } else {
            return Promise.reject(new Error(`Unsupported type: ${headType}`));
        }
    }
};
