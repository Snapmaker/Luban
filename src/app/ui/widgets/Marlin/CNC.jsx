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
    // CONNECTION_TYPE_SERIAL,
    // CONNECTION_TYPE_WIFI,
    CONNECTION_UPDATE_TOOLHEAD_SPEED,
    LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    // WORKFLOW_STATE_PAUSED, WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_PAUSING,
    WORKFLOW_STATUS_RUNNING
} from '../../../constants';
import { controller } from '../../../lib/controller';
import ParamsWrapper from './ParamsWrapper';
import EditComponent from '../../components/Edit';

class Printing extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,
        workflowStatus: PropTypes.string,
        // workflowState: PropTypes.string,
        // connectionType: PropTypes.string,
        toolHead: PropTypes.string.isRequired,
        cncCurrentSpindleSpeed: PropTypes.number.isRequired,
        cncTargetSpindleSpeed: PropTypes.number.isRequired
        // executeGcode: PropTypes.func.isRequired
    };

    state = {
        headStatus: this.props.headStatus,
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
        },
        isPrinting: () => {
            const { workflowStatus } = this.props;
            const _isPrinting = _.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_PAUSING], workflowStatus);
            console.log('isPrinting', _isPrinting);
            return _isPrinting;
        }
    };

    render() {
        const { headStatus } = this.state;
        const isPrinting = this.actions.isPrinting();
        const isLevelTwoCNC = this.props.toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2;

        return (
            <div>
                {isPrinting && <WorkSpeed />}
                {isPrinting && isLevelTwoCNC
                    && (
                        <ParamsWrapper
                            handleSubmit={(value) => { console.log('update toolhead speed', value); this.actions.updateToolHeadSpeed(value); }}
                            initValue={this.props.cncTargetSpindleSpeed}
                            title={isLevelTwoCNC ? i18n._('key-Workspace/Marlin-Spindle Speed') : i18n._('key-unused-Toolhead')}
                            suffix="rpm"
                            inputMax={18000}
                            inputMin={8000}
                        >
                            <div className="width-40 sm-flex align-center margin-left-16 ">
                                <span>{this.props.cncCurrentSpindleSpeed} rpm</span>
                            </div>
                        </ParamsWrapper>
                    )}
                {!isPrinting && (
                    <div className="sm-flex-overflow-visible margin-vertical-8 justify-space-between">
                        <div className="height-32 width-176 display-inline text-overflow-ellipsis">{i18n._('key-unused-Toolhead')}</div>
                        <div className="sm-flex margin-left-24 overflow-visible align-center">
                            <Switch
                                className="sm-flex-auto"
                                style={{ order: 0 }}
                                onClick={this.actions.onClickToolHead}
                                checked={headStatus}
                                disabled={isPrinting}
                            />

                            {/* //  <div className="sm-flex align-center"> */}
                            { isLevelTwoCNC && (
                                <div className=" sm-flex sm-flex-direction-c  margin-right-16  margin-left-16">
                                    <span>{this.props.cncTargetSpindleSpeed}rpm</span>
                                </div>
                            )}
                            { isLevelTwoCNC && (
                                <EditComponent
                                    handleSubmit={(value) => { console.log('update toolhead speed', value); this.actions.updateToolHeadSpeed(value); }}
                                    initValue={this.props.cncTargetSpindleSpeed}
                                    suffix="rpm"
                                    inputMax={18000}
                                    inputMin={8000}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { headStatus, workflowStatus, workflowState, connectionType,
        cncCurrentSpindleSpeed,
        cncTargetSpindleSpeed } = machine;
    const { toolHead } = state.workspace;
    return {
        headStatus,
        workflowStatus,
        workflowState,
        connectionType,
        toolHead,
        cncCurrentSpindleSpeed,
        cncTargetSpindleSpeed
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
