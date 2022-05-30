import request from 'superagent';
import Jimp from 'jimp';
import { pathWithRandomSuffix } from './random-utils';
import DataStorage from '../DataStorage';
import { LEVEL_TWO_POWER_LASER_FOR_SM2 } from '../../app/constants';
import connectionManager from '../services/socket/ConnectionManager';
import logger from './logger';

const fs = require('fs');

const log = logger('lib:camera_capture');

/**
 * Server represents HTTP Server on Snapmaker 2.
 */
export const takePhoto = (options) => {
    const { address, index, x, y, z, feedRate, photoQuality } = options;
    log.info(`takePhoto: index=${index}, x=${x}, y=${y}, z=${z}, feedRate=${feedRate}, photoQuality=${photoQuality}`);
    if (connectionManager.protocol === 'SACP') {
        return new Promise((resolve) => {
            const params = {
                index, x: x, y: y, z: z, feedRate
            };
            if (photoQuality >= 0 && photoQuality <= 255) {
                params.photoQuality = photoQuality;
            }
            connectionManager.takePhoto(params, (res) => {
                resolve({
                    res: {
                        text: JSON.stringify(res)
                    }
                });
            });
        });
    } else {
        let api = `http://${address}:8080/api/request_capture_photo`;
        api += `?index=${index}&x=${x}&y=${y}&z=${z}&feedRate=${feedRate}`;
        if (photoQuality >= 0 && photoQuality <= 255) {
            api += `&photoQuality=${photoQuality}`;
        }
        return new Promise((resolve) => {
            request.get(api).end((err, res) => {
                log.debug(`request_capture_photo: ${res}`);
                resolve({
                    res
                });
            });
        });
    }
};

export const getCameraCalibration = (options) => {
    const { address, toolHead } = options;
    log.info(`getCameraCalibration: toolHead=${toolHead}`);
    if (connectionManager.protocol === 'SACP') {
        return new Promise(resolve => {
            connectionManager.getCameraCalibration((matrix) => {
                resolve({
                    res: {
                        text: JSON.stringify(matrix)
                    }
                });
            });
        });
    } else {
        let api;
        if (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
            api = `http://${address}:8080/api/request_10w_laser_camera_calibration`;
        } else {
            api = `http://${address}:8080/api/request_camera_calibration`;
        }

        return new Promise((resolve) => {
            request.get(api).end((err, res) => {
                log.debug(`request_10w_laser_camera_calibration: ${res}`);
                resolve({
                    res
                });
            });
        });
    }
};


export const getPhoto = (options) => {
    const { index, address } = options;
    log.info(`getPhoto: index=${index}`);
    if (connectionManager.protocol === 'SACP') {
        return new Promise(resolve => {
            connectionManager.getPhoto((res) => {
                if (res.success) {
                    resolve({
                        fileName: res.filename
                    });
                } else {
                    resolve({
                        status: 404
                    });
                }
            });
        });
    } else {
        const api = `http://${address}:8080/api/get_camera_image?index=${index}`;
        return new Promise((resolve) => {
            request.get(api).end((err, res) => {
                if (res.status === 404) {
                    resolve({
                        status: res.status
                    });
                } else {
                    let fileName = `img${index}.jpg`;
                    fileName = pathWithRandomSuffix(fileName);
                    fs.writeFile(`${DataStorage.tmpDir}/${fileName}`, res.body, () => {
                        resolve({
                            fileName
                        });
                    });
                }
            });
        });
    }
};

export const calibrationPhoto = (options) => {
    const { address, toolHead } = options;
    log.info(`calibrationPhoto: toolHead=${toolHead}`);
    if (connectionManager.protocol === 'SACP') {
        return new Promise(resolve => {
            connectionManager.getCalibrationPhoto((res) => {
                if (res.success) {
                    const fileName = res.filename;
                    Jimp.read(`${DataStorage.tmpDir}/${fileName}`).then((image) => {
                        const { width, height } = image.bitmap;
                        resolve({
                            fileName,
                            width,
                            height
                        });
                    });
                } else {
                    resolve({
                        status: 404
                    });
                }
            });
        });
    } else {
        let api;
        if (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
            api = `http://${address}:8080/api/v1/10w_laser_camera_calibration_photo`;
        } else {
            api = `http://${address}:8080/api/v1/camera_calibration_photo`;
        }
        return new Promise((resolve) => {
            request.get(api).end((err, res) => {
                let fileName = 'calibration.jpg';
                fileName = pathWithRandomSuffix(fileName);
                fs.writeFile(`${DataStorage.tmpDir}/${fileName}`, res.body, () => {
                    Jimp.read(`${DataStorage.tmpDir}/${fileName}`).then((image) => {
                        const { width, height } = image.bitmap;
                        resolve({
                            fileName,
                            width,
                            height
                        });
                    });
                });
            });
        });
    }
};

export const setMatrix = (options) => {
    const { matrix, address, toolHead } = options;
    log.info(`setMatrix: matrix=${matrix}, toolHead=${toolHead}`);
    if (connectionManager.protocol === 'SACP') {
        return new Promise(resolve => {
            connectionManager.setMatrix({
                matrix: JSON.parse(matrix)
            }, (emptyText) => {
                resolve({
                    res: {
                        text: emptyText
                    }
                });
            });
        });
    } else {
        let api;
        if (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
            api = `http://${address}:8080/api/set_10w_laser_camera_calibration_matrix`;
        } else {
            api = `http://${address}:8080/api/set_camera_calibration_matrix`;
        }
        api += `?matrix=${matrix}`;
        return new Promise((resolve) => {
            request.post(api).end((err, res) => {
                log.debug(`set_10w_laser_camera_calibration_matrix: ${res}`);
                resolve({
                    res
                });
            });
        });
    }
};
