import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import styles from './index.styl';
import {
    TEMPERATURE_MIN,
    TEMPERATURE_MAX
} from './constants';

const Temperature = (props) => {
    const { state, actions } = props;
    const { extruderTemperature, heatBedTemperature, canClick } = state;

    return (
        <div className={styles['temperature-controls']}>
            <div className={styles['row-space']} />
            <div className="row no-gutters">
                <span style={{ margin: '0 0 6px 48px' }}>{i18n._('Set Nozzle Temperature')}</span>
                <input
                    style={{ margin: '0 0 6px 22px', width: '45px' }}
                    value={extruderTemperature}
                    min={TEMPERATURE_MIN}
                    max={TEMPERATURE_MAX}
                    onChange={(event) => {
                        const extruderTemperature = event.target.value;
                        actions.changeExtruderTemperature(extruderTemperature);
                        controller.command('gcode', `M104 S${extruderTemperature}`);
                    }}
                    disabled={!canClick}
                />
            </div>
            <div className="row no-gutters">
                <span style={{ margin: '0 0 6px 48px' }}>{i18n._('Set HeatBed Temperature')}</span>
                <input
                    style={{ margin: '0 0 6px 12px', width: '45px' }}
                    value={heatBedTemperature}
                    min={TEMPERATURE_MIN}
                    max={TEMPERATURE_MAX}
                    onChange={(event) => {
                        const heatBedTemperature = event.target.value;
                        actions.changeHeatBedTemperature(heatBedTemperature);
                        controller.command('gcode', `M140 S${heatBedTemperature}`);
                    }}
                    disabled={!canClick}
                />
            </div>
        </div>
    );
};

Temperature.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Temperature;
