import { Box3 } from 'three';

export interface AxisWorkRange {
    min: {
        x: number;
        y: number;
        z: number;
        a?: number;
        b: number;
    };
    max: {
        x: number;
        y: number;
        z: number;
        a?: number;
        b: number;
    };
}

/**
 * G-code metadata.
 */
export type GCodeFileMetadata = {
    // file
    name: string;
    uploadName: string;
    size: number;
    lastModified: number;

    // job metadata
    boundingBox: Box3,
    estimatedTime?: number;
    // eslint-disable-next-line camelcase
    estimated_time?: number;

    thumbnail: string;
    type: string;
    // eslint-disable-next-line camelcase
    tool_head?: string;

    // eslint-disable-next-line camelcase
    jog_speed: number;
    // eslint-disable-next-line camelcase
    work_speed: number;

    // 3dp
    // eslint-disable-next-line camelcase
    nozzle_temperature?: number;
    // eslint-disable-next-line camelcase
    nozzle_1_temperature?: number;
    // eslint-disable-next-line camelcase
    build_plate_temperature?: number;
    // eslint-disable-next-line camelcase
    matierial_weight?: number;

    // laser
    power?: number;
    // eslint-disable-next-line camelcase
    is_rotate?: boolean
    // eslint-disable-next-line camelcase
    gcodeAxisWorkRange?: AxisWorkRange;

    // display
    renderGcodeFileName: string;

};
