import React, { PureComponent } from 'react';
import classNames from 'classnames';
import Slider from 'rc-slider';

import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import styles from '../styles.styl';


class LaserPad extends PureComponent {
    state = {
        focusPower: 6,
        power: 20
    };

    actions = {
        selectFocusPower: (focusPower) => {
            this.setState({ focusPower });
        },
        selectPower: (power) => {
            this.setState({ power });
        },
        laserFocus: () => {
            controller.command('laser:on', this.state.focusPower);
        },
        laserSet: () => {
            controller.command('lasertest:on', this.state.power, 1);
        },
        laserSave: () => {
            controller.command('lasertest:on', this.state.power, 1);
            controller.command('gcode', 'M500');
        }
    };

    render() {
        return (
            <React.Fragment>
                <p style={{ margin: '20px 0 0' }}><b>{i18n._('Focus Power (%)')}</b></p>
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '50%', paddingRight: '5%' }}>
                                <Slider
                                    value={this.state.focusPower}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    onChange={this.actions.selectFocusPower}
                                />
                            </td>
                            <td style={{ width: '25%' }}>
                                <Input
                                    style={{ width: '100%' }}
                                    min={1}
                                    max={100}
                                    value={this.state.focusPower}
                                    onChange={this.actions.selectFocusPower}
                                />
                            </td>
                            <td style={{ width: '25%' }}>
                                <button
                                    type="button"
                                    style={{ width: '100%' }}
                                    className={classNames(styles.btn, styles['btn-default'])}
                                    onClick={this.actions.laserFocus}
                                >
                                    {i18n._('Focus')}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <p style={{ margin: '20px 0 0' }}><b>{i18n._('Working Power (%)')}</b></p>
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '50%', paddingRight: '5%' }}>
                                <Slider
                                    value={this.state.power}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    onChange={this.actions.selectPower}
                                />
                            </td>
                            <td style={{ width: '25%' }}>
                                <Input
                                    style={{ width: '100%' }}
                                    min={1}
                                    max={100}
                                    value={this.state.power}
                                    onChange={this.actions.selectPower}
                                />
                            </td>
                            <td style={{ width: '25%' }}>
                                <button
                                    type="button"
                                    style={{ width: '100%' }}
                                    className={classNames(styles.btn, styles['btn-default'])}
                                    onClick={this.actions.laserSet}
                                >
                                    {i18n._('Set')}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    style={{ margin: '10px 0 0', width: '100%' }}
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.laserSave}
                >
                    {i18n._('Save')}
                </button>
            </React.Fragment>
        );
    }
}

export default LaserPad;
