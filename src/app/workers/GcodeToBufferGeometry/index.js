import * as THREE from 'three';
import noop from 'lodash/noop';
// import ObjToBufferGeometryPrint3d from './ObjToBufferGeometryPrint3d';
import GcodeToBufferGeometryPrint3d from './GcodeToBufferGeometryPrint3d';
import {
    DATA_PREFIX
} from '../../constants';

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
            },
        );
    });
};

const gcodeToBufferGeometryPrint3d = (gcodeObj, onProgress = noop) => {
    return new Promise((resolve, reject) => {
        new GcodeToBufferGeometryPrint3d().parse(
            gcodeObj,
            (bufferGeometry, layerCount, bounds) => {
                resolve({ bufferGeometry, layerCount, bounds });
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
