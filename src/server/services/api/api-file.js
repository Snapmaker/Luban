import path from 'path';
import mv from 'mv';
import fs from 'fs';
import uuid from 'uuid';
import { pathWithRandomSuffix } from '../../lib/random-utils';
import logger from '../../lib/logger';
import DataStorage, { rmDir } from '../../DataStorage';
import store from '../../store';
import { PROTOCOL_TEXT } from '../../controllers/constants';
import { parseLubanGcodeHeader } from '../../lib/parseGcodeHeader';
import { zipFolder, unzipFile } from '../../lib/archive';
import { packFirmware } from '../../lib/firmware-build';
import {
    ERR_INTERNAL_SERVER_ERROR
} from '../../constants';
import { removeSpecialChars } from '../../../shared/lib/utils';

const log = logger('api:file');

function copyFileSync(src, dst) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
    }
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
    if (file) { // post blob file in web
        const originalName = removeSpecialChars(path.basename(file.name));
        if (!uploadName) {
            uploadName = pathWithRandomSuffix(originalName);
        }
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
    } else { // post file pathname in electron
        const ret = await cpFileToTmp(JSON.parse(req.body.file));
        res.send(ret);
        res.end();
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
                res.status(ERR_INTERNAL_SERVER_ERROR).send({
                    msg: 'Unable to build package',
                    error: String(err)
                });
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
        uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
        mv(originalPath, uploadPath, (err) => {
            if (err) {
                log.error(`Failed to upload file ${originalName} ${err}`);
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
    }

    /*
    const controller = store.get(`controllers["${port}/${dataSource}"]`);
    if (!controller) {
        return;
    }
    controller.command(null, 'gcode:loadfile', uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${uploadPath}`);
        }
    });
    */
};

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
    const config = JSON.parse(content);
    const machineInfo = config.machineInfo;
    const envDir = `${DataStorage.envDir}/${machineInfo.headType}`;
    // TODO: not just remove the category but only change the file when model changed
    rmDir(envDir, false);

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
    config.models.forEach((model) => {
        // why copy all not just 'uploadName'
        const { uploadName } = model;
        // const { originalName, uploadName } = model;

        // copyFileSync(`${DataStorage.tmpDir}/${originalName}`, `${envDir}/${originalName}`);
        copyFileSync(`${DataStorage.tmpDir}/${uploadName}`, `${envDir}/${uploadName}`);
    });
    if (config.defaultMaterialId && /^material.([0-9_]+)$/.test(config.defaultMaterialId)) {
        copyFileSync(`${DataStorage.configDir}/${config.defaultMaterialId}.def.json`, `${envDir}/${config.defaultMaterialId}.def.json`);
    }
    if (config.defaultQualityId && /^quality.([0-9_]+)$/.test(config.defaultQualityId)) {
        copyFileSync(`${DataStorage.configDir}/${config.defaultQualityId}.def.json`, `${envDir}/${config.defaultQualityId}.def.json`);
    }
    res.send(result);
    res.end();
};

/**
 * get environment data from saved file
 */
export const getEnv = async (req, res) => {
    const { headType } = req.body;
    const envDir = `${DataStorage.envDir}/${headType}`;
    const targetPath = `${envDir}/config.json`;
    const exists = fs.existsSync(targetPath);
    if (exists) {
        const content = fs.readFileSync(targetPath).toString();
        res.send({ result: 1, content });
    } else {
        res.send({ result: 0 });
    }
    res.end();
};
/**
 * recover environment saved resource files to tmp dir.
 */
export const recoverEnv = async (req, res) => {
    const { content } = req.body;
    const config = JSON.parse(content);
    const machineInfo = config.machineInfo;
    const envDir = `${DataStorage.envDir}/${machineInfo.headType}`;
    config.models.forEach((model) => {
        const { originalName, uploadName } = model;

        copyFileSync(`${envDir}/${originalName}`, `${DataStorage.tmpDir}/${originalName}`);
        copyFileSync(`${envDir}/${uploadName}`, `${DataStorage.tmpDir}/${uploadName}`);
    });

    if (config.defaultMaterialId && /^material.([0-9_]+)$/.test(config.defaultMaterialId)) {
        copyFileSync(`${envDir}/${config.defaultMaterialId}.def.json`, `${DataStorage.configDir}/${config.defaultMaterialId}.def.json`);
    }
    if (config.defaultQualityId && /^quality.([0-9_]+)$/.test(config.defaultQualityId)) {
        copyFileSync(`${envDir}/${config.defaultQualityId}.def.json`, `${DataStorage.configDir}/${config.defaultQualityId}.def.json`);
    }
    res.send({ result: 1 });
    res.end();
};


/**
 * package environment to zip file
 */
export const packageEnv = async (req, res) => {
    const tails = {
        '3dp': '.snap3dp',
        'laser': '.snaplzr',
        'cnc': '.snapcnc'
    };
    const { headType } = req.body;
    const envDir = `${DataStorage.envDir}/${headType}`;
    // const targetPath = `${envDir}/config.json`;
    // const content = fs.readFileSync(targetPath).toString();
    // const config = JSON.parse(content);

    const targetFile = `${uuid.v4().substring(0, 8)}${tails[headType]}`;
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
    // if (JSON.parse(req.body.file)?.isDatastoragePath) {
    //     file.path = `${DataStorage.userDataDir}${file.path}`;
    // }
    const { uploadName } = await cpFileToTmp(file);
    let content;
    try {
        await unzipFile(`${uploadName}`, `${DataStorage.tmpDir}`);
        content = fs.readFileSync(`${DataStorage.tmpDir}/config.json`);
    } catch (e) {
        log.error(`Failed to read file ${uploadName} and ${e}`);
    }

    content = content.toString();

    const config = JSON.parse(content);
    if (config.defaultMaterialId && /^material.([0-9_]+)$/.test(config.defaultMaterialId)) {
        const fname = `${DataStorage.tmpDir}/${config.defaultMaterialId}.def.json`;
        if (fs.existsSync(fname)) {
            fs.copyFileSync(fname, `${DataStorage.configDir}/${config.defaultMaterialId}.def.json`);
        }
    }
    if (config.defaultQualityId && /^quality.([0-9_]+)$/.test(config.defaultQualityId)) {
        const fname = `${DataStorage.tmpDir}/${config.defaultQualityId}.def.json`;
        if (fs.existsSync(fname)) {
            fs.copyFileSync(fname, `${DataStorage.configDir}/${config.defaultQualityId}.def.json`);
        }
    }

    res.send({ content });
    res.end();
};
