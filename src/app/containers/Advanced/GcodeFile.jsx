import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import isEmpty from 'lodash/isEmpty';
import includes from 'lodash/includes';
import TextArea from 'react-textarea-autosize';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import api from '../../api';
import ProgressBar from '../../components/ProgressBar';
import controller from '../../lib/controller';
import styles from './index.styl';
import {
    WORKFLOW_STATE_IDLE,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_RUNNING
} from './constants';

class GcodeFile extends PureComponent {
    static propTypes = {
        port: PropTypes.string,
        executeGcode: PropTypes.func
    };

    gcodeFileRef = React.createRef();

    headerTextarea = React.createRef();

    state = {
        gcodeFile: '',
        // gcodeHeader: '',
        workflowState: '',
        sender: {
            total: 0,
            sent: 0,
            received: 0
        }
    };

    pauseStatus = {
        headStatus: 'off',
        headPower: 0
    };

    pause3dpStatus = {
        pausing: false
    };

    actions = {
        onChangeGcodeFile: async (event) => {
            const file = event.target.files[0];
            try {
                await this.actions.uploadGcodeFile(file);
            } catch (e) {
                modal({
                    title: i18n._('Failed to upload file'),
                    body: e.message
                });
            }
        },
        uploadGcodeFile: async (file) => {
            const formData = new FormData();
            const { port } = this.props;
            formData.append('file', file);
            formData.append('port', port);
            formData.append('dataSource', 'developerPanel');
            const res = await api.uploadGcodeFile(formData);
            const { originalName, gcodeHeader } = res.body;
            this.headerTextarea.value = `G-Code Name: ${originalName}\n`;
            this.headerTextarea.value += `${gcodeHeader}`;
            this.setState({
                gcodeFile: originalName
            });
        },
        clickUploadGcodeFile: () => {
            this.gcodeFileRef.current.value = null;
            this.gcodeFileRef.current.click();
        },
        isCNC: () => {
            return (this.state.headType === 'CNC');
        },
        is3DP: () => {
            return (this.state.headType === '3DP');
        },
        isLaser: () => {
            const headType = this.state.headType;
            return (headType === 'LASER' || headType === 'LASER350' || headType === 'LASER1600');
        },
        run: () => {
            const { workflowState } = this.state;

            if (workflowState === WORKFLOW_STATE_IDLE) {
                // controller.command('gcode:start');
                this.props.executeGcode('start print file');
            }
            if (workflowState === WORKFLOW_STATE_PAUSED) {
                if (this.actions.is3DP()) {
                    this.pause3dpStatus.pausing = false;
                    controller.command('gcode:resume', 'developerPanel');
                } else if (this.actions.isLaser()) {
                    if (this.pauseStatus.headStatus === 'on') {
                        // resume laser power
                        const powerPercent = Math.max(Math.min(this.pauseStatus.headPower, 100), 0);
                        const powerStrength = Math.floor(powerPercent * 255 / 100);
                        if (powerPercent !== 0) {
                            controller.command('gcode', 'developerPanel', `M3 P${powerPercent} S${powerStrength}`);
                        } else {
                            controller.command('gcode', 'developerPanel', 'M3 P100');
                        }
                    }
                    controller.command('gcode:resume', 'developerPanel');
                } else {
                    if (this.pauseStatus.headStatus === 'on') {
                        // resume spindle
                        controller.command('gcode', 'developerPanel', 'M3 P100');
                        // for CNC machine, resume need to wait >500ms to let the tool head started
                        setTimeout(() => {
                            controller.command('gcode:resume', 'developerPanel');
                        }, 1000);
                    } else {
                        controller.command('gcode:resume', 'developerPanel');
                    }
                }
            }
        },
        tryPause: () => {
            // delay 500ms to let buffer executed. and status propagated
            setTimeout(() => {
                if (this.state.sender.received >= this.state.sender.sent) {
                    this.pauseStatus = {
                        headStatus: this.state.headStatus,
                        headPower: this.state.headPower
                    };

                    if (this.pauseStatus.headStatus === 'on') {
                        controller.command('gcode', 'developerPanel', 'M5');
                    }

                    if (this.pause3dpStatus.pausing) {
                        this.pause3dpStatus.pausing = false;
                    }
                } else {
                    this.actions.tryPause();
                }
            }, 50);
        },
        pause: () => {
            const { workflowState } = this.state;
            if ([WORKFLOW_STATE_RUNNING].includes(workflowState)) {
                controller.command('gcode:pause', 'developerPanel');

                if (this.actions.is3DP()) {
                    this.pause3dpStatus.pausing = true;
                }

                this.actions.tryPause();
            }
        },
        stop: () => {
            // const { workflowState } = this.state.controller.state;
            const { workflowState } = this.state;
            if ([WORKFLOW_STATE_PAUSED].includes(workflowState)) {
                controller.command('gcode:stop', 'developerPanel');
            }
        }
        /*
        close: () => {
            const { workflowState } = this.state.controller.state;
            if ([WORKFLOW_STATE_IDLE].includes(workflowState)) {
                controller.command('gcode:unload');
            }
        }
        */
    };

