import React from 'react';
import PropTypes from 'prop-types';


const GCodeParams = (props) => {
    // TODO: attributes sort by gcode type
    // 3dp
    let gcodeFile;
    const isDualExture = true;
    switch (props.gcodeFile.type) {
        case '3dp': {
            gcodeFile = {
                type: props.gcodeFile.type,
                work_speed: props.gcodeFile.work_speed,
                estimated_time: props.gcodeFile.estimated_time,

                build_plate_temperature: props.gcodeFile.build_plate_temperature,
                nozzle_temperature: props.gcodeFile.nozzle_temperature,
                matierial_weight: props.gcodeFile.matierial_weight,
            };
            if (isDualExture) {
                gcodeFile.nozzle_1_temperature = props.gcodeFile.nozzle_1_temperature;
            }
            break;
        }
        case 'laser': {
            gcodeFile = {
                type: props.gcodeFile.type,
                work_speed: props.gcodeFile.work_speed,
                estimated_time: props.gcodeFile.estimated_time,

                jog_speed: props.gcodeFile.jog_speed,
                power: props.gcodeFile.power,
            };
            break;
        }
        case 'cnc': {
            gcodeFile = {
                type: props.gcodeFile.type,
                work_speed: props.gcodeFile.work_speed,
                estimated_time: props.gcodeFile.estimated_time,

                jog_speed: props.gcodeFile.jog_speed,
            };
            break;
        }
        default: gcodeFile = {};
    }
    // const gcodeFile = {
    //     type: props.gcodeFile.type,
    //     work_speed: props.gcodeFile.work_speed,
    //     estimated_time: props.gcodeFile.estimated_time,

    //     build_plate_temperature: props.gcodeFile.build_plate_temperature,
    //     nozzle_temperature: props.gcodeFile.nozzle_temperature,
    //     matierial_weight: props.gcodeFile.matierial_weight,
    // };

    return (
        <div className="position-ab bottom-16 right-16">
            {Object.keys(gcodeFile).filter(v => v !== 'thumbnail' && !!v).map(key => (
                <div key={key} className="margin-top-8">
                    {key}: {gcodeFile[key]}
                </div>
            ))}
        </div>
    );
    // const gcodeFile = props.gcodeFile;

    // return (
    //     Object.keys(gcodeFile).filter(v => v !== 'thumbnail' && !!v).map(key => <div>{key}: {JSON.stringify(gcodeFile[key])}</div>)
    // );
};

GCodeParams.propTypes = {
    gcodeFile: PropTypes.object.isRequired,
};
export default GCodeParams;
