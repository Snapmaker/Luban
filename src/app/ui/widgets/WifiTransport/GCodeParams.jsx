import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import i18n from '../../../lib/i18n';
import { humanReadableTime } from '../../../lib/time-utils';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, HEAD_UNKNOWN, MACHINE_TOOL_HEADS } from '../../../constants';

const GCodeParams = (props) => {
    const toolHead = useSelector(state => state?.machine?.toolHead);
    const isDualExture = toolHead.printingToolhead === MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].value;


    let gcodeFile;
    const tmpGcodeFile = {
        type: { key: 'key-Workspace/GCodeParams-GCode Type', value: props.gcodeFile.type },
        work_speed: { key: 'key-Workspace/GCodeParams-Work speed', value: `${props.gcodeFile.work_speed}mm/min` },
        estimated_time: { key: 'key-Workspace/GCodeParams-Estimated time', value: `${humanReadableTime(props.gcodeFile.estimated_time)}s` },
    };
    switch (props.gcodeFile.type) {
        case '3dp': {
            gcodeFile = {
                ...tmpGcodeFile,
                build_plate_temperature: { key: 'key-Workspace/GCodeParams-Build plate temperature', value: `${props.gcodeFile.build_plate_temperature}°C` },
                nozzle_temperature: { key: 'key-Workspace/GCodeParams-Nozzle temperature', value: `${props.gcodeFile.nozzle_temperature}°C` },
                matierial_weight: { key: 'key-Workspace/GCodeParams-Matierial length', value: `${props.gcodeFile.matierial_weight}g` },
            };
            if (isDualExture) {
                gcodeFile.nozzle_temperature.key = 'key-Workspace/GCodeParams-Left nozzle temperature';
                gcodeFile.nozzle_1_temperature = { key: 'key-Workspace/GCodeParams-Right nozzle temperature', value: `${props.gcodeFile.nozzle_1_temperature}°C` };
            }
            break;
        }
        case 'laser': {
            gcodeFile = {
                ...tmpGcodeFile,
                jog_speed: { key: 'key-Workspace/GCodeParams-Jog speed', value: `${props.gcodeFile.jog_speed}s` },
                power: { key: 'key-Workspace/GCodeParams-Power', value: `${props.gcodeFile.power}%` },
            };
            break;
        }
        case 'cnc': {
            gcodeFile = {
                ...tmpGcodeFile,
                jog_speed: { key: 'key-Workspace/GCodeParams-Jog speed', value: `${props.gcodeFile.jog_speed}mm/min` },
            };
            break;
        }
        default: gcodeFile = {
            type: { key: 'key-Workspace/GCodeParams-GCode Type', value: HEAD_UNKNOWN },
        };
    }

    return (
        <div className="position-ab bottom-16 right-16">
            {Object.keys(gcodeFile).filter(v => v !== 'thumbnail' && !!v).map(property => (
                <div key={property} className="margin-top-8">
                    {i18n._(gcodeFile[property].key)}: {gcodeFile[property].value}
                </div>
            ))}
        </div>
    );
};

GCodeParams.propTypes = {
    gcodeFile: PropTypes.object.isRequired,
};
export default GCodeParams;