    controllerEvents = {
        'Marlin:state': (state, dataSource) => {
            if (dataSource === 'developerPanel') {
                const { headType, headPower, headStatus } = state;
                if (headType !== this.state.headType) {
                    this.setState({ headType });
                }
                if (headPower !== this.state.headPower) {
                    this.setState({ headPower });
                }
                if (headStatus !== this.state.headStatus) {
                    this.setState({ headStatus });
                }
            }
        },
        'sender:status': (data, dataSource) => {
            if (dataSource === 'developerPanel') {
                const { total, sent, received } = data;
                this.setState({
                    sender: {
                        ...this.state.sender,
                        total,
                        sent,
                        received
                    }
                });
            }
        },
        'workflow:state': (workflowState, dataSource) => {
            if (dataSource === 'developerPanel') {
                if (this.state.workflowState !== workflowState) {
                    this.setState({ workflowState });
                }
            }
        }
    }

    componentDidMount() {
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    render() {
        const { sender, gcodeFile, workflowState } = this.state;
        const { sent, total } = sender;
        const hasGcodeFile = !isEmpty(gcodeFile);
        let progress = 0.0;
        if (total > 0) {
            progress = Math.floor(100.0 * sent / total);
        }
        const canUpload = includes([WORKFLOW_STATE_IDLE], workflowState);
        const canRun = hasGcodeFile && !includes([WORKFLOW_STATE_RUNNING], workflowState);
        const canPause = includes([WORKFLOW_STATE_RUNNING], workflowState);
        const canStop = includes([WORKFLOW_STATE_PAUSED], workflowState);
        // const canClose = hasGcodeFile && includes([WORKFLOW_STATE_IDLE], workflowState);

        return (
            <div>
                <p style={{ margin: '0' }}>{i18n._('G-Code File')}</p>
                <input
                    ref={this.gcodeFileRef}
                    type="file"
                    accept=".gcode, .nc, .cnc"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={this.actions.onChangeGcodeFile}
                />
                <button
                    className="sm-btn-small sm-btn-primary"
                    type="button"
                    disabled={!canUpload}
                    onClick={() => {
                        this.actions.clickUploadGcodeFile();
                    }}
                >
                    {i18n._('Upload')}
                </button>
                <button
                    className="btn btn-default"
                    type="button"
                    disabled={!canRun}
                    onClick={this.actions.run}
                >
                    <i className="fa fa-play" />
                </button>
                <button
                    className="btn btn-default"
                    type="button"
                    disabled={!canPause}
                    onClick={this.actions.pause}
                >
                    <i className="fa fa-pause" />
                </button>
                <button
                    className="btn btn-default"
                    type="button"
                    disabled={!canStop}
                    onClick={this.actions.stop}
                >
                    <i className="fa fa-stop" />
                </button>
                {/* <button
                    className="btn btn-default"
                    type="button"
                    disabled={!canClose}
                    onClick={this.actions.close}
                >
                    <i className="fa fa-close" />
                </button>
                */
                }
                <div>
                    <TextArea
                        style={{ width: '60%' }}
                        minRows={3}
                        maxRows={20}
                        placeholder="G-Code Info"
                        inputRef={(tag) => {
                            this.headerTextarea = tag;
                        }}
                    />
                </div>
                {hasGcodeFile && (
                    <div className={styles['visualizer-notice']}>
                        {progress}%  {sent} / {total}
                    </div>
                )}
                {hasGcodeFile && (
                    <div className={styles['visualizer-progress']}>
                        <ProgressBar progress={progress} />
                    </div>
                )}
            </div>
        );
    }
}

export default GcodeFile;
