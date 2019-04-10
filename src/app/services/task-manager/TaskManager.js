import fs from 'fs';
import EventEmitter from 'events';
import logger from '../../lib/logger';
import { pathWithRandomSuffix } from '../../lib/random-utils';
import { APP_CACHE_IMAGE } from '../../constants';
import processImage from '../../lib/image-process';
import { LaserToolPathGenerator } from '../../lib/ToolPathGenerator';
import SVGParser from '../../lib/SVGParser';
import CncToolPathGenerator from '../../lib/ToolPathGenerator/CncToolPathGenerator';
import CncReliefToolPathGenerator from '../../lib/ToolPathGenerator/CncReliefToolPathGenerator';


const log = logger('service:TaskManager');

const MAX_TRY_COUNT = 2;

const generateLaser = async (modelInfo, onProgress) => {
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
        // processImage: do "scale, rotate, greyscale/bw"
        const result = await processImage(modelInfo);
        modelPath = `${APP_CACHE_IMAGE}/${result.filename}`;
    }

    if (modelPath) {
        const generator = new LaserToolPathGenerator();
        generator.on('taskProgress', (p) => {
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
    } else {
        return Promise.reject(new Error('No model found.'));
    }
};

const generateCnc = async (modelInfo, onProgress) => {
    const suffix = '.json';
    const { mode, source } = modelInfo;
    const originFilename = source.filename;
    const inputFilePath = `${APP_CACHE_IMAGE}/${originFilename}`;
    const outputFilename = pathWithRandomSuffix(`${originFilename}.${suffix}`);
    const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;
    log.error('generateCnc: modelInfo = ' + JSON.stringify(modelInfo));
    if ((source.type === 'svg' && mode === 'vector') || (source.type === 'text' && mode === 'vector')) {
        const svgParser = new SVGParser();
        const svg = await svgParser.parseFile(inputFilePath);
        const generator = new CncToolPathGenerator();
        generator.on('taskProgress', (p) => {
            onProgress(p);
        });
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
    } else if (source.type === 'raster' && mode === 'greyscale') {
        const generator = new CncReliefToolPathGenerator(modelInfo, inputFilePath);
        generator.on('taskProgress', (p) => {
            onProgress(p);
        });
        return new Promise(async (resolve, reject) => {
            try {
                const toolPath = await generator.generateToolPathObj();
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
            } catch (e) {
                reject(e);
            }
        });
    } else {
        return Promise.reject(new Error('Unexpected params: type = ' + source.type + ' mode = ' + mode));
    }
};

const generateToolPath = (modelInfo, onProgress) => {
    if (!modelInfo) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    const { type } = modelInfo;
    if (type === 'laser') {
        return generateLaser(modelInfo, onProgress);
    } else if (type === 'cnc') {
        // cnc
        return generateCnc(modelInfo, onProgress);
    } else {
        return Promise.reject(new Error('Unsupported type: ' + type));
    }
};

class TaskManager extends EventEmitter {
    constructor() {
        super();

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

        // Mark as running
        this.status = 'running';

        let taskSelected = null;
        for (const task of this.tasks) {
            if (task.taskStatus === 'idle' && task.failedCount < MAX_TRY_COUNT) {
                taskSelected = task;
                break;
            }
        }
        if (taskSelected !== null) {
            // Add counter
            this.counter++;
            if (this.counter % 20 === 0) {
                log.info('Scheduling task * 20');
            }

            log.debug(taskSelected);
            try {
                const res = await generateToolPath(taskSelected.modelInfo, (p) => {
                    this.emit('taskProgressFromTaskManager', p);
                });

                taskSelected.filename = res.filename;
                if (taskSelected.taskStatus !== 'deprecated') {
                    taskSelected.taskStatus = 'previewed';
                    taskSelected.finishTime = new Date().getTime();

                    this.emit('taskCompleted', taskSelected);
                }
            } catch (e) {
                console.error(e);
                this.status = 'idle';

                taskSelected.failedCount += 1;
                if (taskSelected.failedCount === MAX_TRY_COUNT) {
                    taskSelected.taskStatus = 'failed';
                    taskSelected.finishTime = new Date().getTime();

                    this.emit('taskCompleted', taskSelected);
                }
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
            return task.taskStatus !== 'deprecated' &&
                (task.finishTime === 0 || task.finishTime > now - 60 * 10);
        });
        // TODO: Memory leak after long time use. It's too small? ignore?
        // every model only after one entry.
    }
}

export default TaskManager;
