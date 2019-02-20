import fs from 'fs';
import logger from '../lib/logger';
import { pathWithRandomSuffix } from '../lib/random-utils';
import { APP_CACHE_IMAGE } from '../constants';
import processImage from '../lib/image-process';
import { LaserToolPathGenerator } from '../lib/ToolPathGenerator';
import SVGParser from '../lib/SVGParser';
import CncToolPathGenerator from '../lib/ToolPathGenerator/CncToolPathGenerator';
import CncReliefToolPathGenerator from '../lib/ToolPathGenerator/CncReliefToolPathGenerator';


const log = logger('service:TaskManager');

const MAX_RETRIES = 3;

const generateLaser = async (modelInfo) => {
    const suffix = '.json';
    const { mode, source } = modelInfo;
    const originFilename = source.filename;
    const outputFilename = pathWithRandomSuffix(`${originFilename}.${suffix}`);
    const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;

    let modelPath = null;
    // no need to process model
    if ((source.type === 'svg' && mode === 'vector') || (source.type === 'text' && mode === 'vector')) {
        modelPath = `${APP_CACHE_IMAGE}/${originFilename}`;
    } else {
        const result = await processImage(modelInfo);
        modelPath = `${APP_CACHE_IMAGE}/${result.filename}`;
    }

    if (modelPath) {
        const generator = new LaserToolPathGenerator();
        const toolPathObj = await generator.generateToolPathObj(modelInfo, modelPath);

        const toolPathStr = JSON.stringify(toolPathObj);
        return new Promise((resolve, reject) => {
            fs.writeFile(outputFilePath, toolPathStr, 'utf8', (err) => {
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
        return Promise.reject(new Error('No model found.'));
    }
};

const generateCnc = async (modelInfo) => {
    const suffix = '.json';
    const { mode, source } = modelInfo;
    const originFilename = source.filename;
    const outputFilename = pathWithRandomSuffix(`${originFilename}.${suffix}`);
    const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;

    const inputFilePath = `${APP_CACHE_IMAGE}/${originFilename}`;
    try {
        if (source.type === 'svg' && mode === 'vector') {
            const svgParser = new SVGParser();
            const svg = await svgParser.parseFile(inputFilePath);
            const toolPathGenerator = new CncToolPathGenerator();
            const toolPathObject = toolPathGenerator.generateToolPathObj(svg, modelInfo);
            const toolPathStr = JSON.stringify(toolPathObject);
            return new Promise((resolve, reject) => {
                fs.writeFile(outputFilePath, toolPathStr, 'utf8', (err) => {
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
        } else if (source.type === 'raster' && mode === 'greyscale') {
            const generator = new CncReliefToolPathGenerator(modelInfo, inputFilePath);
            return new Promise((resolve, reject) => {
                generator.generateToolPathObj().then(toolPathObj => {
                    const toolPathStr = JSON.stringify(toolPathObj);
                    fs.writeFile(outputFilePath, toolPathStr, 'utf8', (err) => {
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
            });
        } else {
            return Promise.reject(new Error('Unexpected params: type = ' + source.type + ' mode = ' + mode));
        }
    } catch (err) {
        log.error(err);
        return Promise.reject(new Error('Generate cnc tool path err.'));
    }
};

const generateToolPath = (modelInfo) => {
    if (!modelInfo) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    const { type } = modelInfo;
    if (type === 'laser') {
        return generateLaser(modelInfo);
    } else if (type === 'cnc') {
        // cnc
        return generateCnc(modelInfo);
    } else {
        return Promise.reject(new Error('Unsupported type: ' + type));
    }
};

class TaskManager {
    constructor() {
        this.tasks = [];
        this.status = 'idle'; // idle, running
        this.counter = 0;
    }

    // TODO: use another to do CPU intense workload.
    async schedule() {
        if (this.status === 'running') {
            log.info('Scheduling task Missed');
            return;
        }

        // Add counter
        this.counter++;
        if (this.counter % 20 === 0) {
            log.info('Scheduling task * 20');
        }

        // Mark as running
        this.status = 'running';

        let taskSelected = null;
        for (const task of this.tasks) {
            if (task.taskStatus === 'idle' && task.failedCount < MAX_RETRIES) {
                taskSelected = task;
                break;
            }
        }
        if (taskSelected !== null) {
            log.debug(taskSelected);
            try {
                const res = await generateToolPath(taskSelected.modelInfo);

                taskSelected.filename = res.filename;
                if (taskSelected.taskStatus !== 'deprecated') {
                    taskSelected.taskStatus = 'previewed';
                    taskSelected.finishTime = new Date().getTime();
                }
            } catch (e) {
                console.error(e);
                this.status = 'idle';
                taskSelected.failedCount += 1;
            }
        }

        this.status = 'idle';
    }

    addTask(modelInfo, taskId) {
        const task = {};
        task.taskId = taskId;
        task.modelInfo = modelInfo;
        task.taskStatus = 'idle'; // idle, previewing, previewed, deprecated
        task.failedCount = 0;
        task.finishTime = 0;
        // task.filename => result
        let modelId = modelInfo.modelId;
        this.tasks.forEach(e => {
            if (e.modelInfo.modelId === modelId) {
                e.taskStatus = 'deprecated';
            }
        });
        this.tasks.push(task);

        const now = new Date().getTime();
        this.tasks = this.tasks.filter(task => {
            // Keep only unfinished tasks or recent (10 min) finished tasks
            return task.taskStatus !== 'deprecated'
                && (task.finishTime === 0 || task.finishTime > now - 60 * 10);
        });
        // TODO: Memory leak after long time use. It's too small? ignore?
        // every model only after one entry.
    }

    fetchResults() {
        let results = [];
        this.tasks.forEach(e => {
            if (e.taskStatus === 'previewed') {
                results.push({
                    taskId: e.taskId,
                    filename: e.filename
                });
            }
        });
        return results;
    }
}

const taskManager = new TaskManager();

export default taskManager;
