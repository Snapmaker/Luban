import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { NumberInput } from '../../components/Input';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class Setting extends PureComponent {
    static propTypes = {
        machineSetting: PropTypes.object,
        getMachineSetting: PropTypes.func,
        changeMachineSetting: PropTypes.func,
        executeGcode: PropTypes.func
    };

    state = {
        settingOrigin: {
            xSize: 125,
            ySize: 125,
            zSize: 125,
            xOffset: 0,
            yOffset: 0,
            zOffset: 0,
            xMotorDirection: -1,
            yMotorDirection: -1,
            zMotorDirection: -1,
            xHomeDirection: 1,
            yHomeDirection: 1,
            zHomeDirection: 1
        },
        settingA150: {
            xSize: 167,
            ySize: 169,
            zSize: 150,
            xOffset: 0,
            yOffset: 0,
            zOffset: 0,
            xMotorDirection: -1,
            yMotorDirection: -1,
            zMotorDirection: -1,
            xHomeDirection: 1,
            yHomeDirection: 1,
            zHomeDirection: 1
        },
        settingA250: {
            xSize: 244,
            ySize: 260,
            zSize: 235,
            xOffset: -7,
            yOffset: 0,
            zOffset: 0,
            xMotorDirection: 1,
            yMotorDirection: -1,
            zMotorDirection: -1,
            xHomeDirection: -1,
            yHomeDirection: 1,
            zHomeDirection: 1
        },
        settingA350: {
            xSize: 335,
            ySize: 360,
            zSize: 334,
            xOffset: -9,
            yOffset: 0,
            zOffset: 0,
            xMotorDirection: 1,
            yMotorDirection: -1,
            zMotorDirection: -1,
            xHomeDirection: -1,
            yHomeDirection: 1,
            zHomeDirection: 1
        }
    };

    render() {
        const { machineSetting } = this.props;
        const { xOffset, yOffset, zOffset,
            xSize, ySize, zSize,
            xMotorDirection, yMotorDirection, zMotorDirection,
            xHomeDirection, yHomeDirection, zHomeDirection
        } = machineSetting;

        const { settingOrigin, settingA150, settingA250, settingA350 } = this.state;
        const { changeMachineSetting } = this.props;
        return (
            <div>
                <div>
                    <p>{i18n._('Machine Settings')}</p>
                    <ul style={{ listStyle: 'none' }}>
                        <li>
                            <p className={styles['title-row']}>{i18n._('Size')}</p>
                            <p className={styles['title-row']}>{i18n._('Offset')}</p>
                            <p className={styles['title-row']}>{i18n._('Direction')}</p>
                            <p className={styles['title-row']}>{i18n._('Home Location')}</p>
                        </li>
                        <li>
                            <i className={styles['title-col']}>X</i>
                            <NumberInput
                                className={styles['input-setting']}
                                value={xSize}
                                onChange={(value) => { changeMachineSetting({ xSize: value }); }}
                            />
                            <NumberInput
                                className={styles['input-setting']}
                                value={xOffset}
                                onChange={(value) => { changeMachineSetting({ xOffset: value }); }}
                            />
                            <button className={styles['btn-func']} type="button" onClick={() => { changeMachineSetting({ xMotorDirection: -xMotorDirection }); }}>
                                {xMotorDirection === 1 ? i18n._('Default') : i18n._('Reverse')}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => { changeMachineSetting({ xHomeDirection: -xHomeDirection }); }}>
                                {xHomeDirection === 1 ? i18n._('Zero') : i18n._('Max')}
                            </button>
                        </li>
                        <li>
                            <i className={styles['title-col']}>Y</i>
                            <NumberInput
                                className={styles['input-setting']}
                                value={ySize}
                                onChange={(value) => { changeMachineSetting({ ySize: value }); }}
                            />
                            <NumberInput
                                className={styles['input-setting']}
                                value={yOffset}
                                onChange={(value) => { changeMachineSetting({ yOffset: value }); }}
                            />
                            <button className={styles['btn-func']} type="button" onClick={() => { changeMachineSetting({ yMotorDirection: -yMotorDirection }); }}>
                                {yMotorDirection === 1 ? i18n._('Default') : i18n._('Reverse')}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => { changeMachineSetting({ yHomeDirection: -yHomeDirection }); }}>
                                {yHomeDirection === 1 ? i18n._('Zero') : i18n._('Max')}
                            </button>
                        </li>
                        <li>
                            <i className={styles['title-col']}>Z</i>
                            <NumberInput
                                className={styles['input-setting']}
                                value={zSize}
                                onChange={(value) => { changeMachineSetting({ zSize: value }); }}
                            />
                            <NumberInput
                                className={styles['input-setting']}
                                value={zOffset}
                                onChange={(value) => { changeMachineSetting({ zOffset: value }); }}
                            />
                            <button className={styles['btn-func']} type="button" onClick={() => { changeMachineSetting({ zMotorDirection: -zMotorDirection }); }}>
                                {zMotorDirection === 1 ? i18n._('Default') : i18n._('Reverse')}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => { changeMachineSetting({ zHomeDirection: -zHomeDirection }); }}>
                                {zHomeDirection === 1 ? i18n._('Zero') : i18n._('Max')}
                            </button>
                        </li>
                    </ul>
                    <div>
                        <button className={styles['btn-func']} type="button" onClick={() => changeMachineSetting(settingOrigin)}>Origin</button>
                        <button className={styles['btn-func']} type="button" onClick={() => changeMachineSetting(settingA150)}>A150</button>
                        <button className={styles['btn-func']} type="button" onClick={() => changeMachineSetting(settingA250)}>A250</button>
                        <button className={styles['btn-func']} type="button" onClick={() => changeMachineSetting(settingA350)}>A350</button>
                    </div>
                    <div>
                        <button className={styles['btn-func']} style={{ height: '100px' }} type="button" onClick={() => this.props.executeGcode('M1011 S1')}>
                            Enable Filament Sensor
                        </button>
                        <button className={styles['btn-func']} style={{ height: '100px' }} type="button" onClick={() => this.props.executeGcode('M1011 S0')}>
                            Disable Filament Sensor
                        </button>
                    </div>
                    <div>
                        <button className={styles['btn-func']} type="button" onClick={() => this.props.getMachineSetting()}>Query</button>
                        <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('set setting', { machineSetting })}>Send</button>
                    </div>
                </div>
            </div>
        );
    }
}

export default Setting;
