import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { NumberInput } from '../../components/Input';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class Calibration extends PureComponent {
    static propTypes = {
        calibrationZOffset: PropTypes.number,
        calibrationMargin: PropTypes.number,
        changeCalibrationZOffset: PropTypes.func,
        changeCalibrationMargin: PropTypes.func,
        executeGcode: PropTypes.func
    };

    actions = {
        gotoCalibrationPoint: (point) => {
            this.props.executeGcode('go to calibration point', { point });
        },
        uploadCalibrationZOffset: (calibrationZOffset) => {
            this.props.executeGcode('G91');
            this.props.executeGcode('change calibration z offset', { calibrationZOffset });
            this.props.executeGcode('G90');
        },
        uploadCalibrationMargin: (calibrationMargin) => {
            this.props.executeGcode('change calibration margin', { calibrationMargin });
        }
    };

    render() {
        const { calibrationZOffset, calibrationMargin } = this.props;
        return (
            <div>
                <div>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('start auto calibration')}>{i18n._('Auto')}</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('start manual calibration')}>{i18n._('Manual')}</button>
                </div>
                <div>
                    <div>
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(7)}>7</button>
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(8)}>8</button>
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(9)}>9</button>
                    </div>
                    <div>
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(4)}>4</button>
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(5)}>5</button>
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(6)}>6</button>
                    </div>
                    <div>
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(1)}>1</button>
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(2)}>2</button>
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(3)}>3</button>
                    </div>
                </div>
                <div>
                    <div>
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.uploadCalibrationZOffset(calibrationZOffset)}>Z+</button>
                        <NumberInput
                            className={styles['input-cal']}
                            value={calibrationZOffset}
                            min={0.05}
                            max={10}
                            onChange={this.props.changeCalibrationZOffset}
                        />
                        <button className={styles['btn-cal']} type="button" onClick={() => this.actions.uploadCalibrationZOffset(-calibrationZOffset)}>Z-</button>
                    </div>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('exit calibration')}>{i18n._('Exit')}</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('save calibration')}>{i18n._('Save')}</button>
                </div>
                <div>
                    <span style={{ margin: '12px 8px 12px 0' }}>{i18n._('Margin')}</span>
                    <NumberInput
                        className={styles['input-cal']}
                        value={calibrationMargin}
                        min={0}
                        max={100}
                        onChange={this.props.changeCalibrationMargin}
                    />
                    <button className={styles['btn-func']} type="button" onClick={() => this.actions.uploadCalibrationMargin(calibrationMargin)}>{i18n._('Set')}</button>
                </div>
            </div>
        );
    }
}

export default Calibration;
