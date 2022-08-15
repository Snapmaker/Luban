import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { includes, isNil } from 'lodash';
// import Slider from '../../components/Slider';
import Switch from '../../components/Switch';
import i18n from '../../../lib/i18n';
// import { NumberInput as Input } from '../../components/Input';
import SvgIcon from '../../components/SvgIcon';
import WorkSpeed from './WorkSpeed';
import { actions as machineActions } from '../../../flux/machine';
import {
    // CONNECTION_TYPE_WIFI,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    // WORKFLOW_STATE_PAUSED,
    // WORKFLOW_STATE_RUNNING, CONNECTION_TYPE_SERIAL,
    CONNECTION_LASER_POWER,
    CONNECTION_SWITCH_LASER_POWER,
    WORKFLOW_STATUS_PAUSING,
} from '../../../constants';
import { controller } from '../../../lib/controller';
import ParamsWrapper from './ParamsWrapper';

class Laser extends PureComponent {
    static propTypes = {
        laserPower: PropTypes.number,
        workflowStatus: PropTypes.string,
        // workflowState: PropTypes.string,
        // connectionType: PropTypes.string,
        headStatus: PropTypes.bool,
        isConnected: PropTypes.bool,
        toolHead: PropTypes.string,
        addConsoleLogs: PropTypes.func.isRequired,
    };

    state = {
        laserPowerOpen: this.props.headStatus,
        laserPower: this.props.laserPower || 1,
        // laserPowerMarks: {
        //     0: 0,
        //     // 5: 5,
        //     // 20: 20,
        //     // 40: 40,
        //     // 60: 60,
        //     // 80: 80,
        //     100: 100
        // }
    };

    actions = {
        isPrinting: () => {
            const { workflowStatus } = this.props;
            return (includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_PAUSING], workflowStatus));
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
                laserPower: 1,
                laserPowerOpen: this.state.laserPowerOpen
            }).once(CONNECTION_SWITCH_LASER_POWER, (result) => {
                if (result) {
                    this.props.addConsoleLogs(result);
                }
            });
            this.setState({
                laserPowerOpen: !this.state.laserPowerOpen
            });
        },
        onSaveLaserPower: (value) => {
            controller.emitEvent(CONNECTION_LASER_POWER, {
                isPrinting: this.actions.isPrinting(),
                laserPower: value,
                laserPowerOpen: this.state.laserPowerOpen
            }).once(CONNECTION_LASER_POWER, (result) => {
                if (result) {
                    this.props.addConsoleLogs(result);
                }
            });
            this.setState({
                laserPower: value
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
        if (prevProps.laserPower !== this.props.laserPower && !isNil(this.props.laserPower)) {
            this.setState({
                laserPower: this.props.laserPower
            });
        }
        if (prevProps.headStatus !== this.props.headStatus) {
            this.setState({
                laserPowerOpen: this.props.headStatus
            });
        }
        return prevProps;
    }

    componentDidMount() {
        // console.log(this.state.laserPower, this.state.laserPowerOpen);
    }


    render() {
        const { laserPowerOpen, laserPower } = this.state; // laserPowerMarks,
        const isPrinting = this.actions.isPrinting();

        return (
            <div>
                {isPrinting && (
                    <ParamsWrapper
                        handleSubmit={(value) => { this.actions.onSaveLaserPower(value); }}
                        initValue={laserPower}
                        title={i18n._('key-unused-Laser Power')}
                        suffix="%"
                        inputMax={100}
                        hasSlider
                        inputMin={0}
                        sliderMin={0}
                        sliderMax={100}
                    >
                        <div className="width-44 sm-flex sm-flex-direction-c margin-left-16">
                            <span>{laserPower}%</span>
                        </div>
                    </ParamsWrapper>
                )}
                {isPrinting && <WorkSpeed />}

                {!isPrinting && (
                    <div className="sm-flex justify-space-between margin-vertical-8">
                        <span>{i18n._('key-unused-Laser Power')}</span>

                        <Switch
                            className="sm-flex-auto"
                            onClick={this.actions.onClickLaserPower}
                            checked={Boolean(laserPowerOpen)}
                        />
                    </div>
                )}
                {!isPrinting && (
                    <div className="sm-flex">
                        <SvgIcon
                            name="WarningTipsWarning"
                            color="#FFA940"
                            type={['static']}
                            onClick={() => { }}
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
const mapDispatchToProps = (dispatch) => {
    return {
        addConsoleLogs: (gcode, context) => dispatch(machineActions.addConsoleLogs(gcode, context)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Laser);
