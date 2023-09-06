import { Box3, Vector3 } from 'three';

import api from '../../api';

export type GCodeFileObject = {
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

    // display
    renderGcodeFileName: string;
};


/**
 * Upload G-code File.
 *
 * Upload only, not add it to list or render it afterwards.
 *
 * In replacement for index.ts:actions.uploadGcodeFile()
 */
const uploadGcodeFile = (file: File) => {
    return async () => {
        const formData = new FormData();

        if (file instanceof File) {
            formData.append('file', file);
        } else {
            return null;
        }

        const res = await api.uploadGcodeFile(formData);

        const response = res.body;
        const header = response.gcodeHeader;

        const gcodeFile: GCodeFileObject = {
            name: file.name,
            uploadName: response.uploadName,
            size: file.size,
            lastModified: +file.lastModified,
            thumbnail: header[';thumbnail'] || '',
            renderGcodeFileName: file.renderGcodeFileName || file.name,
            boundingBox: new Box3(
                new Vector3(
                    header[';min_x(mm)'],
                    header[';min_y(mm)'],
                    header[';min_z(mm)'],
                    // b: header[';min_b(mm)']
                ),
                new Vector3(
                    header[';max_x(mm)'],
                    header[';max_y(mm)'],
                    header[';max_z(mm)'],
                    // b: header[';max_b(mm)'],
                ),
            ),

            type: header[';header_type'],
            tool_head: header[';tool_head'],
            nozzle_temperature: header[';nozzle_temperature(°C)'],
            build_plate_temperature: header[';build_plate_temperature(°C)'],
            work_speed: header[';work_speed(mm/minute)'],
            estimated_time: header[';estimated_time(s)'],
            matierial_weight: header[';matierial_weight'],
            nozzle_1_temperature: header[';nozzle_1_temperature(°C)'],
            jog_speed: header[';jog_speed(mm/minute)'],
            power: header[';power(%)'],
        };

        return gcodeFile;
    };
};

export default {
    uploadGcodeFile,
};
