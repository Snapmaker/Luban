import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { isNil, includes } from 'lodash';
import { actions as machineActions } from '../../../flux/machine';
import WorkSpeed from './WorkSpeed';
import i18n from '../../../lib/i18n';
import Switch from '../../components/Switch';
import {
    CONNECTION_TYPE_SERIAL,
    CONNECTION_TYPE_WIFI,
    WORKFLOW_STATE_PAUSED, WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING
} from '../../../constants';

class Printing extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,
        workflowStatus: PropTypes.string,
        workflowState: PropTypes.string,
        connectionType: PropTypes.string,
        executeGcode: PropTypes.func.isRequired
    };

    state = {
        headStatus: this.props.headStatus
    };

    actions = {
        onClickToolHead: () => {
            if (this.state.headStatus) {
                this.props.executeGcode('M5');
            } else {
                this.props.executeGcode('M3 P100');
            }
            this.setState({
                headStatus: !this.state.headStatus
            });
        },
        isPrinting: () => {
            const { workflowStatus } = this.props;
            const _isPrinting = includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_PAUSING], workflowStatus);
            return _isPrinting;
        }

    };

    getSnapshotBeforeUpdate(prevProps) {
        if (prevProps.headStatus !== this.props.headStatus && !isNil(this.props.headStatus)) {
            this.setState({
                headStatus: this.props.headStatus
            });
        }
        return prevProps;
    }

    componentDidUpdate() {

    }

    render() {
        const { headStatus } = this.state;
        const isPrinting = this.actions.isPrinting();
        return (
            <div>
                {isPrinting && <WorkSpeed />}
                {isPrinting && isLevelTwoCNC
                    && (
                        <ParamsWrapper
                            handleSubmit={(value) => { this.actions.updateToolHeadSpeed(value); }}
                            initValue={this.props.cncTargetSpindleSpeed}
                            title={isLevelTwoCNC ? i18n._('key-Workspace/Marlin-Spindle Speed') : i18n._('key-unused-Toolhead')}
                            suffix="rpm"
                            inputMax={18000}
                            inputMin={8000}
                        >
                            <div className="width-44 sm-flex align-center margin-left-16 ">
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
                                    handleSubmit={(value) => { this.actions.updateToolHeadSpeed(value); }}
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
