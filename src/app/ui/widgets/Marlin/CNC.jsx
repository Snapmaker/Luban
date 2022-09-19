import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { isNil, includes } from 'lodash';
import WorkSpeed from './WorkSpeed';
import i18n from '../../../lib/i18n';
import Switch from '../../components/Switch';
import { controller } from '../../../lib/controller';
import ParamsWrapper from './ParamsWrapper';
import EditComponent from '../../components/Edit';
import {
    CONNECTION_SWITCH_CNC,
    CONNECTION_UPDATE_TOOLHEAD_SPEED,
    LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_PAUSING,
    WORKFLOW_STATUS_RUNNING
} from '../../../constants';

class CNC extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,
        workflowStatus: PropTypes.string,
        toolHead: PropTypes.string.isRequired,
        cncCurrentSpindleSpeed: PropTypes.number.isRequired,
        cncTargetSpindleSpeed: PropTypes.number.isRequired
    };

    state = {
        headStatus: this.props.toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2 ? this.props.cncCurrentSpindleSpeed > 0 : this.props.headStatus
    };

    actions = {
        onClickToolHead: () => {
            controller.emitEvent(CONNECTION_SWITCH_CNC, {
                headStatus: this.state.headStatus,
                speed: this.props.cncTargetSpindleSpeed,
                toolHead: this.props.toolHead,
            });
            this.setState({
                headStatus: !this.state.headStatus
            });
        },
        updateToolHeadSpeed: (speed) => {
            controller.emitEvent(CONNECTION_UPDATE_TOOLHEAD_SPEED, {
                speed: speed
            });
            // this.setState({ toolHeadSpeepd: speed });
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
        if (prevProps.cncCurrentSpindleSpeed !== this.props.cncCurrentSpindleSpeed && this.props.toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2) {
            this.setState({
                headStatus: this.props.cncCurrentSpindleSpeed > 0
            });
        }
        return prevProps;
    }

    componentDidUpdate() {

    }

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


export default connect(mapStateToProps)(CNC);
