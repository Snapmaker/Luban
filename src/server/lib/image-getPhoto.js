import request from 'superagent';
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
