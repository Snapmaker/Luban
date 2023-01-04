import * as THREE from 'three';
import noop from 'lodash/noop';
// import ObjToBufferGeometryPrint3d from './ObjToBufferGeometryPrint3d';
import request from 'superagent';
import GcodeToBufferGeometryPrint3d from './GcodeToBufferGeometryPrint3d';
import { DATA_PREFIX } from '../../constants';

const readFileToListByArrayBuffer = (
    path,
    splitChar = '\n',
    resolve,
    reject
) => {
    request
        .get(path)
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
            let strArr = [];
            let str = '';
            for (const elem of uint8array) {
                if (elem === splitCharCode) {
                    result.push(str + String.fromCharCode.apply(null, strArr));
                    strArr = [];
                    str = '';
                } else {
                    strArr.push(elem);
                    if (strArr.length >= 1023) {
                        str += String.fromCharCode.apply(null, strArr);
                        strArr = [];
                    }
                }
            }
            resolve(result);
        });
};

export const readFileToList = (path, splitChar = '\n') => {
    return new Promise((resolve, reject) => {
        request.get(path).end((err, res) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }
            if (
                res.text.length === 0
                && res.headers['content-length'] > 268435455
            ) {
                readFileToListByArrayBuffer(path, splitChar, resolve, reject);
                return;
            }
            resolve(res.text.split(splitChar));
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
            () => {},
            (err) => {
                reject(err);
            }
        );
    });
};

const gcodeToBufferGeometryPrint3d = (
    gcodeObj,
    extruderColors,
    onProgress = noop
) => {
    return new Promise((resolve, reject) => {
        new GcodeToBufferGeometryPrint3d().parse(
            gcodeObj,
            extruderColors,
            (gcodeEntityLayers, layerCount, bounds) => {
                resolve({
                    gcodeEntityLayers,
                    layerCount,
                    bounds,
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

const gcodeToBufferGeometry = async (
    func,
    filename,
    extruderColors,
    onParsed = noop,
    onProgress = noop,
    onError = noop
) => {
    const gcodeFilepath = `${DATA_PREFIX}/${filename}`;
    let result = null;
    try {
        const gcode = await readFile(gcodeFilepath);
        switch (func) {
            case '3DP': {
                const { gcodeEntityLayers, layerCount, bounds } = await gcodeToBufferGeometryPrint3d(
                    gcode,
                    extruderColors,
                    (progress) => {
                        onProgress((progress / 4) * 3 + 0.25);
                    }
                );
                result = {
                    gcodeEntityLayers,
                    layerCount,
                    bounds,
                    gcode,
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
    onParsed(result);
};

export { gcodeToBufferGeometry };
