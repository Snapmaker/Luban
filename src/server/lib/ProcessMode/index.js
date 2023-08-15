import { processBW, processCNCGreyscale, processHalftone, processLaserGreyscale, processVector } from './process-image';
import {
    HEAD_LASER,
    PROCESS_MODE_BW,
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_HALFTONE,
    PROCESS_MODE_VECTOR,
    SOURCE_TYPE_SVG,
    SOURCE_TYPE_IMAGE3D,
    SOURCE_TYPE_RASTER
} from '../../constants';

import { MeshProcess } from '../MeshProcess/MeshProcess';

const processImage3d = (modelInfo, onProgress) => {
    console.log('processImage3d');
    const mesh = new MeshProcess(modelInfo, onProgress);
    return mesh.convertToImage();
};

export const processMode = (modelInfo, onProgress) => {
    const { headType, sourceType, mode } = modelInfo;
    if (sourceType === SOURCE_TYPE_RASTER || sourceType === SOURCE_TYPE_SVG) {
        if (mode === PROCESS_MODE_GREYSCALE) {
            if (headType === HEAD_LASER) {
                return processLaserGreyscale(modelInfo, onProgress);
            } else {
                return processCNCGreyscale(modelInfo, onProgress);
            }
        } else if (mode === PROCESS_MODE_BW) {
            return processBW(modelInfo, onProgress);
        } else if (mode === PROCESS_MODE_VECTOR) {
            return processVector(modelInfo, onProgress);
        } else if (mode === PROCESS_MODE_HALFTONE) {
            return processHalftone(modelInfo, onProgress);
        } else {
            return Promise.resolve({
                filename: ''
            });
        }
    } else if (sourceType === SOURCE_TYPE_IMAGE3D) {
        return processImage3d(modelInfo, onProgress);
    } else {
        return Promise.resolve({
            filename: ''
        });
    }
};
