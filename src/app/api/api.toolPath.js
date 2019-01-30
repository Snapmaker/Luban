import fs from 'fs';
import {
    APP_CACHE_IMAGE, ERR_INTERNAL_SERVER_ERROR
} from '../constants';
import logger from '../lib/logger';
import { pathWithRandomSuffix } from '../lib/random-utils';
import SVGParser from '../lib/SVGParser';
import {
    CncToolPathGenerator, LaserToolPathGenerator, CncReliefToolPathGenerator
} from '../lib/ToolPathGenerator';
import processImage from '../lib/image-process';
import taskManager from '../services/TaskManager';

const log = logger('api.toolPath');

export const generate = async (req, res) => {
    const modelInfo = req.body;
    const suffix = '.json';
    const { type, mode, source } = modelInfo;

    const filename = source.filename;
    const outputFilename = pathWithRandomSuffix(`${filename}.${suffix}`);
    const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;

    let modelPath = null;
    if (type === 'laser') {
        // no need to process model
        if ((source.type === 'svg' && mode === 'vector') ||
            (source.type === 'text' && mode === 'vector')) {
            modelPath = `${APP_CACHE_IMAGE}/${filename}`;
        } else {
            const result = await processImage(modelInfo);
            modelPath = `${APP_CACHE_IMAGE}/${result.filename}`;
        }

        if (modelPath) {
            const generator = new LaserToolPathGenerator();
            generator.generateToolPathObj(modelInfo, modelPath)
                .then(toolPathObj => {
                    const toolPathStr = JSON.stringify(toolPathObj);
                    fs.writeFile(outputFilePath, toolPathStr, 'utf8', (err) => {
                        if (err) {
                            log.error(err);
                        } else {
                            res.send({
                                filename: outputFilename
                            });
                        }
                    });
                });
        } else {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Internal server error'
            });
        }
    } else if (type === 'cnc') {
        const inputFilePath = `${APP_CACHE_IMAGE}/${filename}`;
        if (source.type === 'svg' && mode === 'vector') {
            const svgParser = new SVGParser();
            try {
                const svg = await svgParser.parseFile(inputFilePath);
                const toolPathGenerator = new CncToolPathGenerator();
                const toolPathObject = toolPathGenerator.generateToolPathObj(svg, modelInfo);
                const toolPathStr = JSON.stringify(toolPathObject);
                fs.writeFile(outputFilePath, toolPathStr, () => {
                    res.send({
                        filename: outputFilename
                    });
                });
            } catch (err) {
                log.error(err);
            }
        } else if (source.type === 'raster' && mode === 'greyscale') {
            const inputFilePath = `${APP_CACHE_IMAGE}/${filename}`;
            const generator = new CncReliefToolPathGenerator(modelInfo, inputFilePath);
            generator.generateToolPathObj().then(toolPathObj => {
                const toolPathStr = JSON.stringify(toolPathObj);
                fs.writeFile(outputFilePath, toolPathStr, () => {
                    res.send({
                        filename: outputFilename
                    });
                });
            });
        }
    } else {
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: 'Unsupported type: ' + type
        });
    }
};

export const commitTask = (req, res) => {
    const modelInfo = req.body;
    const taskId = modelInfo.taskId; // todo: move taskId out of modelInfo
    taskManager.addTask(modelInfo, taskId);
    res.send({
        msg: 'task commited'
    });
};

export const fetchTaskResults = (req, res) => {
    let results = taskManager.fetchResults();
    res.send(results);
};
