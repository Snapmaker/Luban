import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
// import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import { actions as machineActions } from '../../../flux/machine';
import { CONNECTION_TYPE_WIFI, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING } from '../../../constants';


class WorkSpeed extends PureComponent {
    static propTypes = {
        executeGcode: PropTypes.func.isRequired,
        workflowStatus: PropTypes.string,
        connectionType: PropTypes.string,
        server: PropTypes.object
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
            if (this.actions.isWifiPrinting()) {
                this.props.server.updateWorkSpeedFactor(workSpeedValue);
            } else {
                this.props.executeGcode(`M220 S${workSpeedValue}`);
            }
        }
    };

    render() {
        const { workSpeed, workSpeedValue } = this.state;
        const actions = this.actions;
        return (
            <div className="sm-flex justify-space-between margin-vertical-8">
                <span className="height-32">{i18n._('key_ui/widgets/Marlin/WorkSpeed_Work Speed')}</span>
                <div className="sm-flex-auto">
                    <span className="height-32">{workSpeed}/</span>
                    <Input
                        suffix="%"
                        size="small"
                        value={workSpeedValue}
                        max={500}
                        min={0}
                        onChange={actions.onChangeWorkSpeedValue}
                    />
                    <SvgIcon
                        name="Reset"
                        size={24}
                        className="border-default-black-5 margin-left-4 border-radius-8"
                        onClick={actions.onClickWorkSpeed}
                        borderRadius={8}
                    />
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { workflowStatus, connectionType, server } = machine;

    return {
        workflowStatus,
        connectionType,
        server
    };
};


const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(WorkSpeed);
