import _ from 'lodash';
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import {
    // Workflow
    WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_IDLE
} from '../../constants';

import i18n from '../../lib/i18n';
import log from '../../lib/log';
import styles from './../styles.styl';


class WorkflowControl extends PureComponent {
    static propTypes = {
        uploadState: PropTypes.string.isRequired,
        state: PropTypes.object,
        actions: PropTypes.shape({
            handleClose: PropTypes.func.isRequired,
            handleSend: PropTypes.func.isRequired
        })
    };
    fileInput = React.createRef();

    onClickToUpload = () => {
        this.fileInput.current.value = null;
        this.fileInput.current.click();
    };

    onChangeFile = (event) => {
        const { actions } = this.props;
        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onloadend = (event) => {
            const { result, error } = event.target;

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
        const { state, actions } = this.props;
        const { gcode, workflowState } = state;

        const isRendered = gcode.renderState === 'rendered';
        const isUploaded = this.props.uploadState === 'uploaded';
        const canUpload = _.includes([WORKFLOW_STATE_IDLE], workflowState);
        const canClose = isRendered && _.includes([WORKFLOW_STATE_IDLE], workflowState);
        const canPlay = isRendered && isUploaded && !_.includes([WORKFLOW_STATE_RUNNING], workflowState);
        const canPause = _.includes([WORKFLOW_STATE_RUNNING], workflowState);
        const canStop = _.includes([WORKFLOW_STATE_PAUSED], workflowState);

        return (
            <div className={styles['workflow-control']}>
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
                            className={classNames(styles['btn-small'], styles['btn-primary'])}
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
                            onClick={actions.handleRun}
                            disabled={!canPlay}
                        >
                            <i className="fa fa-play" />
                        </button>
                        <button
                            type="button"
                            className="btn btn-default"
                            style={{ height: '30px' }}
                            title={i18n._('Pause')}
                            onClick={actions.handlePause}
                            disabled={!canPause}
                        >
                            <i className="fa fa-pause" />
                        </button>
                        <button
                            type="button"
                            className="btn btn-default"
                            style={{ height: '30px' }}
                            title={i18n._('Stop')}
                            onClick={actions.handleStop}
                            disabled={!canStop}
                        >
                            <i className="fa fa-stop" />
                        </button>
                        <button
                            type="button"
                            className="btn btn-default"
                            style={{ height: '30px' }}
                            title={i18n._('Close')}
                            onClick={actions.handleClose}
                            disabled={!canClose}
                        >
                            <i className="fa fa-close" />
                        </button>
                    </div>
                    {/*
                    <div className="btn-group btn-group-sm">
                        <button
                            type="button"
                            className={classNames(styles['btn-small'], styles['btn-primary'])}
                            disabled={!isRendered}
                            onClick={actions.handleSend}
                            title={i18n._('File Transit via Wi-Fi')}
                        >
                            {i18n._('File Transit via Wi-Fi')}
                        </button>
                    </div>
                    */}
                </div>
            </div>
        );
    }
}

export default WorkflowControl;
