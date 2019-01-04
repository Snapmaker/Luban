import fs from 'fs';
import logger from '../lib/logger';
import { pathWithRandomSuffix } from '../lib/random-utils';
import { APP_CACHE_IMAGE } from '../constants';
import processImage from '../lib/image-process';
import { LaserToolPathGenerator } from '../lib/ToolPathGenerator';


const log = logger('service:TaskManager');

const generateLaser = async(modelInfo, callback) => {
    const suffix = '.json';
    const { type, modelType, processMode, origin } = modelInfo;
    const originFilename = origin.filename;
    const outputFilename = pathWithRandomSuffix(`${originFilename}.${suffix}`);
    const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;

    let modelPath = null;
    if (type === 'laser') {
        // no need to process model
        if ((modelType === 'svg' && processMode === 'vector') ||
            (modelType === 'text' && processMode === 'vector')) {
            modelPath = `${APP_CACHE_IMAGE}/${originFilename}`;
        } else {
            const result = await processImage(modelInfo);
            modelPath = `${APP_CACHE_IMAGE}/${result.filename}`;
        }
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
                        callback({
                            filename: outputFilename
                        });
                    }
                });
            });
    }
};

class TaskManager {
    constructor() {
        this.tasks = [];
        this.status = 'idle'; // idle, running
    }

    // TODO: use another to do CPU intense workload.
    schedule() {
        if (this.status === 'running') {
            log.info('Scheduling task Missed');
            return;
        }
        log.info('Scheduling task');
        for (const task of this.tasks) {
            if (task.taskStatus === 'idle') {
                this.status = 'running';
                log.info(task);
                generateLaser(task.modelInfo, (res) => {
                    task.filename = res.filename;
                    if (task.taskStatus !== 'deprecated') {
                        task.taskStatus = 'previewed';
                    }
                    this.status = 'idle';
                });
            }
        }
    }
    addTask(modelInfo, taskId) {
        let task = {};
        task.taskId = taskId;
        task.modelInfo = modelInfo;
        task.taskStatus = 'idle'; // idle, previewing, previewed, deprecated
        // task.filename => result
        let modelId = modelInfo.modelId;
        this.tasks.forEach(e => {
            if (e.modelInfo.modelId === modelId) {
                e.taskStatus = 'deprecated';
            }
        });
        this.tasks.push(task);
        this.tasks = this.tasks.filter(e => {
            return e.taskStatus !== 'deprecated';
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
