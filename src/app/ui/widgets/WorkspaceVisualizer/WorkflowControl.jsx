import _ from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
    // Workflow
    WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_IDLE,
    WORKFLOW_STATUS_IDLE, WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED, CONNECTION_TYPE_WIFI, WORKFLOW_STATUS_UNKNOWN
} from '../../../constants';

import i18n from '../../../lib/i18n';
import SvgIcon from '../../components/SvgIcon';
// import styles from './index.styl';


class WorkflowControl extends PureComponent {
    static propTypes = {
        uploadState: PropTypes.string.isRequired,
        workflowStatus: PropTypes.string,
        isConnected: PropTypes.bool,
        connectionType: PropTypes.string,
        state: PropTypes.object,
        renderState: PropTypes.string.isRequired,
        actions: PropTypes.shape({
            handleClose: PropTypes.func.isRequired,
            handleRun: PropTypes.func.isRequired,
            handlePause: PropTypes.func.isRequired,
            handleStop: PropTypes.func.isRequired
        })
    };

    state = {
        isServerWaiting: false
    };

    actions = {
        handleRun: () => {
            this.setState({
                isServerWaiting: true
            });
            this.props.actions.handleRun();
            setTimeout(() => {
                this.setState({
                    isServerWaiting: false
                });
            }, 1000);
        },
        handlePause: () => {
            this.setState({
                isServerWaiting: true
            });
            this.props.actions.handlePause();
            setTimeout(() => {
                this.setState({
                    isServerWaiting: false
                });
            }, 1000);
        },
        handleClose: () => {
            this.setState({
                isServerWaiting: true
            });
            this.props.actions.handleClose();
            setTimeout(() => {
                this.setState({
                    isServerWaiting: false
                });
            }, 1000);
        },
        handleStop: () => {
            this.setState({
                isServerWaiting: true
            });
            this.props.actions.handleStop();
            setTimeout(() => {
                this.setState({
                    isServerWaiting: false
                });
            }, 1000);
        }
    };

    render() {
        const { state, connectionType, workflowStatus, isConnected } = this.props;
        const { workflowState } = state;
        const { isServerWaiting } = this.state;
        const isWifi = connectionType && connectionType === CONNECTION_TYPE_WIFI;
        const status = isWifi ? workflowStatus : workflowState;
        const isRendered = this.props.renderState === 'rendered';
        const isUploaded = isWifi ? true : this.props.uploadState === 'uploaded';
        const canClose = isRendered && _.includes([WORKFLOW_STATE_IDLE, WORKFLOW_STATUS_IDLE, WORKFLOW_STATUS_UNKNOWN], status);
        const canPlay = isConnected && isRendered && isUploaded && !_.includes([WORKFLOW_STATE_RUNNING, WORKFLOW_STATUS_RUNNING], status);
        const canPause = _.includes([WORKFLOW_STATE_RUNNING, WORKFLOW_STATUS_RUNNING], status);
        const canStop = _.includes([WORKFLOW_STATE_PAUSED, WORKFLOW_STATUS_PAUSED], status);

        return (
            <div className="">
                <SvgIcon
                    name="WorkspacePlay"
                    className="border-default-black-5 padding-vertical-4 padding-horizontal-4 border-radius-left-8"
                    size={22}
                    title={i18n._('Run')}
                    onClick={this.actions.handleRun}
                    disabled={isServerWaiting || !canPlay}
                />
                <SvgIcon
                    name="WorkspaceSuspend"
                    className="border-default-black-5 padding-vertical-4 padding-horizontal-4"
                    size={22}
                    title={i18n._('Pause')}
                    onClick={this.actions.handlePause}
                    disabled={isServerWaiting || !canPause}
                />
                <SvgIcon
                    name="WorkspaceStop"
                    className="border-default-black-5 padding-vertical-4 padding-horizontal-4"
                    size={22}
                    title={i18n._('Stop')}
                    onClick={this.actions.handleStop}
                    disabled={isServerWaiting || !canStop}
                />
                <SvgIcon
                    name="WorkspaceCancel"
                    className="border-default-black-5 padding-vertical-4 padding-horizontal-4 border-radius-right-8"
                    size={22}
                    title={i18n._('Close')}
                    onClick={this.actions.handleClose}
                    disabled={isServerWaiting || !canClose}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const workspace = state.workspace;
    return {
        renderState: workspace.renderState
    };
};


const mapDispatchToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(WorkflowControl);
