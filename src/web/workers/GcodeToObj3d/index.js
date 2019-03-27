import * as THREE from 'three';
import noop from 'lodash/noop';
import bufferGeometryToObj3d from './bufferGeometryToObj3d';
import GcodeToObjPrint3d from './GcodeToObjPrint3d';
import ObjToBufferGeometryPrint3d from './ObjToBufferGeometryPrint3d';
import {
    WEB_CACHE_IMAGE
} from '../../constants';
import cost from '../cost';


/**
 * gcode(string) -> obj(js obj) -> bufferGeometry -> obj3d(THREE.Object3D)
 */
const gcodeToObj3d = async (func, filename, onProgress = noop, onError = noop) => {
    const gcodeFilepath = `${WEB_CACHE_IMAGE}/${filename}`;
    let obj3d = null;
    cost.time('total');
    try {
        cost.time('read file');
        const gcode = await readFile(gcodeFilepath);
        cost.timeEnd('read file');

        switch (func) {
            case '3DP': {
                cost.time('gcode To Obj');
                const gcodeObj = await gcodeToObjPrint3d(
                    gcode,
                    (progress) => {
                        onProgress(progress / 2);
                    });
                cost.timeEnd('gcode To Obj');

                cost.time('Obj to BufferGeometry');
                const { bufferGeometry, layerCount } = await objToBufferGeometryPrint3d(
                    gcodeObj,
                    (progress) => {
                        onProgress(progress / 2 + 0.5);
                    });
                cost.timeEnd('Obj to BufferGeometry');

                cost.time('BufferGeometry to obj3d');
                obj3d = bufferGeometryToObj3d('3DP', bufferGeometry);
                const { bounds } = gcodeObj;
                obj3d.userData = { layerCount, bounds };
                cost.timeEnd('BufferGeometry to obj3d');
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
    cost.timeEnd('total');
    return obj3d;
};

const readFile = (path) => {
    return new Promise((resolve, reject) => {
        new THREE.FileLoader().load(
            path,
            (data) => {
                resolve(data);
            },
            (progress) => {
            },
            (err) => {
                reject(err);
            },
        );
    });
};

// print3d
const gcodeToObjPrint3d = (gcode, onProgress = noop) => {
    return new Promise((resolve, reject) => {
        new GcodeToObjPrint3d().parse(
            gcode,
            (gcodeObj) => {
                resolve(gcodeObj);
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

const objToBufferGeometryPrint3d = (gcodeObj, onProgress = noop) => {
    return new Promise((resolve, reject) => {
        new ObjToBufferGeometryPrint3d().parse(
            gcodeObj,
            (bufferGeometry, layerCount) => {
                resolve({ bufferGeometry, layerCount });
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

export {
    gcodeToObj3d
};
