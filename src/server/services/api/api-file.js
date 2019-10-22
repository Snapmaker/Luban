import fs from 'fs';
import path from 'path';
import mv from 'mv';
import { pathWithRandomSuffix } from '../../lib/random-utils';
import logger from '../../lib/logger';
import DataStorage from '../../DataStorage';
import store from '../../store';
import { PROTOCOL_TEXT } from '../../controllers/constants';

const log = logger('api:file');

export const set = (req, res) => {
    const file = req.files.file;
    const originalName = path.basename(file.name);
    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
    mv(file.path, uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalName}`);
        } else {
            res.send({
                originalName: originalName,
                uploadName: uploadName
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
            const gcode = fs.readFileSync(uploadPath, 'utf-8');
            const start = gcode.indexOf(';Header Start');
            const end = gcode.indexOf(';Header End');
            const gcodeHeader = start > -1 && end > start ? gcode.substring(start + 14, end) : '';
            res.send({
                originalName: originalName,
                uploadName: uploadName,
                gcodeHeader: gcodeHeader
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
                originalName: originalName,
                uploadName: uploadName
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
