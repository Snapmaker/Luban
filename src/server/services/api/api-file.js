import path from 'path';
import mv from 'mv';
import fs from 'fs';
import { pathWithRandomSuffix } from '../../lib/random-utils';
import logger from '../../lib/logger';
import DataStorage, { rmDir } from '../../DataStorage';
import store from '../../store';
import { PROTOCOL_TEXT } from '../../controllers/constants';
import parseGcodeHeader from '../../lib/parseGcodeHeader';


const log = logger('api:file');

export const set = (req, res) => {
    let { uploadName } = req.body;
    const file = req.files.file;
    const originalName = path.basename(file.name);
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
};

export const uploadCaseFile = (req, res) => {
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


export const uploadGcodeFile = (req, res) => {
    const file = req.files.file;
    const port = req.body.port;
    const dataSource = req.body.dataSource || PROTOCOL_TEXT;
    const originalName = path.basename(file.name);
    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;

    mv(file.path, uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalName}`);
        } else {
            const gcodeHeader = parseGcodeHeader(uploadPath);
            res.send({
                originalName,
                uploadName,
                gcodeHeader
            });
            res.end();
        }
    });
    const controller = store.get(`controllers["${port}/${dataSource}"]`);
    if (!controller) {
        return;
    }
    controller.command(null, 'gcode:loadfile', uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${uploadPath}`);
        }
    });
};

export const uploadUpdateFile = (req, res) => {
    const file = req.files.file;
    const port = req.body.port;
    const dataSource = req.body.dataSource || PROTOCOL_TEXT;
    const originalName = path.basename(file.name);
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
 * save editor enviroment as files, and copy related resource files
 */
export const saveEnv = async (req, res) => {
    const { content } = req.body;
    const config = JSON.parse(content);
    const envDir = `${DataStorage.envDir}/${config.headType}`;
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
        const { originalName, uploadName } = model;
        fs.existsSync(`${DataStorage.tmpDir}/${originalName}`)
         && fs.copyFileSync(`${DataStorage.tmpDir}/${originalName}`, `${envDir}/${originalName}`);

        fs.copyFileSync(`${DataStorage.tmpDir}/${uploadName}`, `${envDir}/${uploadName}`);
    });

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
    const envDir = `${DataStorage.envDir}/${config.headType}`;
    config.models.forEach((model) => {
        const { originalName, uploadName } = model;
        fs.existsSync(`${envDir}/${originalName}`)
         && fs.copyFileSync(`${envDir}/${originalName}`, `${DataStorage.tmpDir}/${originalName}`);

        fs.copyFileSync(`${envDir}/${uploadName}`, `${DataStorage.tmpDir}/${uploadName}`);
    });
    res.send({ result: 1 });
    res.end();
};
