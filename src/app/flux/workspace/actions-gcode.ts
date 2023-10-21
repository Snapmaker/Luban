import { Box3, Vector3 } from 'three';

import api from '../../api';
import { GCodeFileMetadata } from './types';
import baseActions from './actions-base';

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

        const gcodeFile: GCodeFileMetadata = {
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

/**
 * 1. Add G-code info to G-code list.
 * 2. Update state (boundingBox)
 */
const addGCodeFile = (fileInfo: GCodeFileMetadata) => (dispatch, getState) => {
    const { gcodeFiles } = getState().workspace;

    const files = [];
    fileInfo.isRenaming = false;
    fileInfo.newName = fileInfo.name;
    files.push(fileInfo);

    let added = 1, i = 0;
    while (added < 5 && i < gcodeFiles.length) {
        const gcodeFile = gcodeFiles[i];
        // G-code file with the same uploadName will be replaced with current one
        if (gcodeFile.uploadName !== fileInfo.uploadName) {
            files.push(gcodeFile);
            added++;
        }
        i++;
    }

    dispatch(
        baseActions.updateState({
            gcodeFiles: files,
        })
    );

    // TODO: Remove this?
    if (fileInfo.boundingBox) {
        dispatch(
            baseActions.updateState({
                boundingBox: new Box3(
                    new Vector3().copy(fileInfo.boundingBox.min),
                    new Vector3().copy(fileInfo.boundingBox.max),
                ),
            })
        );
    }
};

const render = () => {
    return (dispatch) => {
        dispatch(
            baseActions.updateState({
                renderingTimestamp: +new Date(),
            })
        );
    };
};

export default {
    uploadGcodeFile,
    addGCodeFile,

    // G-code render
    render,
};
