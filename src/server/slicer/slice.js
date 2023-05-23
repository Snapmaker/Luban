import fs from 'fs';
import path from 'path';
import lubanEngine from 'snapmaker-luban-engine';
import lunar from '@snapmaker/snapmaker-lunar';

import logger from '../lib/logger';
import DataStorage from '../DataStorage';
import { pathWithRandomSuffix } from '../../shared/lib/random-utils';
import { HEAD_PRINTING } from '../constants';
import { convertObjectKeyNameToUnderScoreCase } from '../lib/utils';
import pkg from '../../package.json';

const log = logger('service:print3d-slice');


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
                const sliceProgress = Number(item.slice(start, end));
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
            log.error({ err });
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
        size,
        outputName
    } = params;

    const extname = path.extname(uploadName);
    const modelName = uploadName.slice(
        0,
        uploadName.indexOf(extname)
    );

    const modeltPath = `${DataStorage.tmpDir}/${uploadName}`;
    const _outputName = outputName || `${modelName}_repaired`;

    // TODO: Update lunar to accept output name with ext
    const realOutputName = `${_outputName}.stl`;
    const outputPath = `${DataStorage.tmpDir}/${_outputName}`;

    if ((outputName !== uploadName) && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }
    let stepCount = 1;

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
                            progress: stepCount / 8
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
                            uploadName: realOutputName,
                        });
                        actions.error(err);
                    } else {
                        log.info(`lunar code: ${res.code}`);
                        if (res.code === 0) {
                            actions.next({
                                type: 'success',
                                modelID,
                                uploadName: realOutputName,
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
            log.debug(`${data}`);
        })
        .end((err, res) => {
            if (err) {
                log.error(`fail to check model: ${err}`);
                actions.next({
                    type: 'error',
                    modelID,
                    originUploadName: uploadName,
                });
                actions.complete();
            } else {
                if (res.status === 0) {
                    actions.next({
                        type: 'success',
                        modelID,
                        originUploadName: uploadName,
                        uploadName: `${modelName}_check.stl`
                    });
                } else {
                    actions.next({
                        type: 'error',
                        modelID,
                        originUploadName: uploadName,
                    });
                }
                actions.complete();
            }
        });
}
