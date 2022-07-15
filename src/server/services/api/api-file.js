import path from 'path';
import mv from 'mv';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { pathWithRandomSuffix } from '../../lib/random-utils';
import logger from '../../lib/logger';
import DataStorage, { rmDir } from '../../DataStorage';
import store from '../../store';
import { PROTOCOL_TEXT } from '../../controllers/constants';
import { parseLubanGcodeHeader } from '../../lib/parseGcodeHeader';
import { zipFolder, unzipFile } from '../../lib/archive';
import { packFirmware } from '../../lib/firmware-build';
import {
    ERR_INTERNAL_SERVER_ERROR, HEAD_PRINTING, ERR_BAD_REQUEST
} from '../../constants';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, getMachineSeriesWithToolhead, INITIAL_TOOL_HEAD_FOR_ORIGINAL, INITIAL_TOOL_HEAD_FOR_SM2 } from '../../../app/constants';
import { removeSpecialChars } from '../../../shared/lib/utils';
import { generateRandomPathName } from '../../../shared/lib/random-utils';
import { convertFileToSTL } from '../../lib/model-to-stl';

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

function getSeriesPathFromMachineInfo(machineInfo) {
    let currentSeriesPath = '';
    if (machineInfo) {
        const series = machineInfo?.series;
        const headType = machineInfo?.headType;
        const toolHead = machineInfo?.toolHead || (series === 'Original' ? INITIAL_TOOL_HEAD_FOR_ORIGINAL : INITIAL_TOOL_HEAD_FOR_SM2);
        const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
        currentSeriesPath = currentMachine?.configPathname[headType];
    }
    return currentSeriesPath;
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
    const file = req.files.file;
    const headType = req.query.headType;
    try {
        if (file) { // post blob file in web
            let filename = file.name, filePath = file.path, children = [];
            ({ filename, filePath, children = [] } = await convertFileToSTL(file, headType === 'printing'));
            const originalName = removeSpecialChars(path.basename(filename));
            if (!uploadName) {
                uploadName = generateRandomPathName(originalName);
            }
            uploadName = uploadName.toLowerCase();
            children.forEach((item) => {
                item.parentUploadName = uploadName;
            });

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
    const file = req.files.file;
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
 * save editor environment as files, and copy related resource files
 */
export const saveEnv = async (req, res) => {
    const { content } = req.body;
    try {
        const config = JSON.parse(content);
        const machineInfo = config?.machineInfo;
        const headType = machineInfo?.headType;
        const envDir = `${DataStorage.envDir}/${headType}`;
        // TODO: not just remove the category but only change the file when model changed
        rmDir(envDir, false);
        const currentSeriesPath = getSeriesPathFromMachineInfo(machineInfo);
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
            copyFileSync(`${DataStorage.configDir}/${headType}/${currentSeriesPath}/${config.defaultMaterialId}.def.json`, `${envDir}/${config.defaultMaterialId}.def.json`);
        }
        if (machineInfo?.toolHead?.printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && config.defaultMaterialIdRight && /^material.([0-9_]+)$/.test(config.defaultMaterialIdRight)) {
            copyFileSync(`${DataStorage.configDir}/${headType}/${currentSeriesPath}/${config.defaultMaterialIdRight}.def.json`, `${envDir}/${config.defaultMaterialIdRight}.def.json`);
        }
        if (config.defaultQualityId && /^quality.([0-9_]+)$/.test(config.defaultQualityId)) {
            copyFileSync(`${DataStorage.configDir}/${headType}/${currentSeriesPath}/${config.defaultQualityId}.def.json`, `${envDir}/${config.defaultQualityId}.def.json`);
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
 * recover environment saved resource files to tmp dir.
 */
export const recoverEnv = async (req, res) => {
    try {
        const { content } = req.body;
        const config = JSON.parse(content);
        const headType = config?.machineInfo?.headType;
        const envDir = `${DataStorage.envDir}/${headType}`;

        const currentSeriesPath = getSeriesPathFromMachineInfo(config?.machineInfo);


        traverse(config.models, (model) => {
            const { originalName, uploadName } = model;
            copyFileSync(`${envDir}/${originalName}`, `${DataStorage.tmpDir}/${originalName}`);
            copyFileSync(`${envDir}/${uploadName}`, `${DataStorage.tmpDir}/${uploadName}`);
        });


        if (config.defaultMaterialId && /^material.([0-9_]+)$/.test(config.defaultMaterialId)) {
            copyFileSync(`${envDir}/${config.defaultMaterialId}.def.json`, `${DataStorage.configDir}/${headType}/${currentSeriesPath}/${config.defaultMaterialId}.def.json`);
        }
        if (config.machineInfo?.toolHead?.printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && config.defaultMaterialIdRight && /^material.([0-9_]+)$/.test(config.defaultMaterialIdRight)) {
            copyFileSync(`${envDir}/${config.defaultMaterialIdRight}.def.json`, `${DataStorage.configDir}/${headType}/${currentSeriesPath}/${config.defaultMaterialIdRight}.def.json`);
        }
        if (config.defaultQualityId && /^quality.([0-9_]+)$/.test(config.defaultQualityId)) {
            copyFileSync(`${envDir}/${config.defaultQualityId}.def.json`, `${DataStorage.configDir}/${headType}/${currentSeriesPath}/${config.defaultQualityId}.def.json`);
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
    try {
        const file = req.files.file || JSON.parse(req.body.file);
        // const toolHead = JSON.parse(req.body.toolHead);
        file.path = DataStorage.resolveRelativePath(file.path);
        const { uploadName } = await cpFileToTmp(file);
        let content;
        await unzipFile(`${uploadName}`, `${DataStorage.tmpDir}`);
        content = fs.readFileSync(`${DataStorage.tmpDir}/config.json`);

        content = content.toString();
        const config = JSON.parse(content);
        // const currentMachine = getMachineSeriesWithToolhead(config?.machineInfo?.series, toolHead);
        const machineInfo = config?.machineInfo;
        let headType = machineInfo?.headType;
        // TODO: for project file of "< version 4.1"
        if (headType === '3dp') {
            headType = HEAD_PRINTING;
            machineInfo.headType = HEAD_PRINTING;
        }
        const currentSeriesPath = getSeriesPathFromMachineInfo(machineInfo);

        if (config.defaultMaterialId && /^material.([0-9_]+)$/.test(config.defaultMaterialId)) {
            const fname = `${DataStorage.tmpDir}/${config.defaultMaterialId}.def.json`;
            if (fs.existsSync(fname)) {
                fs.copyFileSync(fname, `${DataStorage.configDir}/${headType}/${currentSeriesPath}/${config.defaultMaterialId}.def.json`);
            }
        }
        if (config.defaultQualityId && /^quality.([0-9_]+)$/.test(config.defaultQualityId)) {
            const fname = `${DataStorage.tmpDir}/${config.defaultQualityId}.def.json`;
            if (fs.existsSync(fname)) {
                fs.copyFileSync(fname, `${DataStorage.configDir}/${headType}/${currentSeriesPath}/${config.defaultQualityId}.def.json`);
            }
        }

        res.send({ content, projectPath: file.path });
        res.end();
    } catch (e) {
        log.error(`Failed to recover file: ${e}`);
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: `Failed to recover file: ${e}`
        });
    }
};
