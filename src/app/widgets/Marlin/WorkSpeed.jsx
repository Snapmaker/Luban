import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import { actions as machineActions } from '../../flux/machine';
import { CONNECTION_TYPE_WIFI, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING } from '../../constants';


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

            <div className="sm-parameter-row">
                <span className="sm-parameter-row__label-lg">{i18n._('Work Speed')}</span>
                <span className="sm-parameter-row__input2-text">{workSpeed}/</span>
                <Input
                    className="sm-parameter-row__input2"
                    value={workSpeedValue}
                    max={500}
                    min={0}
                    onChange={actions.onChangeWorkSpeedValue}
                />
                <span className="sm-parameter-row__input2-unit">%</span>
                <Anchor
                    className="sm-parameter-row__input2-check fa fa-chevron-circle-right"
                    onClick={actions.onClickWorkSpeed}
                />
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
