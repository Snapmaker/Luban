import * as fs from 'fs-extra';
import mv from 'mv';
import path from 'path';
import { v4 as uuid } from 'uuid';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../app/constants';
import {
    findMachineByName,
    getMachineToolHeadConfigPath,
    isDualExtruder,
} from '../../../app/constants/machines';
import { SnapmakerA150Machine, SnapmakerA250Machine, SnapmakerA350Machine, SnapmakerOriginalExtendedMachine, SnapmakerOriginalMachine } from '../../../app/machines';
import { printToolHead, standardCNCToolHead, standardLaserToolHead } from '../../../app/machines/snapmaker-2-toolheads';
import { cncToolHeadOriginal, laserToolHeadOriginal, printToolHeadOriginal } from '../../../app/machines/snapmaker-original-toolheads';
import { generateRandomPathName } from '../../../shared/lib/random-utils';
import { removeSpecialChars } from '../../../shared/lib/utils';
import DataStorage, { rmDir } from '../../DataStorage';
import { ERR_BAD_REQUEST, ERR_INTERNAL_SERVER_ERROR, HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../constants';
import { PROTOCOL_TEXT } from '../../controllers/constants';
import { unzipFile, zipFolder } from '../../lib/archive';
import { packFirmware } from '../../lib/firmware-build';
import logger from '../../lib/logger';
import { convertFileToSTL } from '../../lib/model-to-stl';
import { parseLubanGcodeHeader } from '../../lib/parseGcodeHeader';
import { pathWithRandomSuffix } from '../../lib/random-utils';
import store from '../../store';

const log = logger('api:file');

function copyFileSync(src, dst) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
    }
}

function traverse(models, callback) {
    models.forEach(model => {
        // callback && callback(model);
        if (model.children) {
            traverse(model.children, callback);
        } else {
            callback && callback(model);
        }
    });
}

function getFormalMachineIdentifier(machineIdentifier) {
    switch (machineIdentifier) {
        case 'A150':
            return SnapmakerA150Machine.identifier;
        case 'A250':
            return SnapmakerA250Machine.identifier;
        case 'A350':
            return SnapmakerA350Machine.identifier;
        default:
            return machineIdentifier;
    }
}


// Default tool heads for Snapmaker original
export const INITIAL_SNAPMAKER_ORIGINAL_TOOL_HEAD_IDENTIFIER_MAP = {
    printingToolhead:
        printToolHeadOriginal.identifier,
    laserToolhead: laserToolHeadOriginal.identifier,
    cncToolhead: cncToolHeadOriginal.identifier,
};

export const INITIAL_SNAPMAKER_2_TOOL_HEAD_IDENTIFIER_MAP = {
    printingToolhead: printToolHead.identifier,
    laserToolhead: standardLaserToolHead.identifier,
    cncToolhead: standardCNCToolHead.identifier,
};

function getDefaultToolHeadMap(machineIdentifier) {
    switch (machineIdentifier) {
        case SnapmakerOriginalMachine.identifier:
        case SnapmakerOriginalExtendedMachine.identifier:
            return INITIAL_SNAPMAKER_ORIGINAL_TOOL_HEAD_IDENTIFIER_MAP;
        case SnapmakerA150Machine.identifier:
        case SnapmakerA250Machine.identifier:
        case SnapmakerA350Machine.identifier:
            return INITIAL_SNAPMAKER_2_TOOL_HEAD_IDENTIFIER_MAP;
        default:
            return INITIAL_SNAPMAKER_ORIGINAL_TOOL_HEAD_IDENTIFIER_MAP;
    }
}

function getConfigDir(machineInfo) {
    let configPath = '';

    if (machineInfo) {
        const series = machineInfo?.series;
        const machineIdentifier = getFormalMachineIdentifier(series);

        const headType = machineInfo?.headType;
        const toolHeadIdentifierMap = machineInfo?.toolHead || getDefaultToolHeadMap(machineIdentifier);

        const machine = findMachineByName(machineIdentifier);
        if (machine) {
            configPath = getMachineToolHeadConfigPath(machine, toolHeadIdentifierMap[`${headType}Toolhead`]);
        } else {
            log.warn(`Unable to find machine with identifier ${machineIdentifier}.`);
        }
    }

    return path.join(DataStorage.configDir, configPath);
}

