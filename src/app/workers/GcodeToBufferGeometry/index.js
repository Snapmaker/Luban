import * as THREE from 'three';
import noop from 'lodash/noop';
// import ObjToBufferGeometryPrint3d from './ObjToBufferGeometryPrint3d';
import request from 'superagent';
import GcodeToBufferGeometryPrint3d from './GcodeToBufferGeometryPrint3d';
import {
    DATA_PREFIX
} from '../../constants';

export const readFileToList = (path, splitChar = '\n') => {
    return new Promise((resolve, reject) => {
        request.get(path)
            .responseType('arraybuffer')
            .end((err, res) => {
                if (err) {
                    console.error(err);
                    reject(err);
                    return;
                }
                const uint8array = new Uint8Array(res.body);
                const splitCharCode = splitChar.charCodeAt(0);

                const result = [];
                let str = [];
                for (const elem of uint8array) {
                    if (elem === splitCharCode) {
                        result.push(String.fromCharCode.apply(null, str));
                        str = [];
                    } else {
                        str.push(elem);
                    }
                }
                resolve(result);
            });
    });
};

export const readFile = (path) => {
    return new Promise((resolve, reject) => {
        new THREE.FileLoader().load(
            path,
            (data) => {
                resolve(data);
            },
            () => {
            },
            (err) => {
                reject(err);
            }
        );
    });
};

const gcodeToBufferGeometryPrint3d = (gcodeObj, onProgress = noop) => {
    return new Promise((resolve, reject) => {
        new GcodeToBufferGeometryPrint3d().parse(
            gcodeObj,
            (bufferGeometry, layerCount, bounds) => {
                resolve({
                    bufferGeometry,
                    layerCount,
                    bounds
                });
            },
            (progress) => {
                onProgress(progress);
            },
            (err) => {
                reject(err);
            }
        );
    });
};

const gcodeToBufferGeometry = async (func, filename, onProgress = noop, onError = noop) => {
    const gcodeFilepath = `${DATA_PREFIX}/${filename}`;
    let result = null;
    try {
        const gcode = await readFile(gcodeFilepath);
        switch (func) {
            case '3DP': {
                const { bufferGeometry, layerCount, bounds } = await gcodeToBufferGeometryPrint3d(
                    gcode,
                    (progress) => {
                        onProgress(progress / 4 * 3 + 0.25);
                    }
                );
                result = {
                    bufferGeometry,
                    layerCount,
                    bounds
                };
                break;
            }
            case 'LASER':
                break;
            case 'CNC':
                break;
            default:
                break;
        }
    } catch (err) {
        onError(err);
    }
    return result;
};

export {
    gcodeToBufferGeometry
};
