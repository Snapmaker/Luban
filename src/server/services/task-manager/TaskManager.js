import fs from 'fs';
import EventEmitter from 'events';
import logger from '../../lib/logger';
import { pathWithRandomSuffix } from '../../lib/random-utils';
import processImage from '../../lib/image-process';
import { LaserToolPathGenerator } from '../../lib/ToolPathGenerator';
import SVGParser from '../../lib/SVGParser';
import CncToolPathGenerator from '../../lib/ToolPathGenerator/CncToolPathGenerator';
import CncReliefToolPathGenerator from '../../lib/ToolPathGenerator/CncReliefToolPathGenerator';
import DataStorage from '../../DataStorage';


const log = logger('service:TaskManager');

const MAX_TRY_COUNT = 2;

const generateLaser = async (modelInfo, onProgress) => {
    const suffix = '.json';
    // const { mode, source } = modelInfo;
    // const originFilename = source.filename;
    const { sourceType, mode, uploadName } = modelInfo;
    const outputFilename = pathWithRandomSuffix(`${uploadName}.${suffix}`);
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

const generateCnc = async (modelInfo, onProgress) => {
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

const generateToolPath = (modelInfo, onProgress) => {
    if (!modelInfo) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    const { headerType } = modelInfo;
    if (headerType === 'laser') {
        return generateLaser(modelInfo, onProgress);
    } else if (headerType === 'cnc') {
        return generateCnc(modelInfo, onProgress);
    } else {
        return Promise.reject(new Error(`Unsupported type: ${headerType}`));
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
                    this.emit('taskProgress', p);
                });

                taskSelected.filename = res.filename;
                if (taskSelected.taskStatus !== 'deprecated') {
                    taskSelected.taskStatus = 'previewed';
                    taskSelected.finishTime = new Date().getTime();

                    this.emit('taskCompleted', taskSelected);
                }
            } catch (e) {
                log.error(e);
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

    addTask(modelInfo, taskID) {
        const task = {};
        task.taskID = taskID;
        task.modelInfo = modelInfo;
        task.taskStatus = 'idle'; // idle, previewing, previewed, deprecated
        task.failedCount = 0;
        task.finishTime = 0;
        // task.filename => result
        const modelID = modelInfo.modelID;
        // const { uploadName } = modelInfo;
        this.tasks.forEach(e => {
            if (e.modelInfo.modelID === modelID) {
            // if (e.modelInfo.uploadName === uploadName) {
                e.taskStatus = 'deprecated';
            }
        });
        this.tasks.push(task);

        const now = new Date().getTime();
        this.tasks = this.tasks.filter(t => {
            // Keep only unfinished tasks or recent (10 min) finished tasks
            return t.taskStatus !== 'deprecated'
                && (t.finishTime === 0 || t.finishTime > now - 60 * 10);
        });
        // TODO: Memory leak after long time use. It's too small? ignore?
        // every model only after one entry.
    }
}

export default TaskManager;
