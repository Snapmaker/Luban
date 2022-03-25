import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
import Slider from '../../components/Slider';
import Switch from '../../components/Switch';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import SvgIcon from '../../components/SvgIcon';
import WorkSpeed from './WorkSpeed';
import {
    CONNECTION_TYPE_WIFI,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_RUNNING, CONNECTION_TYPE_SERIAL, CONNECTION_LASER_POWER,
    CONNECTION_SWITCH_LASER_POWER,
} from '../../../constants';
import { controller } from '../../../lib/controller';

class Laser extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,
        laserPower: PropTypes.number,
        workflowStatus: PropTypes.string,
        workflowState: PropTypes.string,
        connectionType: PropTypes.string,
        isConnected: PropTypes.bool,
        toolHead: PropTypes.string,
    };

    state = {
        laserPowerOpen: this.props.headStatus,
        laserPower: this.props.laserPower || 1,
        laserPowerMarks: {
            0: 0,
            // 5: 5,
            // 20: 20,
            // 40: 40,
            // 60: 60,
            // 80: 80,
            100: 100
        }
    };

    actions = {
        isPrinting: () => {
            const { workflowStatus, workflowState, connectionType } = this.props;
            return (_.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus) && connectionType === CONNECTION_TYPE_WIFI)
                || (_.includes([WORKFLOW_STATE_PAUSED, WORKFLOW_STATE_RUNNING], workflowState) && connectionType === CONNECTION_TYPE_SERIAL);
        },
        onChangeLaserPower: (value) => {
            this.setState({
                laserPower: value
            });
        },
        onClickLaserPower: () => {
            if (this.actions.isPrinting()) {
                return;
            }
            controller.emitEvent(CONNECTION_SWITCH_LASER_POWER, {
                isSM2: this.props.toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2,
                laserPower: this.state.laserPower,
                laserPowerOpen: this.state.laserPowerOpen
            });
            this.setState({
                laserPowerOpen: !this.state.laserPowerOpen
            });
        },
        onSaveLaserPower: () => {
            controller.emitEvent(CONNECTION_LASER_POWER, {
                isPrinting: this.actions.isPrinting(),
                laserPower: this.state.laserPower,
                laserPowerOpen: this.state.laserPowerOpen
            });
        }
    };

    getSnapshotBeforeUpdate(prevProps) {
        if (prevProps.isConnected !== this.props.isConnected && this.props.isConnected) {
            if (this.props.toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                this.setState({
                    laserPower: 1
                });
            }
        }
        return prevProps;
    }

    componentDidUpdate() {

    }


    render() {
        const { laserPowerOpen, laserPowerMarks, laserPower } = this.state;
        const { toolHead } = this.props;
        const actions = this.actions;
        const isPrinting = this.actions.isPrinting();

        return (
            <div>
                {isPrinting && <WorkSpeed />}
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-unused-Laser Power')}</span>
                    {!isPrinting && (
                        <Switch
                            className="sm-flex-auto"
                            onClick={this.actions.onClickLaserPower}
                            checked={Boolean(laserPowerOpen)}
                        />
                    )}
                </div>
                {(toolHead !== LEVEL_TWO_POWER_LASER_FOR_SM2
                    || (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2 && isPrinting)) && (
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
                        <div className="sm-flex">
                            <div className="height-32 margin-right-4">
                                <span>{this.props.laserPower}/</span>
                                <Input
                                    suffix="%"
                                    value={laserPower}
                                    max={100}
                                    min={0}
                                    size="small"
                                    onChange={actions.onChangeLaserPower}
                                />
                            </div>
                            <div className="height-only-32 width-32 sm-flex-auto">
                                <SvgIcon
                                    name="Reset"
                                    hoversize={30}
                                    className="border-default-black-5 border-radius-8"
                                    onClick={actions.onSaveLaserPower}
                                    size={24}
                                    borderRadius={8}
                                />
                            </div>
                        </div>
                    </div>
                )}
                {!isPrinting && this.props.toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2 && (
                    <div className="sm-flex">
                        <SvgIcon
                            name="WarningTipsWarning"
                            color="#FFA940"
                            type={['static']}
                            onClick={() => {}}
                        />
                        <span>{i18n._('key-Workspace/Laser-high_power_tips')}</span>
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { workflowStatus, workflowState, connectionType, laserPower, headStatus, isConnected } = machine;
    const { toolHead } = state.workspace;

    return {
        workflowStatus,
        workflowState,
        connectionType,
        laserPower,
        headStatus,
        isConnected,
        toolHead
    };
};


export default connect(mapStateToProps, null)(Laser);
