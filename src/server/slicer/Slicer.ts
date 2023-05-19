import { getPath } from '@snapmaker/snapmaker-lunar';
import childProcess from 'child_process';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';

import { generateRandomPathName } from '../../shared/lib/random-utils';
import DataStorage from '../DataStorage';
import { HEAD_PRINTING, PRINTING_CONFIG_SUBCATEGORY } from '../constants';
import logger from '../lib/logger';
import { postProcessorV1, processGcodeHeaderAfterCuraEngine } from './post-processor';
import { Metadata, SliceProgress, SliceResult } from './slicer-definitions';


const log = logger('service:print3d-slice');

/**
 * callCuraEngine
 *
 * @param globalConfig path to global definition
 * @param modelConfigs - information needed to create new model.
 *      [{
 *          modelPath: 'abc',
 *          configPath: 'abc',
 *      }]
 * @param outputPath output file path
 * @returns process
 */
function callEngine(globalConfig, modelConfigs, outputPath) {
    const enginePath = getPath('Slicer');
    const args = ['slice', '-v', '-p', '-o', outputPath.replace(/\\/g, '/')];

    args.push('-j', globalConfig.configPath.replace(/\\/g, '/'));

    for (const modelConfig of modelConfigs) {
        const filePath = modelConfig.modelPath;
        const fileConfig = modelConfig.configPath;
        args.push('-l', filePath.replace(/\\/g, '/'));
        args.push('-j', fileConfig.replace(/\\/g, '/'));
    }
    log.info(`${enginePath} ${args.join(' ')}`);

    return childProcess.spawn(
        enginePath,
        args,
        {
            env: {
                ...process.env,
                CURA_ENGINE_SEARCH_PATH: `${path.resolve(DataStorage.configDir, HEAD_PRINTING)}`
            }
        }
    );
}


/**
 * Slicer class.
 *
 * events:
 *
 * - started
 *
 * - progress
 *
 * - completed
 *
 * - failed
 */
export default class Slicer extends EventEmitter {
    private version = 0;

    // file path of global definition
    // private globalDefinition: string;

    // file paths of models
    private models: string[];

    // file paths of model definitions
    private modelDefinitions: string[];

    // file paths of support models
    private supportModels: string[];

    // file path of support models' definition
    // all support models share the same definition
    // private supportDefinition: string;

    private metadata: Metadata;

    private progress: number = 0; // 0...1

    public constructor() {
        super();

        this.version = 0;

        // this.globalDefinition = '';

        this.models = [];
        this.modelDefinitions = [];

        this.supportModels = [];
        // this.supportDefinition = '';

        this.progress = 0;
    }

    public setVersion(version = 0) {
        this.version = version;
    }

    public setModels(models: string[]) {
        this.models = models;
    }

    public setModelDefinitions(definitions: string[]): void {
        this.modelDefinitions = definitions;
    }

    public setSupportModels(models: string[]): void {
        this.supportModels = models;
    }

    public setMetadata(metadata: Metadata): void {
        this.metadata = metadata;
    }

    private validate(): boolean {
        if (this.models.length !== this.modelDefinitions.length) {
            return false;
        }

        for (let i = 0; i < this.models.length; i++) {
            const modelName = this.models[i];
            const modelPath = `${DataStorage.tmpDir}/${modelName}`;
            if (!fs.existsSync(modelPath)) {
                log.error(`Slice failed: 3D model file does not exist: ${modelPath}`);
                this.emit('failed', `Slice failed: 3D model file does not exist: ${modelPath}`);
                return false;
            }
        }

        for (let i = 0; i < this.supportModels.length; i++) {
            const modelName = this.supportModels[i];
            const modelPath = `${DataStorage.tmpDir}/${modelName}`;

            if (!fs.existsSync(modelPath)) {
                log.error(`Slice failed: 3D model file does not exist: ${modelPath}`);
                this.emit('failed', `Slice failed: 3D model file does not exist: ${modelPath}`);
                return false;
            }
        }

        return true;
    }

    private calculateProgress(progress: SliceProgress): number {
        const layerPercent = Math.min(1.0, progress.layer / progress.layers);

        return layerPercent * 0.3 + (progress.progressStatus - 1) * 0.3;
    }

    private updateProgress(progress: SliceProgress): void {
        const newProgress = this.calculateProgress(progress);

        if (newProgress - this.progress > 0.001) {
            this.progress = newProgress;
            this.emit('progress', newProgress);
        }
    }

