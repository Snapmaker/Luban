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
} from '../../constants';

import i18n from '../../lib/i18n';


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
            <div className="btn-toolbar">
                <div className="btn-group btn-group-sm">
                    <button
                        type="button"
                        className="btn btn-default"
                        style={{ height: '30px' }}
                        title={i18n._('Run')}
                        onClick={this.actions.handleRun}
                        disabled={isServerWaiting || !canPlay}
                    >
                        <i className="fa fa-play" />
                    </button>
                    <button
                        type="button"
                        className="btn btn-default"
                        style={{ height: '30px' }}
                        title={i18n._('Pause')}
                        onClick={this.actions.handlePause}
                        disabled={isServerWaiting || !canPause}
                    >
                        <i className="fa fa-pause" />
                    </button>
                    <button
                        type="button"
                        className="btn btn-default"
                        style={{ height: '30px' }}
                        title={i18n._('Stop')}
                        onClick={this.actions.handleStop}
                        disabled={isServerWaiting || !canStop}
                    >
                        <i className="fa fa-stop" />
                    </button>
                    <button
                        type="button"
                        className="btn btn-default"
                        style={{ height: '30px' }}
                        title={i18n._('Close')}
                        onClick={this.actions.handleClose}
                        disabled={isServerWaiting || !canClose}
                    >
                        <i className="fa fa-close" />
                    </button>
                </div>
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
