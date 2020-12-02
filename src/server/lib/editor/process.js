import { processBW, processCNCGreyscale, processHalftone, processLaserGreyscale, processVector } from './image-process';
import {
    PROCESS_MODE_BW,
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_HALFTONE,
    PROCESS_MODE_VECTOR,
    SOURCE_TYPE_DXF,
    SOURCE_TYPE_IMAGE3D,
    SOURCE_TYPE_RASTER
} from '../../constants';
import { processDxf } from './dxf-process';
import { MeshProcess } from '../MeshProcess/MeshProcess';

const processImage3d = (modelInfo) => {
    const mesh = new MeshProcess(modelInfo);
    return mesh.convertToImage();
};

export const editorProcess = (modelInfo) => {
    const { headType, sourceType, mode } = modelInfo;

    if (sourceType === SOURCE_TYPE_RASTER) {
        if (mode === PROCESS_MODE_GREYSCALE) {
            if (headType === 'laser') {
                return processLaserGreyscale(modelInfo);
            } else {
                return processCNCGreyscale(modelInfo);
            }
        } else if (mode === PROCESS_MODE_BW) {
            return processBW(modelInfo);
        } else if (mode === PROCESS_MODE_VECTOR) {
            return processVector(modelInfo);
        } else if (mode === PROCESS_MODE_HALFTONE) {
            return processHalftone(modelInfo);
        } else {
            return Promise.resolve({
                filename: ''
            });
        }
    } else if (sourceType === SOURCE_TYPE_DXF) {
        return processDxf(modelInfo);
    } else if (sourceType === SOURCE_TYPE_IMAGE3D) {
        return processImage3d(modelInfo);
    } else {
        return Promise.resolve({
            filename: ''
        });
    }
};
