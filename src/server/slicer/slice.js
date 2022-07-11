import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';

import lubanEngine, { getPath } from 'snapmaker-luban-engine';
import lunar from 'snapmaker-lunar';
import logger from '../lib/logger';
import DataStorage from '../DataStorage';
import settings from '../config/settings';
import { DefinitionLoader } from './definition';
import { generateRandomPathName, pathWithRandomSuffix } from '../../shared/lib/random-utils';
import { HEAD_PRINTING, PRINTING_CONFIG_SUBCATEGORY } from '../constants';
import { convertObjectKeyNameToUnderScoreCase } from '../lib/utils';
import pkg from '../../package.json';

const log = logger('service:print3d-slice');

// const lunar = require('snapmaker-lunar');

const enginePath = getPath();

/**
 * callCuraEngine
 *
 * @param modelConfig - information needed to create new model.
 *  modelConfig = {
                configFilePath,
                path: [modelPathString]
            };
 * @param supportConfig same as modelConfig
 * @param outputPath output file path
 * @returns process
 */
function callCuraEngine(modelConfig, supportConfig, outputPath) {
    const args = ['slice', '-v', '-p', '-o', outputPath];

    if (modelConfig && modelConfig.path.length) {
        args.push('-j', modelConfig.configFilePath);
        for (let i = 0; i < modelConfig.path.length; i++) {
            const filePath = modelConfig.path[i];
            const fileConfig = modelConfig.modelConfigFilePath[i];
            args.push('-l', filePath);
            args.push('-j', fileConfig);
        }
    }
    if (supportConfig && supportConfig.path.length) {
        for (const filePath of supportConfig.path) {
            args.push('-l', filePath);
            // notice that this config just effects the previous model
            args.push('-j', supportConfig.configFilePath);
        }
    }
    // log.info(`${enginePath} ${args.join(' ')}`);
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

let sliceProgress, filamentLength, filamentWeight, printTime;

function processGcodeHeaderAfterCuraEngine(gcodeFilePath, boundingBox, thumbnail, others) {
    const activeFinal = new DefinitionLoader();
    activeFinal.loadDefinition(PRINTING_CONFIG_SUBCATEGORY, 'active_final');
    const isTwoExtruder = activeFinal?.settings?.extruders_enabled_count?.default_value;

    const extruderL = new DefinitionLoader();
    extruderL.loadDefinition(PRINTING_CONFIG_SUBCATEGORY, 'snapmaker_extruder_0');
    const extruderR = new DefinitionLoader();
    extruderR.loadDefinition(PRINTING_CONFIG_SUBCATEGORY, 'snapmaker_extruder_1');

    const readFileSync = fs.readFileSync(gcodeFilePath, 'utf8');

    const date = new Date();
    const splitIndex = readFileSync.indexOf(';Generated');
    const boundingBoxMax = (boundingBox || {
        max: {
            x: 0,
            y: 0,
            z: 0
        }
    }).max;
    const boundingBoxMin = (boundingBox || {
        min: {
            x: 0,
            y: 0,
            z: 0
        }
    }).min;
    const header = `${';Header Start\n'
        + '\n'
        + `${readFileSync.substring(0, splitIndex)}\n`
        + ';header_type: 3dp\n'
        + `;tool_head: ${others?.printingToolhead}\n`
        + `;machine: ${others?.series}\n`
        + `;thumbnail: ${thumbnail}\n`
        + `;file_total_lines: ${readFileSync.split('\n').length + 20}\n`
        + `;estimated_time(s): ${printTime}\n`
        + `;nozzle_temperature(°C): ${extruderL.settings.material_print_temperature_layer_0.default_value}\n`
        + `;nozzle_1_temperature(°C): ${isTwoExtruder === 2 ? extruderR?.settings?.material_print_temperature_layer_0?.default_value : '-1'}\n`
        + `;nozzle_0_diameter(mm): ${extruderL.settings.machine_nozzle_size.default_value}\n`
        + `;nozzle_1_diameter(mm): ${isTwoExtruder === 2 ? extruderR?.settings?.machine_nozzle_size?.default_value : '-1'}\n`
        + `;build_plate_temperature(°C): ${activeFinal.settings.material_bed_temperature_layer_0.default_value}\n`
        + `;work_speed(mm/minute): ${activeFinal.settings.speed_infill.default_value * 60}\n`
        + `;max_x(mm): ${boundingBoxMax.x}\n`
        + `;max_y(mm): ${boundingBoxMax.y}\n`
        + `;max_z(mm): ${boundingBoxMax.z}\n`
        + `;min_x(mm): ${boundingBoxMin.x}\n`
        + `;min_y(mm): ${boundingBoxMin.y}\n`
        + `;min_z(mm): ${boundingBoxMin.z}\n`
        + `;layer_number: ${others?.layerCount}\n`
        + `;layer_height: ${activeFinal.settings.speed_infill.default_value}\n`
        + `;matierial_weight: ${filamentWeight}\n`
        + `;matierial_length: ${filamentLength}\n`
        + `;nozzle_0_material: ${others?.matierial0}\n`
        + `;nozzle_1_material: ${others?.matierial1}\n`
        + '\n'
        + ';Header End\n'
        + '\n'
        + '; G-code for 3dp engraving\n'
        + '; Generated by Snapmaker Luban '}${settings.version}\n`
        + `; ${date.toDateString()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}\n`
        + '\n';
    const nextSplitIndex = readFileSync.indexOf('\n', splitIndex) + 1;
    const dataLength = header.length + readFileSync.length - nextSplitIndex;
    fs.writeFileSync(gcodeFilePath, header + readFileSync.substring(nextSplitIndex));
    return dataLength;
}

function slice(params, onProgress, onSucceed, onError) {
    if (!fs.existsSync(enginePath)) {
        log.error(`Cura Engine not found: ${enginePath}`);
        onError(`Slice Error: Cura Engine not found: ${enginePath}`);
        return;
    }

    const {
        originalName,
        model,
        support,
        definition,
        layerCount,
        matierial0,
        matierial1,
        boundingBox,
        thumbnail,
        renderGcodeFileName: renderName,
        printingToolhead,
        series
    } = params;
    const modelConfig = {
        configFilePath: `${DataStorage.configDir}/${PRINTING_CONFIG_SUBCATEGORY}/active_final.def.json`,
        path: [],
        modelConfigFilePath: []
    };
    const others = {
        layerCount,
        matierial0,
        matierial1,
        printingToolhead,
        series
    };
    for (let i = 0; i < model.length; i++) {
        const modelName = model[i];
        const definitionName = definition[i];
        const uploadPath = `${DataStorage.tmpDir}/${modelName}`;
        const uploadDefinitionPath = `${DataStorage.tmpDir}/${definitionName}`;

        if (!fs.existsSync(uploadPath)) {
            log.error(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
            onError(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
            return;
        }
        modelConfig.path.push(uploadPath);
        modelConfig.modelConfigFilePath.push(uploadDefinitionPath);
    }

    const supportConfig = {
        configFilePath: `${DataStorage.configDir}/${PRINTING_CONFIG_SUBCATEGORY}/support.def.json`,
        path: []
    };
    for (const modelName of support) {
        const uploadPath = `${DataStorage.tmpDir}/${modelName}`;

        if (!fs.existsSync(uploadPath)) {
            log.error(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
            onError(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
            return;
        }
        supportConfig.path.push(uploadPath);
    }


    const gcodeFilename = generateRandomPathName(`${path.parse(originalName).name}.gcode`);
    const gcodeFilePath = `${DataStorage.tmpDir}/${gcodeFilename}`;
    const process = callCuraEngine(modelConfig, supportConfig, gcodeFilePath);
    const renderGcodeFileName = `${renderName}.gcode`;

    process.stderr.on('data', (data) => {
        const array = data.toString()
            .split('\n');

        array.map((item) => {
            if (item.length < 10) {
                return null;
            }
            if (item.indexOf('Progress:inset+skin:') === 0 || item.indexOf('Progress:export:') === 0) {
                const start = item.indexOf('0.');
                const end = item.indexOf('%');
                sliceProgress = Number(item.slice(start, end));
                onProgress(sliceProgress);
            } else if (item.indexOf(';Filament used:') === 0) {
                // single extruder: ';Filament used: 0.139049m'
                // dual extruders: ';Filament used: 0.139049m, 0m'
                const filamentLengthArr = item.replace(';Filament used:', '')
                    .split(',');
                filamentLength = filamentLengthArr.map(str => Number(str.trim()
                    .replace('m', '')))
                    .reduce((a, b) => a + b, 0);
                filamentWeight = Math.PI * (1.75 / 2) * (1.75 / 2) * filamentLength * 1.24;
            } else if (item.indexOf('Print time (s):') === 0) {
                // Times empirical parameter: 1.07
                printTime = Number(item.replace('Print time (s):', '')) * 1.07;
            }
            return null;
        });
    });

    process.on('close', (code) => {
        if (filamentLength && filamentWeight && printTime) {
            sliceProgress = 1;
            onProgress(sliceProgress);
            const gcodeFileLength = processGcodeHeaderAfterCuraEngine(gcodeFilePath, boundingBox, thumbnail, others);

            onSucceed({
                gcodeFilename: gcodeFilename,
                gcodeFileLength: gcodeFileLength,
                printTime: printTime,
                filamentLength: filamentLength,
                filamentWeight: filamentWeight,
                gcodeFilePath: gcodeFilePath,
                renderGcodeFileName
            });
        } else {
            onError('Slice Error');
        }
        log.info(`slice progress closed with code ${code}`);
    });
}

/**
 * generate model support
 * @param {*} modelInfo {
    "data": [
        {
        "upload_name": "30down.stl",
        "support_stl_filename": "s30down.stl",
        "config": {
            "support_angle": 60,
            "layer_height_0": 0.3,
            "support_mark_area": false
        }
        }
    ]
    }
 * @param {*} onProgress function
 * @param {*} onSucceed function
 * @param {*} onError function
 * @returns null
 */
export function generateSupport(modelInfo, onProgress, onSucceed, onError) {
    const { data } = modelInfo;

    const settingsForSupport = {
        data: []
    };
    for (const d of data) {
        settingsForSupport.data.push(convertObjectKeyNameToUnderScoreCase(d));
        const uploadPath = `${DataStorage.tmpDir}/${d.uploadName}`;

        if (!fs.existsSync(uploadPath)) {
            log.error(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
            onError(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
            return;
        }
    }

    const settingsFilePath = `${DataStorage.tmpDir}/${pathWithRandomSuffix('settings')}.json`;

    try {
        fs.writeFileSync(settingsFilePath, JSON.stringify(settingsForSupport));
    } catch (e) {
        log.error(`Fail to generate support settings: ${e}`);
        onError(`Fail to generate support settings: ${e}`);
        return;
    }

    lubanEngine.modelSupport(DataStorage.tmpDir, DataStorage.tmpDir, settingsFilePath)
        .onStderr('data', (item) => {
            if (item.length < 10) {
                return null;
            }
            if (item.indexOf('Progress:') === 0 && item.indexOf('accomplished') === -1) {
                const start = item.search('[0-9.]*%');
                const end = item.indexOf('%');
                sliceProgress = Number(item.slice(start, end));
                onProgress(sliceProgress);
            }
            return null;
        })
        .end((err, res) => {
            if (err) {
                log.error(`fail to generate support: ${err}`);
                onError(err);
            } else {
                const files = [];
                data.forEach(v => {
                    files.push({
                        supportStlFilename: fs.existsSync(`${DataStorage.tmpDir}/${v.supportStlFilename}`) ? v.supportStlFilename : null,
                        modelID: v.modelID
                    });
                });
                onSucceed({
                    files
                });
                log.info(`slice progress closed with code ${res.code}`);
            }
        });
}

export function simplifyModel(params, onProgress, onSucceed, onError) {
    // onSucceed();
    // onProgress(0.8);
    // const process =
    const {
        uploadName,
        modelID,
        simplifyType,
        simplifyPercent,
        layerHeight,
        sourceSimplify
    } = params;

    const extname = path.extname(uploadName);
    const modelName = uploadName.slice(
        0,
        uploadName.indexOf(extname)
    );

    const simplifyConfigPath = `${DataStorage.configDir}/${HEAD_PRINTING}/simplify_model.def.json`;
    const data = fs.readFileSync(simplifyConfigPath, 'utf8');
    const config = JSON.parse(data);
    config.config.simplify_type = simplifyType === 0 ? 'edge_ratio_stop' : 'edge_length_stop';
    // simplifyType === 0 && (config.config.edge_ratio_threshold = (100 - simplifyPercent) / 100)**3;
    // simplifyType === 1 && (config.config.edge_length_threshold = layerHeight);
    if (simplifyType === 0) {
        config.config.edge_ratio_threshold = ((100 - simplifyPercent) / 100) ** 3;
    } else if (simplifyType === 1) {
        config.config.edge_length_threshold = layerHeight;
    }
    const outputPath = `${DataStorage.tmpDir}/${modelName}-simplify`;
    // fs.exists() && fs.rmdirSync(outputPath);
    const tempFiles = [
        path.join(outputPath, '.ply'),
        path.join(outputPath, '.stl')
    ];
    tempFiles.forEach((file) => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    });

    fs.writeFile(simplifyConfigPath, JSON.stringify(config), 'utf8', (err) => {
        if (err) {
            console.log({ err });
            onError();
        } else {
            const simplifyConfig = {
                // configFilePath: `${DataStorage.configDir}/${HEAD_PRINTING}/simplify_model.def.json`,
                modelPath: `${DataStorage.tmpDir}/${sourceSimplify}`,
                configFilePath: simplifyConfigPath,
                outputPath: outputPath
            };
            lunar.modelSimplify(simplifyConfig.modelPath, simplifyConfig.outputPath, simplifyConfig.configFilePath)
                .onStderr('data', res => {
                    log.info(`response: ${res}`);
                })
                .end((_err, res) => {
                    if (_err) {
                        log.error(`fail to simplify model: ${_err}`);
                    } else {
                        log.info(`lunar code: ${res.code}`);
                        if (res.code === 0) {
                            onSucceed({
                                modelID: modelID,
                                modelUploadName: `${sourceSimplify}`,
                                modelOutputName: `${modelName}-simplify.stl`,
                                sourcePly: `${modelName}-simplify.ply`
                            });
                        }
                    }
                });
        }
    });
    // const process = simplifyModelEngine(simplifyConfig);
    // process.stderr.on('data', (data) => {
    //     console.log('data', data);
    // });
    // process.stderr.on('close', (data) => {
    //     console.log('close', data);
    // })
}

export function repairModel(actions, params) {
    const {
        uploadName,
        modelID,
        size
    } = params;

    const extname = path.extname(uploadName);
    const modelName = uploadName.slice(
        0,
        uploadName.indexOf(extname)
    );

    const modeltPath = `${DataStorage.tmpDir}/${uploadName}`;
    const outputPath = `${DataStorage.tmpDir}/${modelName}_repaired`;
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }
    let stepCount = 0;

    const config = {
        version: pkg.version,
        config: {
            machine_width: size.x,
            machine_depth: size.y,
            machine_height: size.z
        },
        data: []
    };
    const reapirConfigPath = `${DataStorage.tmpDir}/_reapir_model.def.json`;

    fs.writeFile(reapirConfigPath, JSON.stringify(config), 'utf8', (_err) => {
        if (_err) {
            actions.error(_err);
        } else {
            lunar.modelRepair(modeltPath, outputPath, reapirConfigPath)
                .onStderr('data', (item) => {
                    if (item.indexOf('Step:') !== -1) {
                        actions.next({
                            type: 'progress',
                            progress: stepCount / 7
                        });
                        stepCount++;
                    }
                })
                .end((err, res) => {
                    if (err) {
                        log.error(`fail to repair model: ${err}`);
                        actions.next({
                            type: 'error',
                            modelID,
                            sourcePly: `${modelName}_repaired.ply`,
                            uploadName: `${modelName}_repaired.stl`
                        });
                        actions.error(err);
                    } else {
                        log.info(`lunar code: ${res.code}`);
                        if (res.code === 0) {
                            actions.next({
                                type: 'success',
                                modelID,
                                sourcePly: `${modelName}_repaired.ply`,
                                uploadName: `${modelName}_repaired.stl`
                            });
                            actions.complete();
                        }
                    }
                });
        }
    });
}

export function checkModel(actions, params) {
    const {
        uploadName,
        modelID
    } = params;

    const extname = path.extname(uploadName);
    const modelName = uploadName.slice(
        0,
        uploadName.indexOf(extname)
    );

    const modeltPath = `${DataStorage.tmpDir}/${uploadName}`;
    const outputPath = `${DataStorage.tmpDir}/${modelName}_check`;
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }
    lunar.modelCheck(modeltPath, outputPath)
        .onStderr('data', (data) => {
            console.log(1);
            log.debug(`${data}`);
        })
        .end((err, res) => {
            if (err) {
                log.error(`fail to check model: ${err}`);
                actions.error(err);
            } else {
                if (res.status === 0) {
                    actions.next({
                        type: 'success',
                        modelID,
                        originUploadName: uploadName,
                        sourcePly: `${modelName}_check.ply`,
                        uploadName: `${modelName}_check.stl`
                    });
                } else {
                    actions.next({
                        type: 'error',
                        modelID,
                        originUploadName: uploadName,
                        sourcePly: `${modelName}_check.ply`
                    });
                }
                actions.complete();
            }
        });
}

export default slice;
