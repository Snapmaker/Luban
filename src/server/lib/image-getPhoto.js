import request from 'superagent';
import Jimp from 'jimp';
import { pathWithRandomSuffix } from './random-utils';
import DataStorage from '../DataStorage';

const fs = require('fs');

/**
 * Server represents HTTP Server on Snapmaker 2.
 */
export const takePhoto = (options) => {
    const { address, index, x, y, z, feedRate } = options;
    let api = `http://${address}:8080/api/request_capture_photo`;
    api += `?index=${index}&x=${x}&y=${y}&z=${z}&feedRate=${feedRate}`;
    return new Promise((resolve) => {
        request.get(api).end((err, res) => {
            resolve({
                res
            });
        });
    });
};

export const getCameraCalibration = (options) => {
    const { address } = options;
    const api = `http://${address}:8080/api/request_camera_calibration`;

    return new Promise((resolve) => {
        request.get(api).end((err, res) => {
            resolve({
                res
            });
        });
    });
};


export const getPhoto = (options) => {
    const { index, address } = options;
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
};

export const calibrationPhoto = (options) => {
    const { address } = options;
    const api = `http://${address}:8080/api/v1/camera_calibration_photo`;
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
};

export const setMatrix = (options) => {
    const { matrix, address } = options;
    console.log('setMatrix>>>>', matrix, address);
    let api = `http://${address}:8080/api/set_camera_calibration_matrix`;
    api += `?matrix=${matrix}`;
    return new Promise((resolve) => {
        request.post(api).end((err, res) => {
            resolve({
                res
            });
        });
    });
};