const cpFileToTmp = async (file, uploadName) => {
    const originalName = path.basename(file.name);
    uploadName = uploadName || originalName;
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
    return new Promise(resolve => {
        fs.copyFile(file.path, uploadPath, (err) => {
            if (err) {
                log.error(`Failed to upload file ${originalName}, ${err}`);
            } else {
                resolve({
                    originalName,
                    uploadName
                });
            }
        });
    });
};

export const set = async (req, res) => {
    let { uploadName } = req.body;
    const file = req.files.file || JSON.parse(req.body.file);
    const headType = req.query.headType;
    try {
        if (file) { // post blob file/path string in web
            let filename = file.name, filePath = file.path, children = [];
            ({ filename, filePath, children = [] } = await convertFileToSTL(file, headType === 'printing'));
            const originalName = removeSpecialChars(path.basename(filename));
            if (!uploadName) {
                uploadName = generateRandomPathName(originalName);
            }
            uploadName = uploadName.toLowerCase(); // Use all lower case filename
            children.forEach((item) => {
                item.parentUploadName = uploadName;
            });

            if (!file.fieldName) { // get path string
                const cpRes = await cpFileToTmp(file, uploadName);
                uploadName = cpRes.uploadName;
                res.send({
                    originalName,
                    uploadName,
                    children
                });
            } else { // get blob file
                const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
                mv(filePath, uploadPath, (err) => {
                    if (err) {
                        log.error(`Failed to upload file ${originalName}`);
                        res.status(ERR_INTERNAL_SERVER_ERROR).send({
                            msg: `Failed to upload file ${originalName}: ${err}`
                        });
                    } else {
                        res.send({
                            originalName,
                            uploadName,
                            children
                        });
                        res.end();
                    }
                });
            }
        } else { // post file pathname in electron
            const ret = await cpFileToTmp(JSON.parse(req.body.file));
            res.send(ret);
            res.end();
        }
    } catch (err) {
        log.error(`Failed to upload file: ${err.message} - ${err.stack}`);
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: `Failed to upload file: ${err}`
        });
    }
};
/**
 * Compile the firmware file and export a firmware that Luban can use
 * @param {File} req.files.mainFile
 * @param {File} req.files.moduleFile
 * @param {string} req.body.buildVersion
 */
export const buildFirmwareFile = (req, res) => {
    const files = req.files;
    if (files.mainFile || files.moduleFile) {
        const options = {};
        if (files.mainFile) {
            options.mainPath = files.mainFile.path;
        }
        if (files.moduleFile) {
            options.modulePath = files.moduleFile.path;
        }
        options.buildVersion = req.body.buildVersion;
        packFirmware(options)
            .then((result) => {
                res.send(result);
                res.end();
            })
            .catch((err) => {
                log.error(`Unable to build package: ${err}`);
                res.status(ERR_INTERNAL_SERVER_ERROR).send({
                    msg: 'Unable to build package',
                    error: String(err)
                });
            });
    } else {
        log.warn('files.mainFile or files.moduleFile is required');
        res.status(ERR_BAD_REQUEST).send({
            msg: 'files.mainFile or files.moduleFile is required'
        });
    }
};

