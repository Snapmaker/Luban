import request from 'superagent';
import { pathWithRandomSuffix } from './random-utils';
import DataStorage from '../DataStorage';

const fs = require('fs');
/**
 * Server represents HTTP Server on Snapmaker 2.
 */
export const takePhoto = function (options) {
    const { path, ...param } = options;
    let api = `http://192.168.1.100:8080/api/${path}`;
    if (param) {
        api += '?';
        Object.keys(param).forEach((item) => {
            api += `&${item}=${param[item]}`;
        });
    }
    return new Promise((resolve) => {
        request.get(api).end((err, res) => {
            // console.log('get>>>>>>>', res.body);
            resolve({
                res
            });
        });
    });
};

export const getPhoto = function (options) {
    const { index } = options;
    // const {index, path} = options;
    // console.log('in getPhoto', index);
    // const api = `http://172.18.1.78:8080/api/${path}?index=${index}`;
    const api = `http://192.168.1.100:8080/api/get_camera_image?index=${index}`;
    // const api = `${this.host}/api/get_camera_image?index=${index}`;
    return new Promise((resolve) => {
        // const filename = 'stitched.jpg';
        // console.log('in Promise', api);
        request.get(api).end((err, res) => {
            // console.log(`get>>>>>>>>>>>${this.host}`, this.host);
            // console.log(`takePhoto>>>>>>>>>>>`, this);
            let fileName = `img${index}.jpg`;
            fileName = pathWithRandomSuffix(fileName);
            // console.log('in end', fileName);
            fs.writeFile(`${DataStorage.tmpDir}/${fileName}`, res.body, () => {
                resolve({
                    fileName
                });
            });
        });
    });
};
