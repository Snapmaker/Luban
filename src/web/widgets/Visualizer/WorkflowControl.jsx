import classNames from 'classnames';
import _ from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, MenuItem } from 'react-bootstrap';
import {
    // Workflow
    WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_IDLE
} from '../../constants';

import i18n from '../../lib/i18n';
import log from '../../lib/log';
import styles from './workflow-control.styl';

class WorkflowControl extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };
    fileInputEl = null;

    onClickToUpload = () => {
        this.fileInputEl.value = null;
        this.fileInputEl.click();
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

            const meta = {
                name: file.name,
                size: file.size
            };
            actions.uploadFile(result, meta);
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
        const isUploaded = gcode.uploadState === 'uploaded';
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
                    ref={(node) => {
                        this.fileInputEl = node;
                    }}
                    type="file"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={this.onChangeFile}
                />
                <div className="btn-toolbar">
                    <div className="btn-group btn-group-sm">
                        <button
                            type="button"
                            className="btn btn-primary"
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
                            title={i18n._('Run')}
                            onClick={actions.handleRun}
                            disabled={!canPlay}
                        >
                            <i className="fa fa-play" />
                        </button>
                        <button
                            type="button"
                            className="btn btn-default"
                            title={i18n._('Pause')}
                            onClick={actions.handlePause}
                            disabled={!canPause}
                        >
                            <i className="fa fa-pause" />
                        </button>
                        <button
                            type="button"
                            className="btn btn-default"
                            title={i18n._('Stop')}
                            onClick={actions.handleStop}
                            disabled={!canStop}
                        >
                            <i className="fa fa-stop" />
                        </button>
                        <button
                            type="button"
                            className="btn btn-default"
                            title={i18n._('Close')}
                            onClick={actions.handleClose}
                            disabled={!canClose}
                        >
                            <i className="fa fa-close" />
                        </button>
                    </div>
                    <Dropdown
                        className="hidden"
                        bsSize="sm"
                        id="toolbar-dropdown"
                        pullRight
                    >
                        <Dropdown.Toggle
                            noCaret
                            style={{
                                paddingLeft: 8,
                                paddingRight: 8
                            }}
                        >
                            <i className="fa fa-list-alt" />
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <MenuItem>
                                <i className={classNames(styles.icon, styles.iconPerimeterTracingSquare)} />
                                <span className="space space-sm" />
                            </MenuItem>
                        </Dropdown.Menu>
                    </Dropdown>
                </div>
            </div>
        );
    }
}

export default WorkflowControl;
