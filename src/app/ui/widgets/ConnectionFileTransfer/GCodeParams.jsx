import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

import { MACHINE_HEAD_TYPE } from '../../../constants';
import { HEAD_PRINTING, isDualExtruder } from '../../../constants/machines';
import i18n from '../../../lib/i18n';
import { humanReadableTime } from '../../../lib/time-utils';

const GCodeParams = (props) => {
    const [gcodeFile, setGcodeFile] = useState({});

    useEffect(() => {
        const toolHead = props.gcodeFile.tool_head;
        const isDualExture = isDualExtruder(toolHead);
        let tmpGcodeFile;
        const defaultGcodeFile = {
            type: { key: i18n._('key-Workspace/GCodeParams-GCode Type'), value: (props.gcodeFile?.type) ? i18n._(MACHINE_HEAD_TYPE[props.gcodeFile.type.toUpperCase()].label) : '' },
            nozzle_temperature: { key: i18n._('key-Workspace/GCodeParams-Nozzle temperature'), value: `${props.gcodeFile.nozzle_temperature}°C` },
            work_speed: { key: i18n._('key-Workspace/GCodeParams-Work speed'), value: `${props.gcodeFile.work_speed}mm/min` },
            estimated_time: { key: i18n._('key-Workspace/GCodeParams-Estimated time'), value: `${humanReadableTime(props.gcodeFile.estimated_time)}` },
        };

        switch (props.gcodeFile.type) {
            case '3dp': {
                tmpGcodeFile = {
                    type: defaultGcodeFile.type,
                    nozzle_temperature: { key: i18n._('key-Workspace/GCodeParams-Left nozzle temperature'), value: `${props.gcodeFile.nozzle_temperature}°C` },
                    nozzle_1_temperature: null,
                    build_plate_temperature: { key: i18n._('key-Workspace/GCodeParams-Build plate temperature'), value: `${props.gcodeFile.build_plate_temperature}°C` },
                    work_speed: defaultGcodeFile.work_speed,
                    estimated_time: defaultGcodeFile.estimated_time,
                    matierial_weight: { key: i18n._('key-Workspace/GCodeParams-Matierial weight'), value: `${(Math.ceil(props.gcodeFile.matierial_weight * 10) / 10).toFixed(1)}g` },
                };
                if (isDualExture) {
                    tmpGcodeFile.nozzle_1_temperature = { key: i18n._('key-Workspace/GCodeParams-Right nozzle temperature'), value: `${props.gcodeFile.nozzle_1_temperature}°C` };
                }
                break;
            }
            case 'laser': {
                tmpGcodeFile = {
                    type: defaultGcodeFile.type,
                    power: { key: i18n._('key-Workspace/GCodeParams-Power'), value: `${props.gcodeFile.power}%` },
                    work_speed: defaultGcodeFile.work_speed,
                    jog_speed: { key: i18n._('key-Workspace/GCodeParams-Jog speed'), value: `${props.gcodeFile.jog_speed}mm/min` },
                    estimated_time: defaultGcodeFile.estimated_time,
                };
                break;
            }
            case 'cnc': {
                tmpGcodeFile = {
                    type: defaultGcodeFile.type,
                    work_speed: defaultGcodeFile.work_speed,
                    jog_speed: { key: i18n._('key-Workspace/GCodeParams-Jog speed'), value: `${props.gcodeFile.jog_speed}mm/min` },
                    estimated_time: defaultGcodeFile.estimated_time,
                };
                break;
            }
            default:
                tmpGcodeFile = {
                    type: { key: i18n._('key-Workspace/GCodeParams-GCode Type'), value: HEAD_PRINTING },
                };
        }

        setGcodeFile(tmpGcodeFile);
    }, [props.gcodeFile]);

    return (
        <div className="position-absolute bottom-16 right-16">
            {Object.keys(gcodeFile).filter(v => v !== 'thumbnail' && !!gcodeFile[v]).map(property => (
                <div key={property} className="margin-top-8">
                    {gcodeFile[property].key}: {gcodeFile[property].value}
                </div>
            ))}
        </div>
    );
};

GCodeParams.propTypes = {
    gcodeFile: PropTypes.object.isRequired,
};
export default GCodeParams;
