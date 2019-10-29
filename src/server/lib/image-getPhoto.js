import request from 'superagent';
import { pathWithRandomSuffix } from './random-utils';
import DataStorage from '../DataStorage';

const fs = require('fs');
/**
 * Server represents HTTP Server on Snapmaker 2.
 */
export const takePhoto = (options) => {
    const { path, index, x, y } = options;
    let api = `http://192.168.1.100:8080/api/${path}`;
    if (path === 'request_capture_photo') {
        api += '?';
    }
    if (index | x | y) {
        api += `&index=${index}&x=${x}&y=${y}`;
    }
    return new Promise((resolve) => {
        request.get(api).end((err, res) => {
            resolve({
                res
            });
        });
    });
};

export const getPhoto = (options) => {
    const { index } = options;
    const api = `http://192.168.1.100:8080/api/get_camera_image?index=${index}`;
    // console.log(`${this.host}/api/get_camera_image?index=${index}`);
    return new Promise((resolve) => {
        request.get(api).end((err, res) => {
            let fileName = `img${index}.jpg`;
            fileName = pathWithRandomSuffix(fileName);
            fs.writeFile(`${DataStorage.tmpDir}/${fileName}`, res.body, () => {
                resolve({
                    fileName
                });
            });
        });
    });
};
