import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
// import Anchor from '../../components/Anchor';
// import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';
// import { NumberInput as Input } from '../../components/Input';
import { actions as machineActions } from '../../../flux/machine';
import { CONNECTION_TYPE_WIFI, CONNECTION_WORKSPEED_FACTOR, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING } from '../../../constants';
import ParamsWrapper from './ParamsWrapper';
import { controller } from '../../../lib/controller';


class WorkSpeed extends PureComponent {
    static propTypes = {
        // executeGcode: PropTypes.func.isRequired,
        workflowStatus: PropTypes.string,
        connectionType: PropTypes.string,
        // server: PropTypes.object,
        toolHead: PropTypes.string.isRequired,
    };


    state = {
        workSpeed: 100,
        workSpeedValue: 100
    };

    actions = {
        isWifiPrinting: () => {
            const { workflowStatus, connectionType } = this.props;
            return _.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus)
                && connectionType === CONNECTION_TYPE_WIFI;
        },
        onChangeWorkSpeedValue: (value) => {
            this.setState({
                workSpeedValue: value
            });
        },
        onClickWorkSpeed: () => {
            const workSpeedValue = this.state.workSpeedValue;
            this.setState({
                workSpeed: workSpeedValue
            });
            controller.emitEvent(CONNECTION_WORKSPEED_FACTOR, {
                workSpeed: workSpeedValue,
                toolHead: this.props.toolHead, // DUAL_EXTRUDER_TOOLHEAD_FOR_SM2
                // extruderIndex: ,
            });
            // DUAL_EXTRUDER_TOOLHEAD_FOR_SM2
            // if (this.actions.isWifiPrinting()) {
            //     this.props.server.updateWorkSpeedFactor(workSpeedValue);
            // } else {
            //     this.props.executeGcode(`M220 S${workSpeedValue}`);
            // }
        }
    };

    render() {
        const { workSpeed, workSpeedValue } = this.state;
        const actions = this.actions;
        return (
            <ParamsWrapper
                handleSubmit={(value) => { console.log('onChangeWorkSpeedValue', value); actions.onClickWorkSpeed(value); }}
                initValue={workSpeed}
                title={i18n._('key-Workspace/Marlin-Work Speed')}
                suffix="%"
                inputMax={1}
                inputMin={500}
            >
                <div className="width-40 sm-flex align-center margin-left-16 ">
                    <span>{workSpeedValue} %</span>
                </div>
            </ParamsWrapper>
            // <div className="sm-flex justify-space-between margin-vertical-8">
            //     <span className="height-32">{i18n._('key-unused-Work Speed')}</span>
            //     <div className="sm-flex-auto">
            //         <span className="height-32">{workSpeed}/</span>
            //         <Input
            //             suffix="%"
            //             size="small"
            //             value={workSpeedValue}
            //             max={500}
            //             min={0}
            //             onChange={actions.onChangeWorkSpeedValue}
            //         />
            //         <SvgIcon
            //             name="Reset"
            //             size={24}
            //             className="border-default-black-5 margin-left-4 border-radius-8"
            //             onClick={actions.onClickWorkSpeed}
            //             borderRadius={8}
            //         />
            //     </div>
            // </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { workflowStatus, connectionType, server } = machine;
    const { toolHead } = state.workspace;

    return {
        workflowStatus,
        connectionType,
        server,
        toolHead
    };
};


const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(WorkSpeed);