    private _onSliceProcessData(sliceResult: SliceResult, data, progress: SliceProgress): void {
        const array = data.toString().split('\n');

        const timeRegex = /^\[.*] \[info] Print time \(s\): ([\d]+)$/;

        array.forEach((item) => {
            if (item.length < 10) {
                return;
            }
            // if (item.indexOf('[debug]') !== -1) {
            //     return;
            // }
            if (item.indexOf('warn') !== -1) {
                log.warn(item);
            } else if (item.indexOf('error') !== -1) {
                log.error(item);
            }

            if (item.indexOf('Processing insets') !== -1) {
                if (progress.progressStatus >= 2) {
                    return;
                } else if (progress.progressStatus !== 1) {
                    progress.progressStatus = 1;
                    progress.layers = parseFloat(item.slice(item.lastIndexOf('of') + 3));
                    progress.layer = 0;
                }
                progress.layer++;

                this.updateProgress(progress);
            } else if (item.indexOf('Processing skins and infill') !== -1) {
                if (progress.progressStatus >= 3) {
                    return;
                } else if (progress.progressStatus !== 2) {
                    progress.progressStatus = 2;
                    progress.layers = parseFloat(item.slice(item.lastIndexOf('of') + 3));
                    progress.layer = 0;
                }
                // Note: sum of layers of objects, it may excceed number of layers
                progress.layer++;

                this.updateProgress(progress);
            } else if (item.indexOf('GcodeWriter processing') !== -1) {
                if (progress.progressStatus >= 4) {
                    return;
                } else if (progress.progressStatus !== 3) {
                    progress.progressStatus = 3;
                    progress.layers = parseFloat(item.slice(item.lastIndexOf('of') + 3));
                    progress.layer = 0;
                }
                progress.layer++;

                this.updateProgress(progress);
            } else if (item.indexOf(';Filament used:') === 0) {
                // single extruder: ';Filament used: 0.139049m'
                // dual extruders: ';Filament used: 0.139049m, 0m'
                const filamentLengthArr = item.replace(';Filament used:', '')
                    .split(',');
                const filamentLength = filamentLengthArr.map(str => Number(str.trim()
                    .replace('m', '')));
                // volume (cm^3) * density (PLA: 1.24 g/cm^3)
                const filamentWeight = filamentLength.map(v => Math.PI * (1.75 / 2) * (1.75 / 2) * v * 1.24);

                sliceResult.filamentLength = filamentLength;
                sliceResult.filamentWeight = filamentWeight;
            } else if (item.indexOf(';TIME:') === 0) {
                sliceResult.printTime = Number(item.replace(';TIME:', '')) * 1.07;
            } else if (timeRegex.test(item)) {
                const reResult = item.match(timeRegex);
                const time = reResult ? reResult[1] : 0;

                // Times empirical parameter: 1.07
                sliceResult.printTime = Math.round(Number(time) * 1.07);
            }
        });
    }

    private _postProcess(sliceResult: SliceResult): void {
        if (this.version === 0) {
            const gcodeFileLength = processGcodeHeaderAfterCuraEngine(sliceResult.gcodeFilePath, this.metadata, sliceResult);
            sliceResult.gcodeFileLength = gcodeFileLength;

            this.emit('progress', 1.0);
            this.emit('completed', sliceResult);
        }

        if (this.version === 1) {
            postProcessorV1(sliceResult, this.metadata)
                .then(() => {
                    this.emit('progress', 1.0);
                    this.emit('completed', sliceResult);
                });
        }
    }

    private _onSliceProcessClose(sliceResult: SliceResult, code: number): void {
        log.info(`sliceResult = ${sliceResult}`);
        if (code === 0) {
            this.emit('progress', 0.95);

            // TODO: why so many parameters passed in here?
            const { renderGcodeFileName: renderName } = this.metadata;
            const renderGcodeFileName = `${renderName}.gcode`;
            sliceResult.renderGcodeFileName = renderGcodeFileName;

            this._postProcess(sliceResult);
        } else {
            this.emit('failed', 'Slicer failed.');
        }
        log.info(`Slicer process exit with code = ${code}`);
    }

    public startSlice(): void {
        if (!this.validate()) {
            return;
        }

        const sliceResult = new SliceResult();

        const globalConfig = {
            configPath: path.join(DataStorage.configDir, PRINTING_CONFIG_SUBCATEGORY, 'active_final.def.json'),
        };

        const modelConfigs = [];
        for (let i = 0; i < this.models.length; i++) {
            modelConfigs.push({
                modelPath: path.join(DataStorage.tmpDir, this.models[i]),
                configPath: path.join(DataStorage.tmpDir, this.modelDefinitions[i]),
            });
        }
        for (let i = 0; i < this.supportModels.length; i++) {
            modelConfigs.push({
                modelPath: path.join(DataStorage.tmpDir, this.supportModels[i]),
                configPath: path.join(DataStorage.configDir, PRINTING_CONFIG_SUBCATEGORY, 'support.def.json'),
            });
        }

        const outputFilename = this.metadata.originalName
            ? generateRandomPathName(`${path.parse(this.metadata.originalName).name}.gcode`)
            : generateRandomPathName('model.gcode');
        const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;

        sliceResult.gcodeFilename = outputFilename;
        sliceResult.gcodeFilePath = outputFilePath;

        const process = callEngine(globalConfig, modelConfigs, outputFilePath);
        const sliceProgress = new SliceProgress();
        process.stdout.on('data', (data) => this._onSliceProcessData(sliceResult, data, sliceProgress));
        process.stderr.on('data', (err) => {
            log.error(err.toString());
        });
        process.on('close', (code) => this._onSliceProcessClose(sliceResult, code));
    }
}

