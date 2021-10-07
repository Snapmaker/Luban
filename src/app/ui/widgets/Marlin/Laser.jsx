import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
import Slider from '../../components/Slider';
import Switch from '../../components/Switch';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import SvgIcon from '../../components/SvgIcon';
import { actions as machineActions } from '../../../flux/machine';
import WorkSpeed from './WorkSpeed';
import {
    CONNECTION_TYPE_WIFI,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING
} from '../../../constants';

class Laser extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,
        laserPower: PropTypes.number,
        workflowStatus: PropTypes.string,
        connectionType: PropTypes.string,
        server: PropTypes.object,
        isConnected: PropTypes.bool,
        toolHead: PropTypes.object,

        executeGcode: PropTypes.func.isRequired
    };

    state = {
        laserPowerOpen: this.props.headStatus,
        laserPower: this.props.laserPower || 1,
        laserPowerMarks: {
            0: 0,
            5: 5,
            20: 20,
            40: 40,
            60: 60,
            80: 80,
            100: 100
        }
    };

    actions = {
        isWifiPrinting: () => {
            const { workflowStatus, connectionType } = this.props;
            return _.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus)
                && connectionType === CONNECTION_TYPE_WIFI;
        },
        onChangeLaserPower: (value) => {
            this.setState({
                laserPower: value
            });
        },
        onClickLaserPower: () => {
            if (this.actions.isWifiPrinting()) {
                return;
            }
            if (this.state.laserPowerOpen) {
                this.props.executeGcode('M5');
            } else {
                this.props.executeGcode(`M3 P${this.state.laserPower} S${this.state.laserPower * 255 / 100}`);
                if (this.state.laserPower > 1) {
                    this.props.executeGcode('G4 P500');
                    this.props.executeGcode('M3 P1 S2.55');
                }
            }
            this.setState({
                laserPowerOpen: !this.state.laserPowerOpen
            });
        },
        onSaveLaserPower: () => {
            if (this.actions.isWifiPrinting()) {
                this.props.server.updateLaserPower(this.state.laserPower);
            } else {
                if (this.state.laserPowerOpen) {
                    this.props.executeGcode(`M3 P${this.state.laserPower} S${this.state.laserPower * 255 / 100}`);
                    if (this.state.laserPower > 1) {
                        this.props.executeGcode('G4 P500');
                        this.props.executeGcode('M3 P1 S2.55');
                    }
                } else {
                    this.props.executeGcode(`M3 P${this.state.laserPower} S${this.state.laserPower * 255 / 100}`);
                    this.props.executeGcode('M5');
                }
                this.props.executeGcode('M500');
            }
        }
    };

    getSnapshotBeforeUpdate(prevProps) {
        if (prevProps.isConnected !== this.props.isConnected && this.props.isConnected) {
            if (this.props.toolHead.laserToolhead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                this.setState({
                    laserPower: 1
                });
            }
        }
    }


    render() {
        const { workflowStatus } = this.props;
        const { laserPowerOpen, laserPowerMarks, laserPower } = this.state;
        const actions = this.actions;
        const isWifiPrinting = this.actions.isWifiPrinting();

        return (
            <div>
                {(workflowStatus === WORKFLOW_STATUS_RUNNING || workflowStatus === WORKFLOW_STATUS_PAUSED) && (
                    <WorkSpeed />
                )}
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-unused-Laser Power')}</span>
                    <Switch
                        className="sm-flex-auto"
                        onClick={this.actions.onClickLaserPower}
                        disabled={isWifiPrinting}
                        checked={Boolean(laserPowerOpen)}
                    />
                </div>
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <Slider
                        max={100}
                        min={0}
                        size="middle"
                        className="height-56"
                        marks={laserPowerMarks}
                        value={laserPower}
                        onChange={actions.onChangeLaserPower}
                    />
                    <div className="">
                        <span>{this.props.laserPower}/</span>
                        <Input
                            suffix="%"
                            value={laserPower}
                            max={100}
                            min={0}
                            size="small"
                            onChange={actions.onChangeLaserPower}
                        />
                        <SvgIcon
                            name="Reset"
                            size={24}
                            className="border-default-black-5 margin-left-4 border-radius-8"
                            onClick={actions.onSaveLaserPower}
                            borderRadius={8}
                        />
                    </div>
                </div>
                {laserPower > 1 && (
                    <div className="sm-flex">
                        <SvgIcon
                            name="WarningTipsWarning"
                            size={24}
                            color="#FFA940"
                            onClick={actions.onSaveLaserPower}
                        />
                        <span>The laser power will be reset to 1% after 0.5 s.</span>
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { workflowStatus, connectionType, server, laserPower, headStatus, isConnected, toolHead } = machine;

    return {
        workflowStatus,
        connectionType,
        server,
        laserPower,
        headStatus,
        isConnected,
        toolHead
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Laser);