export const uploadCaseFile = (req, res) => {
    const { name, casePath } = req.body;
    let originalName = path.basename(name);
    const originalPath = `${DataStorage.userCaseDir}/${casePath}/${originalName}`;
    let uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;

    fs.copyFile(originalPath, uploadPath, async (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalName}`);
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: `Failed to upload file ${originalName}: ${err}`
            });
        } else {
            if (path.extname(originalName) === '.zip') {
                await unzipFile(`${uploadName}`, `${DataStorage.tmpDir}`);
                originalName = originalName.replace(/\.zip$/, '');
                uploadName = originalName;
            }
            res.send({
                originalName,
                uploadName
            });
            res.end();
        }
    });
};

/**
 * Upload G-code file, parse metadata.
 *
 * @param req
 * @param res
 */
export const uploadGcodeFile = async (req, res) => {
    let file = req.files.file;
    if (!file && req.body && typeof req.body.file === 'string') {
        file = JSON.parse(req.body.file);
    }
    let originalName, uploadName, uploadPath, originalPath;
    if (file) {
        originalPath = file.path;
        originalName = removeSpecialChars(path.basename(file.name));
        uploadName = pathWithRandomSuffix(originalName);
        uploadName = uploadName.toLowerCase();
        uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
        mv(originalPath, uploadPath, (err) => {
            if (err) {
                log.error(`Failed to upload file ${originalName}: ${err}`);
                res.status(ERR_INTERNAL_SERVER_ERROR).send({
                    msg: `Failed to upload file ${originalName}: ${err}`
                });
            } else {
                const gcodeHeader = parseLubanGcodeHeader(uploadPath);
                res.send({
                    originalName,
                    uploadName,
                    gcodeHeader
                });
                res.end();
            }
        });
    } else {
        const { casePath, name } = req.body;
        originalPath = `${DataStorage.userCaseDir}/${casePath}/${name}`;
        originalName = path.basename(name);
        uploadName = originalName.replace(/\.zip$/, '');
        uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
        // const tmpFilePath = `${DataStorage.tmpDir}/${originalName}`;
        const gcodeFile = {
            name: originalName,
            path: originalPath
        };
        try {
            await cpFileToTmp(gcodeFile);
            await unzipFile(`${originalName}`, `${DataStorage.tmpDir}`);
            const stats = fs.statSync(uploadPath);
            const size = stats.size;
            const gcodeHeader = parseLubanGcodeHeader(uploadPath);
            res.send({
                originalName,
                uploadName,
                size,
                gcodeHeader
            });
            res.end();
        } catch (err) {
            log.error(`Failed to upload file ${originalName}: ${err}`);
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: `Failed to upload file ${originalName}: ${err}`
            });
        }
    }

    /*
    const controller = store.get(`controllers["${port}/${dataSource}"]`);
    if (!controller) {
        return;
    }
    */
};

/**
 * deprecated
 */
export const uploadUpdateFile = (req, res) => {
    const file = req.files.file;
    const port = req.body.port;
    const dataSource = req.body.dataSource || PROTOCOL_TEXT;
    const originalName = removeSpecialChars(path.basename(file.name));
    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
    mv(file.path, uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalName}`);
        } else {
            res.send({
                originalName,
                uploadName
            });
            res.end();
        }
    });
    const controller = store.get(`controllers["${port}/${dataSource}"]`);
    if (!controller) {
        return;
    }
    controller.command(null, 'updatefile', uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${uploadPath}`);
        }
    });
};

/**
 * get environment data from saved file
 */
export const getEnv = async (req, res) => {
    const { headType } = req.body;
    const envDir = `${DataStorage.envDir}/${headType}`;
    const targetPath = `${envDir}/config.json`;
    try {
        const exists = fs.existsSync(targetPath);
        if (exists) {
            const content = fs.readFileSync(targetPath).toString();
            res.send({ result: 1, content });
        } else {
            res.send({ result: 0 });
        }
        res.end();
    } catch (e) {
        log.error(`Failed to get environment: ${e}`);
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: `Failed to get environment: ${e}`
        });
    }
};

/**
 * save editor environment as files, and copy related resource files
 */
export const saveEnv = async (req, res) => {
    const { content } = req.body;
    try {
        const config = JSON.parse(content);
        const { activePresetIds } = config;

        const machineInfo = config?.machineInfo;
        const headType = machineInfo?.headType;
        const envDir = `${DataStorage.envDir}/${headType}`;
        // TODO: not just remove the category but only change the file when model changed
        rmDir(envDir, false);

        const configDir = getConfigDir(machineInfo);

        const result = await new Promise((resolve, reject) => {
            const targetPath = `${envDir}/config.json`;
            fs.writeFile(targetPath, content, (err) => {
                if (err) {
                    log.error(err);
                    reject(err);
                } else {
                    resolve({
                        targetPath
                    });
                }
            });
        });
        traverse(config.models, (model) => {
            // why copy all not just 'uploadName'
            const { uploadName } = model;
            if (uploadName) {
                if (/\.svg$/.test(uploadName) && !(/parsed\.svg$/.test(uploadName))) {
                    const parseName = uploadName.replace(/\.svg$/, 'parsed.svg');
                    copyFileSync(`${DataStorage.tmpDir}/${parseName}`, `${envDir}/${parseName}`);
                }
                copyFileSync(`${DataStorage.tmpDir}/${uploadName}`, `${envDir}/${uploadName}`);
            }
        });

        if (config.defaultMaterialId && /^material.([0-9_]+)$/.test(config.defaultMaterialId)) {
            copyFileSync(`${configDir}/${config.defaultMaterialId}.def.json`, `${envDir}/${config.defaultMaterialId}.def.json`);
        }
        const isDual = isDualExtruder(machineInfo?.toolHead?.printingToolhead);
        if (isDual && config.defaultMaterialIdRight && /^material.([0-9_]+)$/.test(config.defaultMaterialIdRight)) {
            copyFileSync(`${configDir}/${config.defaultMaterialIdRight}.def.json`, `${envDir}/${config.defaultMaterialIdRight}.def.json`);
        }

        if (activePresetIds) {
            for (const stackId of [LEFT_EXTRUDER, RIGHT_EXTRUDER]) {
                const presetId = activePresetIds[stackId];
                if (presetId && /^quality.([0-9_]+)$/.test(presetId)) {
                    copyFileSync(`${configDir}/${presetId}.def.json`, `${envDir}/${presetId}.def.json`);
                }
            }
        }
        if (machineInfo?.headType === HEAD_CNC || machineInfo?.headType === HEAD_LASER) {
            !!config.toolpaths?.length && config.toolpaths.forEach(toolpath => {
                if (toolpath.toolParams?.definitionId && /^tool.([0-9_]+)$/.test(toolpath.toolParams.definitionId)) {
                    copyFileSync(`${configDir}/${toolpath.toolParams.definitionId}.def.json`, `${envDir}/${toolpath.toolParams.definitionId}.def.json`);
                }
            });
        }
        res.send(result);
        res.end();
    } catch (e) {
        log.error(`Failed to save environment: ${e}`);
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: `Failed to save environment: ${e}`
        });
    }
};


/**
 * recover environment saved resource files to tmp dir.
 */
export const recoverEnv = async (req, res) => {
    try {
        const { content } = req.body;
        const config = JSON.parse(content); // TODO: envObj
        const { activePresetIds } = config;
        const headType = config?.machineInfo?.headType;
        const envDir = `${DataStorage.envDir}/${headType}`;

        const configDir = getConfigDir(config?.machineInfo);

        traverse(config.models, (model) => {
            const { originalName, uploadName } = model;
            copyFileSync(`${envDir}/${originalName}`, `${DataStorage.tmpDir}/${originalName}`);
            copyFileSync(`${envDir}/${uploadName}`, `${DataStorage.tmpDir}/${uploadName}`);
        });


        if (config.defaultMaterialId && /^material.([0-9_]+)$/.test(config.defaultMaterialId)) {
            copyFileSync(`${envDir}/${config.defaultMaterialId}.def.json`, `${configDir}/${config.defaultMaterialId}.def.json`);
        }
        const isDual = isDualExtruder(config.machineInfo?.toolHead?.printingToolhead);
        if (isDual && config.defaultMaterialIdRight && /^material.([0-9_]+)$/.test(config.defaultMaterialIdRight)) {
            copyFileSync(`${envDir}/${config.defaultMaterialIdRight}.def.json`, `${configDir}/${config.defaultMaterialIdRight}.def.json`);
        }

        // recover quality presets
        for (const stackId of [LEFT_EXTRUDER, RIGHT_EXTRUDER]) {
            const presetId = activePresetIds[stackId];
            if (presetId && /^quality.([0-9_]+)$/.test(presetId)) {
                copyFileSync(`${envDir}/${presetId}.def.json`, `${configDir}/${presetId}.def.json`);
            }
        }

        res.send({ result: 1 });
        res.end();
    } catch (e) {
        log.error(`Failed to recover environment: ${e}`);
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: `Failed to recover environment: ${e}`
        });
    }
};

/**
 * remove editor saved environment files
 */
export const removeEnv = async (req, res) => {
    const { headType } = req.body;
    const envDir = `${DataStorage.envDir}/${headType}`;
    rmDir(envDir, false);
    res.send(true);
    res.end();
};

/**
 * package environment to zip file
 */
export const packageEnv = async (req, res) => {
    const tails = {
        'printing': '.snap3dp',
        'laser': '.snaplzr',
        'cnc': '.snapcnc'
    };
    const { headType } = req.body;
    const envDir = `${DataStorage.envDir}/${headType}`;
    // const targetPath = `${envDir}/config.json`;
    // const content = fs.readFileSync(targetPath).toString();
    // const config = JSON.parse(content);

    const targetFile = `${uuid().substring(0, 8)}${tails[headType]}`;
    await zipFolder(envDir, `../../Tmp/${targetFile}`);
    // config.models.forEach((model) => {
    //     const { originalName, uploadName } = model;
    //     fs.existsSync(`${DataStorage.tmpDir}/${originalName}`)
    //      && fs.copyFileSync(`${DataStorage.tmpDir}/${originalName}`, `${envDir}/${originalName}`);

    //     fs.copyFileSync(`${DataStorage.tmpDir}/${uploadName}`, `${envDir}/${uploadName}`);
    // });

    res.send({ targetFile });
    res.end();
};


export const uploadFileToTmp = (req, res) => {
    const { name, casePath } = req.body;
    const originalName = path.basename(name);
    const originalPath = `${DataStorage.userCaseDir}/${casePath}/${originalName}`;
    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
    fs.copyFile(originalPath, uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalName}`);
        } else {
            res.send({
                originalName,
                uploadName
            });
            res.end();
        }
    });
};

