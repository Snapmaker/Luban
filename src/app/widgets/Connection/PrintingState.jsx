import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';

import { MACHINE_HEAD_TYPE } from '../../constants';
import widgetStyles from '../styles.styl';
import styles from './index.styl';

class PrintingState extends PureComponent {
    static propTypes = {
        headType: PropTypes.string,
        isFilamentOut: PropTypes.bool,
        nozzleTemperature: PropTypes.number.isRequired,
        heatedBedTemperature: PropTypes.number.isRequired
    };


    render() {
        const { headType, isFilamentOut, nozzleTemperature, heatedBedTemperature } = this.props;
        const isHeadTYpe = headType === MACHINE_HEAD_TYPE['3DP'].value;
        return (
            <div>
                <div
                    style={{
                        width: '40%'
                    }}
                >
                    <div className={styles['connection-state-head']}>
                        <span className={styles['connection-state-head-name']}>
                            {i18n._('3D Printing')}
                        </span>
                        <span className={styles['connection-state-head-icon']}>
                            <i
                                className="fa fa-circle"
                                aria-hidden="true"
                                style={{
                                    color: isHeadTYpe ? 'lime' : 'gold'
                                }}
                            />
                        </span>
                    </div>
                    <div className={styles['connection-state-head']}>
                        <span className={styles['connection-state-head-name']}>
                            {i18n._('Filament')}
                        </span>
                        <span className={styles['connection-state-head-icon']}>
                            <i
                                className="fa fa-circle"
                                aria-hidden="true"
                                style={{
                                    color: !isFilamentOut ? 'lime' : 'gold'
                                }}
                            />
                        </span>
                    </div>
                </div>
                <div
                    className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])}
                    style={{
                        marginTop: '10px'
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
                        <div>{nozzleTemperature}°C</div>
                    </div>
                    <div className="col-xs-6">
                        <div className={styles['color-grey-color']}>{i18n._('Heated Bed Temp')}</div>
                        <div>{heatedBedTemperature}°C</div>
                    </div>
                </div>
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const machine = state.machine;

    const { nozzleTemperature, heatedBedTemperature, isFilamentOut } = machine;

    return {
        nozzleTemperature,
        heatedBedTemperature,
        isFilamentOut
    };
};

export default connect(mapStateToProps)(PrintingState);
