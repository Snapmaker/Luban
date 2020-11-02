import fs from 'fs';
import path from 'path';
import Jimp from '../../lib/jimp';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import DataStorage from '../../DataStorage';
import processImage from '../../lib/image-process';
import { LaserToolPathGenerator } from '../../lib/ToolPathGenerator';
import SVGParser from '../../../shared/lib/SVGParser';
import { parseDxf, dxfToSvg, updateDxfBoundingBox } from '../../../shared/lib/DXFParser/Parser';
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
    if (((sourceType === 'svg' || sourceType === 'dxf') && (mode === 'vector' || mode === 'trace' || mode === 'text')) || (sourceType === 'text' && mode === 'vector')) {
        modelPath = `${DataStorage.tmpDir}/${uploadName}`;
    } else {
        if (uploadName.indexOf('svg') > 0) {
            return Promise.reject(new Error('process image need an image uploadName'));
        }
        // processImage: do "scale, rotate, greyscale/bw"
        try {
            const result = await processImage(modelInfo);
            modelPath = `${DataStorage.tmpDir}/${result.filename}`;
        } catch (e) {
            return Promise.reject(new Error(`process Image Error ${e.message}`));
        }
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
    const { sourceType, mode, uploadName, config } = modelInfo;
    // const originFilename = uploadName;
    let modelPath = `${DataStorage.tmpDir}/${uploadName}`;

    if (config.svgNodeName === 'text') {
        const { width, height, flip = 0 } = modelInfo.transformation;

        const { density = 4 } = modelInfo.gcodeConfig || {};
        const img = await Jimp.read(`${DataStorage.tmpDir}/${uploadName}`);

        img
            .greyscale()
            .flip(!!(Math.floor(flip / 2)), !!(flip % 2))
            .resize(width * density, height * density)
            // .rotate(-rotationZ * 180 / Math.PI)
            .background(0xffffffff);

        // Turn transparent to white.
        img.alphaToWhite();

        // text to be engraved, so invert to turn black to white.
        img.invert();

        const result = await new Promise(resolve => {
            const outputFilename = pathWithRandomSuffix(uploadName);
            img.write(`${DataStorage.tmpDir}/${outputFilename}`, () => {
                resolve({
                    filename: outputFilename
                });
            });
        });
        modelPath = `${DataStorage.tmpDir}/${result.filename}`;
    }

    const outputFilename = pathWithRandomSuffix(`${uploadName}.${suffix}`);
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;


    if (((sourceType === 'svg' || sourceType === 'dxf') && (mode === 'vector' || mode === 'trace')) || (sourceType === 'raster' && mode === 'vector')) {
        let toolPath;
        if (sourceType === 'dxf') {
            let { svg } = await parseDxf(modelPath);
            svg = dxfToSvg(svg);
            updateDxfBoundingBox(svg);

            const generator = new CncToolPathGenerator();
            generator.on('progress', (p) => onProgress(p));
            toolPath = await generator.generateToolPathObj(svg, modelInfo);
        } else {
            const svgParser = new SVGParser();
            const svg = await svgParser.parseFile(modelPath);

            const generator = new CncToolPathGenerator();
            generator.on('progress', (p) => onProgress(p));
            toolPath = await generator.generateToolPathObj(svg, modelInfo);
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

    const { headType } = modelInfo;
    if (headType === 'laser') {
        return generateLaserToolPath(modelInfo, onProgress);
    } else if (headType === 'cnc') {
        return generateCncToolPath(modelInfo, onProgress);
    } else {
        return Promise.reject(new Error(`Unsupported type: ${headType}`));
    }
};
