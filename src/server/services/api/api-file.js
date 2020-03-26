import path from 'path';
import mv from 'mv';
import fs from 'fs';
import { pathWithRandomSuffix } from '../../lib/random-utils';
import logger from '../../lib/logger';
import DataStorage from '../../DataStorage';
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
