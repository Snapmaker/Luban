import fs from 'fs';
import path from 'path';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import DataStorage from '../../DataStorage';
import processImage from '../../lib/image-process';
import { LaserToolPathGenerator } from '../../lib/ToolPathGenerator';
import SVGParser from '../../lib/SVGParser';
import CncToolPathGenerator from '../../lib/ToolPathGenerator/CncToolPathGenerator';
import CncReliefToolPathGenerator from '../../lib/ToolPathGenerator/CncReliefToolPathGenerator';
import logger from '../../lib/logger';

const log = logger('service:TaskManager');

const generateLaserToolPath = async (modelInfo, onProgress) => {
    const suffix = '.json';
    // const { mode, source } = modelInfo;
    // const originFilename = source.filename;
    const { sourceType, mode, uploadName } = modelInfo;
    const outputFilename = pathWithRandomSuffix(path.parse(uploadName).name) + suffix;
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;

    let modelPath = null;
    // no need to process model
    if ((sourceType === 'svg' && (mode === 'vector' || mode === 'trace')) || (sourceType === 'text' && mode === 'vector')) {
        modelPath = `${DataStorage.tmpDir}/${uploadName}`;
    } else {
        // processImage: do "scale, rotate, greyscale/bw"
        const result = await processImage(modelInfo);
        modelPath = `${DataStorage.tmpDir}/${result.filename}`;
    }

    if (modelPath) {
        const generator = new LaserToolPathGenerator();
        generator.on('progress', (p) => {
            onProgress(p);
        });
        const toolPath = await generator.generateToolPathObj(modelInfo, modelPath);
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
    const outputFilename = pathWithRandomSuffix(`${uploadName}.${suffix}`);
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;

    if ((sourceType === 'svg' && (mode === 'vector' || mode === 'trace')) || (sourceType === 'text' && mode === 'vector')) {
        const svgParser = new SVGParser();
        const svg = await svgParser.parseFile(modelPath);

        const generator = new CncToolPathGenerator();
        generator.on('progress', (p) => onProgress(p));

        const toolPath = await generator.generateToolPathObj(svg, modelInfo);
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
    } else if (sourceType === 'raster' && mode === 'greyscale') {
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

export const generateToolPath = (modelInfo, onProgress) => {
    if (!modelInfo) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    const { headerType } = modelInfo;
    if (headerType === 'laser') {
        return generateLaserToolPath(modelInfo, onProgress);
    } else if (headerType === 'cnc') {
        return generateCncToolPath(modelInfo, onProgress);
    } else {
        return Promise.reject(new Error(`Unsupported type: ${headerType}`));
    }
};
