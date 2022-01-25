import fs from 'fs';
import path from 'path';
import { pathWithRandomSuffix, generateRandomPathName } from '../../../shared/lib/random-utils';
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
            log.error('process image need an image uploadName');
            return null;
        }
        // processImage: do "scale, rotate, greyscale/bw"
        try {
            const result = await editorProcess(modelInfo);
            modelPath = `${DataStorage.tmpDir}/${result.filename}`;
        } catch (e) {
            log.error(`process Image Error ${e.message}`);
            return null;
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
            fs.writeFileSync(outputFilePath, JSON.stringify(toolPath), 'utf8');

            return outputFilename;
        } catch (e) {
            return null;
        }
    }
    return null;
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
        fs.writeFileSync(outputFilePath, JSON.stringify(toolPath), 'utf8');
        return outputFilename;
    } else if (mode === PROCESS_MODE_MESH) {
        const generator = new CncMeshToolPathGenerator(modelInfo);
        generator.on('progress', (p) => onProgress(p));

        const toolPath = await generator.generateToolPathObj();
        fs.writeFileSync(outputFilePath, JSON.stringify(toolPath), 'utf8');
        return outputFilename;
    } else if (mode === PROCESS_MODE_GREYSCALE) {
        const generator = new CncReliefToolPathGenerator(modelInfo, modelPath);
        generator.on('progress', (p) => onProgress(p));

        const toolPath = await generator.generateToolPathObj();
        fs.writeFileSync(outputFilePath, JSON.stringify(toolPath), 'utf8');
        return outputFilename;
    } else {
        return null;
    }
};

const generateLaserToolPathFromEngine = (allTasks, onProgress) => {
    // const allResultPromise = [];
    const toolPathLength = allTasks?.length;
    const allResultPromise = allTasks.map(async (task) => {
        const modelInfos = task.data;
        if (!modelInfos || modelInfos?.length === 1) {
            return Promise.reject(new Error('modelInfo is empty.'));
        }
        const { taskId } = task;
        for (const modelInfo of modelInfos) {
            const { headType, type, sourceType } = modelInfo;
            if ([TOOLPATH_TYPE_VECTOR + SOURCE_TYPE_RASTER].includes(type + sourceType)) {
                const result = await editorProcess(modelInfo);
                modelInfo.uploadName = result.filename;
            }
            if (!(/parsed\.svg$/i.test(modelInfo.uploadName))) {
                const newUploadName = modelInfo.uploadName.replace(/\.svg$/i, 'parsed.svg');
                const uploadPath = `${DataStorage.tmpDir}/${newUploadName}`;
                if (fs.existsSync(uploadPath)) {
                    modelInfo.uploadName = newUploadName;
                }
            }
            const gcodeConfig = modelInfo?.gcodeConfig;
            if (headType === 'laser') {
                gcodeConfig.fillDensity = 1 / gcodeConfig.fillInterval;
                gcodeConfig.stepOver = gcodeConfig.fillInterval;
                if (gcodeConfig?.pathType === 'path') {
                    gcodeConfig.movementMode = 'greyscale-line';
                }
            } else {
                gcodeConfig.fillDensity = 1 / gcodeConfig.stepOver;
                gcodeConfig.tabHeight -= gcodeConfig.targetDepth;
            }
            modelInfo.toolpathFileName = generateRandomPathName('json');
        }

        const sliceParams = {
            headType: modelInfos[0].headType,
            type: modelInfos[0].type,
            data: modelInfos,
            toolPathLength
        };

        return new Promise((resolve, reject) => {
            slice(sliceParams, onProgress, (res) => {
                resolve({
                    taskId,
                    filenames: res.filenames
                });
            }, () => {
                reject(new Error('Slice Error'));
            });
        });
    });
    return Promise.all(allResultPromise);
};

export const generateToolPath = (allTasks, onProgress) => {
    const { headType, useLegacyEngine } = allTasks[0];
    if (!['laser', 'cnc'].includes(headType)) {
        return Promise.reject(new Error(`Unsupported type: ${headType}`));
    }
    if (useLegacyEngine) {
        return new Promise(async (resolve, reject) => {
            const filenames = [];
            for (let i = 0; i < allTasks.length; i++) {
                let res;
                if (headType === 'laser') {
                    res = await generateLaserToolPath(allTasks[i], onProgress);
                } else {
                    allTasks[i].taskAsyncFor = allTasks.taskAsyncFor;
                    res = await generateCncToolPath(allTasks[i], onProgress);
                }
                if (!res) {
                    reject();
                }
                filenames.push(res);
            }
            resolve({
                filenames: filenames
            });
        });
    } else {
        return generateLaserToolPathFromEngine(allTasks, onProgress);
    }
};
