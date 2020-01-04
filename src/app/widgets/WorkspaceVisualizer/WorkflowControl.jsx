import _ from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import {
    // Workflow
    WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_IDLE,
    WORKFLOW_STATUS_IDLE, WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED, CONNECTION_TYPE_WIFI, WORKFLOW_STATUS_UNKNOWN
} from '../../constants';

import i18n from '../../lib/i18n';
import log from '../../lib/log';


class WorkflowControl extends PureComponent {
    static propTypes = {
        uploadState: PropTypes.string.isRequired,
        workflowStatus: PropTypes.string,
        isConnected: PropTypes.bool,
        connectionType: PropTypes.string,
        state: PropTypes.object,
        actions: PropTypes.shape({
            handleClose: PropTypes.func.isRequired,
            handleRun: PropTypes.func.isRequired,
            handlePause: PropTypes.func.isRequired,
            handleStop: PropTypes.func.isRequired,
            handleAddGcode: PropTypes.func.isRequired,
            handleUploadGcodeFile: PropTypes.func.isRequired
        })
    };

    fileInput = React.createRef();


    state ={
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
    }

    onClickToUpload = () => {
        this.fileInput.current.value = null;
        this.fileInput.current.click();
    };

    onChangeFile = (event) => {
        const { actions } = this.props;
        const file = event.target.files[0];
        actions.handleUploadGcodeFile(file);

        const reader = new FileReader();
        reader.onloadend = (e) => {
            const { result, error } = e.target;

            if (error) {
                log.error(error);
                return;
            }

            log.debug('FileReader:', _.pick(file, [
                'lastModified',
                'lastModifiedDate',
                'meta',
                'name',
                'size',
                'type'
            ]));

            // actions.uploadFile(result, meta);
            actions.handleAddGcode(file.name, result);
        };

        try {
            reader.readAsText(file);
        } catch (err) {
            // Ignore error
        }
    };

    render() {
        const { state, connectionType, workflowStatus, isConnected } = this.props;
        const { gcode, workflowState } = state;
        const { isServerWaiting } = this.state;
        const isWifi = connectionType && connectionType === CONNECTION_TYPE_WIFI;
        const status = isWifi ? workflowStatus : workflowState;
        const isRendered = gcode.renderState === 'rendered';
        const isUploaded = isWifi ? true : this.props.uploadState === 'uploaded';
        const canUpload = _.includes([WORKFLOW_STATE_IDLE, WORKFLOW_STATUS_IDLE, WORKFLOW_STATUS_UNKNOWN], status);
        const canClose = isRendered && _.includes([WORKFLOW_STATE_IDLE, WORKFLOW_STATUS_IDLE, WORKFLOW_STATUS_UNKNOWN], status);
        const canPlay = isConnected && isRendered && isUploaded && !_.includes([WORKFLOW_STATE_RUNNING, WORKFLOW_STATUS_RUNNING], status);
        const canPause = _.includes([WORKFLOW_STATE_RUNNING, WORKFLOW_STATUS_RUNNING], status);
        const canStop = _.includes([WORKFLOW_STATE_PAUSED, WORKFLOW_STATUS_PAUSED], status);

        return (
            <div>
                <input
                    // The ref attribute adds a reference to the component to
                    // this.refs when the component is mounted.
                    ref={this.fileInput}
                    type="file"
                    accept=".gcode, .nc, .cnc"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={this.onChangeFile}
                />
                <div className="btn-toolbar">
                    <div className="btn-group btn-group-sm">
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-primary"
                            title={i18n._('Upload G-code')}
                            onClick={this.onClickToUpload}
                            disabled={!canUpload}
                        >
                            {i18n._('Upload G-code')}
                        </button>
                    </div>
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
            </div>
        );
    }
}

export default WorkflowControl;