export const recoverProjectFile = async (req, res) => {
    const file = req.files.file || JSON.parse(req.body.file);

    try {
        file.path = DataStorage.resolveRelativePath(file.path);
        const { uploadName } = await cpFileToTmp(file);

        await unzipFile(`${uploadName}`, `${DataStorage.tmpDir}`);
        const buffer = fs.readFileSync(`${DataStorage.tmpDir}/config.json`);

        const content = buffer.toString();
        const config = JSON.parse(content);

        const machineInfo = config?.machineInfo;
        let headType = machineInfo?.headType;
        // TODO: for project file of "< version 4.1"
        if (headType === '3dp') {
            headType = HEAD_PRINTING;
            machineInfo.headType = HEAD_PRINTING;
        }
        const configDir = getConfigDir(machineInfo);

        if (config.defaultMaterialId && /^material.([0-9_]+)$/.test(config.defaultMaterialId)) {
            const fname = `${DataStorage.tmpDir}/${config.defaultMaterialId}.def.json`;
            if (fs.existsSync(fname)) {
                fs.copyFileSync(fname, path.join(configDir, `${config.defaultMaterialId}.def.json`));
            }
        }
        if (config.defaultMaterialIdRight && /^material.([0-9_]+)$/.test(config.defaultMaterialIdRight)) {
            const fname = `${DataStorage.tmpDir}/${config.defaultMaterialIdRight}.def.json`;
            if (fs.existsSync(fname)) {
                fs.copyFileSync(fname, path.join(configDir, `${config.defaultMaterialIdRight}.def.json`));
            }
        }

        // Fallback to v4.4 quality preset key
        let { activePresetIds } = config;
        if (!activePresetIds) {
            const { defaultQualityId } = config;
            activePresetIds = {
                [LEFT_EXTRUDER]: defaultQualityId,
                [RIGHT_EXTRUDER]: '',
            };

            config.activePresetIds = activePresetIds;
        }

        for (const stackId of [LEFT_EXTRUDER, RIGHT_EXTRUDER]) {
            const presetId = activePresetIds[stackId];
            if (presetId && /^quality.([0-9_]+)$/.test(presetId)) {
                const filePath = `${DataStorage.tmpDir}/${presetId}.def.json`;
                if (fs.existsSync(filePath)) {
                    fs.copyFileSync(filePath, `${configDir}/${presetId}.def.json`);
                }
            }
        }
        if (headType === HEAD_LASER || headType === HEAD_CNC) {
            config.toolpaths?.length && config.toolpaths.forEach(toolpath => {
                if (toolpath?.toolParams?.definitionId && /^tool.([0-9_]+)$/.test(toolpath?.toolParams?.definitionId)) {
                    const fname = `${DataStorage.tmpDir}/${toolpath.toolParams.definitionId}.def.json`;
                    if (fs.existsSync(fname)) {
                        fs.copyFileSync(fname, `${configDir}/${toolpath.toolParams.definitionId}.def.json`);
                    }
                }
            });
        }

        res.send({
            projectPath: file.path,
            content: JSON.stringify(config), // unwrap config
        });
        res.end();
    } catch (e) {
        log.error(`Failed to recover from project file: ${file.path}`);
        log.error(e);

        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: `Failed to recover from project file: ${e}`,
        });
    }
};
