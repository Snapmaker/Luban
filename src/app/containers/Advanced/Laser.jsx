import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { NumberInput } from '../../components/Input';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class CNC extends PureComponent {
    static propTypes = {
        laserState: PropTypes.object,
        onchangeFocusHeight: PropTypes.func,
        onchangeLaserPrecent: PropTypes.func,
        onchangeLaserState: PropTypes.func,
        // laserFocusHeight: PropTypes.number,
        executeGcode: PropTypes.func
        // laserPercent: PropTypes.number
    };

    state = {
    };

    actions = {
    }

    render() {
        const { laserState } = this.props;
        const { onchangeLaserPrecent, onchangeFocusHeight, onchangeLaserState } = this.props;
        const { laserPercent, focusHeight, txtFocusX, txtFocusY, txtFocusZ, txtMovementX, txtMovementY, txtMovementZ, relativeMode } = laserState;
        return (
            <div>
                <div>
                    <p>{i18n._('Laser')}</p>
                    <ul style={{ listStyle: 'none' }}>
                        <li>
                            <p className={styles['title-row']}>{i18n._('Current Power')}:</p>
                            <p className={styles['title-row']}>{laserPercent}%</p>
                        </li>
                        <li>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode(`M3 P${laserPercent} S${laserPercent * 255 / 100}`)}>
                                {i18n._('On')}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('M5')}>
                                {i18n._('Off')}
                            </button>
                        </li>
                        <li>
                            <NumberInput
                                className={styles['input-setting']}
                                value={laserPercent}
                                onChange={onchangeLaserPrecent}
                            />
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode(`M3 P${laserPercent} S${laserPercent * 255 / 100}`)}>
                                {i18n._('Set Power')}
                            </button>
                        </li>

                        <li>
                            <div>
                                {/* <i>current: {controllerState.laserFocusHeight | 0}</i> */}
                            </div>
                            <NumberInput
                                className={styles['input-setting']}
                                value={focusHeight}
                                onChange={onchangeFocusHeight}
                            />
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('get laser focus')}>
                                {i18n._('Get Z Focus')}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('set laser focus', { focusHeight })}>
                                {i18n._('Set Z Focus')}
                            </button>
                        </li>
                        <li>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('draw calibration')}>
                                {i18n._('Draw Bound')}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('draw ruler')}>
                                {i18n._('Draw Ruler')}
                            </button>
                        </li>
                        <li>
                            <NumberInput
                                className={styles['input-setting']}
                                value={txtFocusX}
                                onChange={(value) => { onchangeLaserState({ txtFocusX: value }); }}
                            />
                            <NumberInput
                                className={styles['input-setting']}
                                value={txtFocusY}
                                onChange={(value) => { onchangeLaserState({ txtFocusY: value }); }}
                            />
                            <NumberInput
                                className={styles['input-setting']}
                                value={txtFocusZ}
                                onChange={(value) => { onchangeLaserState({ txtFocusZ: value }); }}
                            />
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('enter set focus', { laserState })}>
                                {i18n._('Enter Set Focus')}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('G92 X0 Y0')}>
                                {i18n._('Set Origin')}
                            </button>
                        </li>
                        <li>
                            <NumberInput
                                className={styles['input-setting']}
                                value={txtMovementX}
                                onChange={(value) => { onchangeLaserState({ txtMovementX: value }); }}
                            />
                            <NumberInput
                                className={styles['input-setting']}
                                value={txtMovementY}
                                onChange={(value) => { onchangeLaserState({ txtMovementY: value }); }}
                            />
                            <NumberInput
                                className={styles['input-setting']}
                                value={txtMovementZ}
                                onChange={(value) => { onchangeLaserState({ txtMovementZ: value }); }}
                            />
                            <button className={styles['btn-func']} type="button" onClick={() => { onchangeLaserState({ relativeMode: !relativeMode }); }}>
                                {relativeMode ? i18n._('Relative coordinates') : i18n._('Absolute coordinates')}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('laser move require', { laserState })}>
                                {i18n._('Move Require')}
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        );
    }
}

export default CNC;
