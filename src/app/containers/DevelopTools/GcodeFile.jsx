import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import isEmpty from 'lodash/isEmpty';
import includes from 'lodash/includes';
import TextArea from 'react-textarea-autosize';
import request from 'superagent';
import FileSaver from 'file-saver';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import api from '../../api';
import ProgressBar from '../../components/ProgressBar';
import { controller } from '../../lib/controller';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import styles from './index.styl';
import {
    PROTOCOL_SCREEN,
    WORKFLOW_STATE_IDLE,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_RUNNING
} from '../../constants';

class GcodeFile extends PureComponent {
    static propTypes = {
        port: PropTypes.string
    };

    gcodeFileRef = React.createRef();

    headerTextarea = React.createRef();

    state = {
        gcodeFile: '',
        uploadName: '',
        gcodeHeader: '',
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
            formData.append('dataSource', PROTOCOL_SCREEN);
            const res = await api.uploadGcodeFile(formData);
            const { originalName, uploadName, gcodeHeader } = res.body;
            let header = ';Header Start\n';
            this.headerTextarea.value = `G-Code Name: ${originalName}\n`;
            for (const key of Object.keys(gcodeHeader)) {
                const value = gcodeHeader[key];
                header += `${key}: ${value}\n`;
                this.headerTextarea.value += `${key.substring(1)}: ${value}\n`;
            }
            header += ';Header End\n';
            this.setState({
                gcodeFile: originalName,
                uploadName,
                gcodeHeader: header
            });
        },
        clickUploadGcodeFile: () => {
            this.gcodeFileRef.current.value = null;
            this.gcodeFileRef.current.click();
        },
        exportGcodeWithHeader: () => {
            const { gcodeFile, gcodeHeader, uploadName } = this.state;
            const exportName = pathWithRandomSuffix(gcodeFile);
            request.get(`/data/Tmp/${uploadName}`).end((err, res) => {
                let data = res.text;
                const startIndex = data.indexOf(';Header Start');
                const endIndex = data.indexOf(';Header End');
                if (startIndex !== -1 && endIndex !== -1) {
                    data = data.substring(0, startIndex) + gcodeHeader + data.substring(data.indexOf('\n', endIndex));
                } else {
                    data = gcodeHeader + data;
                }
                // data = data.replace(/(;Header Start)(.|\n)*(;Header End)/, '');
                // data = gcodeHeader + data;

                const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
                FileSaver.saveAs(blob, exportName, true);
            });
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
                // this.props.executeGcode('start print file');
                controller.command('gcode', 'gcode:resume');
            }
            if (workflowState === WORKFLOW_STATE_PAUSED) {
                if (this.actions.is3DP()) {
                    this.pause3dpStatus.pausing = false;
                    controller.command('gcode:resume');
                } else if (this.actions.isLaser()) {
                    if (this.pauseStatus.headStatus) {
                        // resume laser power
                        const powerPercent = Math.max(Math.min(this.pauseStatus.headPower, 100), 0);
                        const powerStrength = Math.floor(powerPercent * 255 / 100);
                        if (powerPercent !== 0) {
                            controller.command('gcode', `M3 P${powerPercent} S${powerStrength}`);
                        } else {
                            controller.command('gcode', 'M3 P100 S255');
                        }
                    }
                    controller.command('gcode:resume');
                } else {
                    if (this.pauseStatus.headStatus) {
                        // resume spindle
                        controller.command('gcode', 'M3 P100 S255');
                        // for CNC machine, resume need to wait >500ms to let the tool head started
                        setTimeout(() => {
                            controller.command('gcode:resume');
                        }, 1000);
                    } else {
                        controller.command('gcode:resume');
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

                    if (this.pauseStatus.headStatus) {
                        controller.command('gcode', 'M5');
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
                controller.command('gcode:pause');

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
                controller.command('gcode:stop');
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
        // 'Marlin:state': (state, dataSource) => {
        'Marlin:state': (options) => {
            const { state, dataSource } = options;
            if (dataSource !== PROTOCOL_SCREEN) {
                return;
            }
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
        },
        // 'sender:status': (data, dataSource) => {
        'sender:status': (options) => {
            const { data, dataSource } = options;
            if (dataSource !== PROTOCOL_SCREEN) {
                return;
            }
            const { total, sent, received } = data;
            this.setState({
                sender: {
                    ...this.state.sender,
                    total,
                    sent,
                    received
                }
            });
        },
        // 'workflow:state': (workflowState, dataSource) => {
        'workflow:state': (options) => {
            const { workflowState, dataSource } = options;
            if (dataSource !== PROTOCOL_SCREEN) {
                return;
            }
            if (this.state.workflowState !== workflowState) {
                this.setState({ workflowState });
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
        // const canUpload = includes([WORKFLOW_STATE_IDLE], workflowState);
        const canRun = hasGcodeFile && !includes([WORKFLOW_STATE_RUNNING], workflowState);
        const canPause = includes([WORKFLOW_STATE_RUNNING], workflowState);
        const canStop = includes([WORKFLOW_STATE_PAUSED], workflowState);
        // const canClose = hasGcodeFile && includes([WORKFLOW_STATE_IDLE], workflowState);

        return (
            <div>
                <p style={{ margin: '0' }}>{i18n._('G-code File')}</p>
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
                <button
                    className="sm-btn-small sm-btn-primary"
                    type="button"
                    disabled={!hasGcodeFile}
                    onClick={this.actions.exportGcodeWithHeader}
                >
                    {i18n._('Export')}
                </button>
            </div>
        );
    }
}

export default GcodeFile;
