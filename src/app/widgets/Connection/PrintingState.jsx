import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';

import styles from './index.styl';

class PrintingState extends PureComponent {
    static propTypes = {
        nozzleTemperature: PropTypes.number.isRequired,
        nozzleTargetTemperature: PropTypes.number.isRequired,
        heatedBedTemperature: PropTypes.number.isRequired,
        heatedBedTargetTemperature: PropTypes.number.isRequired
    };


    render() {
        const { nozzleTemperature, nozzleTargetTemperature, heatedBedTemperature, heatedBedTargetTemperature } = this.props;
        return (
            <div>
                <div
                    style={{
                        width: '40%'
                    }}
                />
                <div className="row">
                    <div
                        className="col-xs-6"
                        style={{
                            borderRight: '1px solid #c8c8c8'
                        }}
                    >
                        <div className={styles['color-grey-color']}>{i18n._('Nozzle Temp')}</div>
                        <div>{nozzleTemperature}°C / {nozzleTargetTemperature}°C</div>
                    </div>
                    <div className="col-xs-6">
                        <div className={styles['color-grey-color']}>{i18n._('Heated Bed Temp')}</div>
                        <div>{heatedBedTemperature}°C / {heatedBedTargetTemperature}°C</div>
                    </div>
                </div>
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const machine = state.machine;
    const { nozzleTemperature, nozzleTargetTemperature, heatedBedTemperature, heatedBedTargetTemperature } = machine;

    return {
        nozzleTemperature,
        nozzleTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature
    };
};

export default connect(mapStateToProps)(PrintingState);
