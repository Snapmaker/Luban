import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
import i18n from '../../../lib/i18n';
import { actions as workspaceActions } from '../../../flux/workspace';
import { CONNECTION_TYPE_WIFI, CONNECTION_WORKSPEED_FACTOR, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING } from '../../../constants';
import AttributeContainer from './components/AttributeContainer';
import { controller } from '../../../lib/controller';


class WorkSpeed extends PureComponent {
    static propTypes = {
        workflowStatus: PropTypes.string,
        connectionType: PropTypes.string,
        toolHead: PropTypes.string.isRequired,
    };


    state = {
        workSpeedValue: 100
    };

    actions = {
        isWifiPrinting: () => {
            const { workflowStatus, connectionType } = this.props;
            return _.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus)
                && connectionType === CONNECTION_TYPE_WIFI;
        },
        onClickWorkSpeed: (value) => {
            this.setState({
                workSpeedValue: value
            });
            controller.emitEvent(CONNECTION_WORKSPEED_FACTOR, {
                workSpeedValue: value,
                toolHead: this.props.toolHead,
            });
        }
    };

    render() {
        const { workSpeedValue } = this.state;
        const actions = this.actions;
        return (
            <AttributeContainer
                handleSubmit={(value) => { actions.onClickWorkSpeed(value); }}
                initValue={workSpeedValue}
                title={i18n._('key-Workspace/Marlin-Work Speed')}
                suffix="%"
                inputMax={500}
                inputMin={1}
            >
                <div className="width-44 sm-flex align-center margin-left-16 ">
                    <span>{workSpeedValue} %</span>
                </div>
            </AttributeContainer>
        );
    }
}

const mapStateToProps = (state) => {
    const { workflowStatus, connectionType, server } = state.workspace;
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
        executeGcode: (gcode, context) => dispatch(workspaceActions.executeGcode(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(WorkSpeed);
