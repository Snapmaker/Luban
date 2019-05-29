import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';

import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import { NumberInput as Input } from '../../components/Input';
import { actions as machineActions } from '../../reducers/machine';
import styles from '../styles.styl';


class LaserPad extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            controller: PropTypes.object.isRequired
        }).isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    state = {
        headPower: 20
    };

    actions = {
        selectHeadPower: (headPower) => {
            // Round to one decimal
            headPower = Math.round(headPower * 10) / 10;
            this.setState({ headPower });
        },
        isLaserOn: () => {
            const controllerState = this.props.state.controller.state;
            return (controllerState.headStatus === 'on');
        },
        toggleToolHead: () => {
            if (!this.actions.isLaserOn()) {
                this.props.executeGcode(`M3 P${this.state.headPower}`);
            } else {
                this.props.executeGcode('M5');
            }
        },
        laserSave: () => {
            // TODO: deal with commands
            controller.command('lasertest:on', this.state.headPower, 1);
            this.props.executeGcode('M500');
        }
    };

    render() {
        const { headPower } = this.state;
        const isLaserOn = this.actions.isLaserOn();
        const currentPower = this.props.state.controller.state.headPower;

        const marks = {
            1: 1,
            5: 5,
            20: 20,
            40: 40,
            60: 60,
            80: 80,
            100: 100
        };

        return (
            <div style={{ margin: '10px 0' }}>
                <table className={styles['parameter-table']} style={{ margin: '10px 0' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '70%', padding: '0 6px' }}>
                                <div>{i18n._('Power')}</div>
                                <div>{currentPower}%</div>
                            </td>
                            <td style={{ width: '30%' }}>
                                <div>
                                    {isLaserOn && (
                                        <button
                                            type="button"
                                            style={{ width: '100%' }}
                                            className="sm-btn-small sm-btn-primary"
                                            onClick={this.actions.toggleToolHead}
                                        >
                                            <i className="fa fa-toggle-on fa-fw" />
                                            <span className="space space-sm" />
                                            {i18n._('ON')}
                                        </button>
                                    )}
                                    {!isLaserOn && (
                                        <button
                                            type="button"
                                            style={{ width: '100%' }}
                                            className="sm-btn-small sm-btn-default"
                                            onClick={this.actions.toggleToolHead}
                                        >
                                            <i className="fa fa-toggle-off fa-fw" />
                                            <span className="space space-sm" />
                                            {i18n._('OFF')}
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table className={styles['parameter-table']} style={{ marginBottom: '20px' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '80%', padding: '0 6px' }}>
                                <Slider
                                    value={headPower}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    marks={marks}
                                    disabled={isLaserOn}
                                    onChange={this.actions.selectHeadPower}
                                />
                            </td>
                            <td style={{ width: '20%' }}>
                                <Input
                                    style={{ width: '100%' }}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    value={headPower}
                                    disabled={isLaserOn}
                                    onChange={this.actions.selectHeadPower}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    className="sm-btn-large sm-btn-primary"
                    style={{ width: '100%' }}
                    onClick={this.actions.laserSave}
                >
                    {i18n._('Save')}
                </button>
            </div>
        );
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};


export default connect(null, mapDispatchToProps)(LaserPad);
