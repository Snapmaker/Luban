import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import _ from 'lodash';
import { actions as machineActions } from '../../../flux/machine';
import WorkSpeed from './WorkSpeed';
import i18n from '../../../lib/i18n';
import Switch from '../../components/Switch';
import {
    CONNECTION_SWITCH_CNC,
    CONNECTION_TYPE_SERIAL,
    CONNECTION_TYPE_WIFI,
    CONNECTION_UPDATE_TOOLHEAD_SPEED,
    WORKFLOW_STATE_PAUSED, WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING
} from '../../../constants';
import { controller } from '../../../lib/controller';
import ParamsWrapper from './ParamsWrapper';

class Printing extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,
        workflowStatus: PropTypes.string,
        workflowState: PropTypes.string,
        connectionType: PropTypes.string,
        // executeGcode: PropTypes.func.isRequired
    };

    state = {
        headStatus: this.props.headStatus,
        toolHeadSpeed: 8000,
    };

    actions = {
        onClickToolHead: () => {
            controller.emitEvent(CONNECTION_SWITCH_CNC, {
                headStatus: this.state.headStatus
            }).once(CONNECTION_SWITCH_CNC, (result) => {
                console.log(`${CONNECTION_SWITCH_CNC} ok, get${JSON.stringify(result)}`);
                // if (result) {
                //     this.props.addConsoleLogs(result);
                // }
            });
            this.setState({
                headStatus: !this.state.headStatus
            });
        },
        updateToolHeadSpeed: (speed) => {
            controller.emitEvent(CONNECTION_UPDATE_TOOLHEAD_SPEED, {
                speed: speed
            }).once(CONNECTION_UPDATE_TOOLHEAD_SPEED, (result) => {
                console.log(`${CONNECTION_UPDATE_TOOLHEAD_SPEED} ok, get${JSON.stringify(result)}`);
                // if (result) {
                //     this.props.addConsoleLogs(result);
                // }
            });
            this.setState({
                toolHeadSpeed: speed
            });
        },
        isPrinting: () => {
            const { workflowStatus, workflowState, connectionType } = this.props;
            const a = (_.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus) && connectionType === CONNECTION_TYPE_WIFI)
                || (_.includes([WORKFLOW_STATE_PAUSED, WORKFLOW_STATE_RUNNING], workflowState) && connectionType === CONNECTION_TYPE_SERIAL);
            console.log(a);
            return a;
        }
    };

    render() {
        const { headStatus, toolHeadSpeed } = this.state;
        const isPrinting = this.actions.isPrinting();
        return (
            <div>
                {isPrinting && <WorkSpeed />}
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-unused-Toolhead')}</span>

                </div>
                {!isPrinting && (
                    <ParamsWrapper
                        handleSubmit={(value) => { console.log('update toolhead speed', value); this.actions.updateToolHeadSpeed(value); }}
                        initValue={toolHeadSpeed}
                        title={i18n._('key-Workspace/Marlin-Toolhead Speed')}
                        suffix="rpm"
                    >
                        <Switch
                            className="sm-flex-auto"
                            onClick={this.actions.onClickToolHead}
                            checked={headStatus}
                            disabled={isPrinting}
                        />
                        <div className="width-40 sm-flex sm-flex-direction-c">
                            <span>{toolHeadSpeed} rpm</span>
                        </div>
                    </ParamsWrapper>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { headStatus, workflowStatus, workflowState, connectionType } = machine;
    return {
        headStatus,
        workflowStatus,
        workflowState,
        connectionType
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
