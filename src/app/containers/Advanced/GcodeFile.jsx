import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import isEmpty from 'lodash/isEmpty';
import includes from 'lodash/includes';
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
        size: PropTypes.object,
        port: PropTypes.string,
        executeGcode: PropTypes.func
    };

    gcodeFileRef = React.createRef();

    state = {
        gcodeFile: '',
        workflowState: '',
        sender: {
            total: 0,
            sent: 0,
            received: 0
        },
        workPosition: {
            x: '0.000',
            y: '0.000',
            z: '0.000',
            e: '0.000'
        }
    };

    pauseStatus = {
        headStatus: 'off',
        headPower: 0
    };

    pause3dpStatus = {
        pausing: false,
        pos: null
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
            const res = await api.uploadGcodeFile(formData);
            const { originalName } = res.body;
            this.setState({
                gcodeFile: originalName
            });
        },
        updateWorkPositionToZero: () => {
            this.actions.updateWorkPosition({
                x: '0.000',
                y: '0.000',
                z: '0.000',
                e: '0.000'
            });
        },
        updateWorkPosition: (pos) => {
            this.setState({
                workPosition: {
                    ...this.state.workPosition,
                    ...pos
                }
            });
            let { x = 0, y = 0, z = 0 } = { ...pos };
            x = (Number(x) || 0);
            y = (Number(y) || 0);
            z = (Number(z) || 0);
            this.toolhead && this.toolhead.position.set(x, y, z);
            this.targetPoint && this.targetPoint.position.set(x, y, z);
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
            // const headType = this.state.controller.state.headType;
            const headType = this.state.headType;
            return (headType === 'LASER' || headType === 'LASER350' || headType === 'LASER1600');
        },
        run: () => {
            // const { workflowState } = this.state.controller.state;
            const { workflowState } = this.state;

            if (workflowState === WORKFLOW_STATE_IDLE) {
                // controller.command('gcode:start');
                this.props.executeGcode('start print file');
            }
            if (workflowState === WORKFLOW_STATE_PAUSED) {
                if (this.actions.is3DP()) {
                    this.pause3dpStatus.pausing = false;
                    const pos = this.pause3dpStatus.pos;
                    console.log('posZ', pos.z);
                    console.log('posX', pos.x, pos.y);
                    controller.command('gcode', `G1 Z${pos.z} F1000\n`);
                    controller.command('gcode', `G1 X${pos.x} Y${pos.y} F1000\n`);
                    controller.command('gcode:resume');
                } else if (this.actions.isLaser()) {
                    if (this.pauseStatus.headStatus === 'on') {
                        // resume laser power
                        const powerPercent = Math.max(Math.min(this.pauseStatus.headPower, 100), 0);
                        const powerStrength = Math.floor(powerPercent * 255 / 100);
                        if (powerPercent !== 0) {
                            controller.command('gcode', `M3 P${powerPercent} S${powerStrength}`);
                        } else {
                            controller.command('gcode', 'M3');
                        }
                    }
                    controller.command('gcode:resume');
                } else {
                    if (this.pauseStatus.headStatus === 'on') {
                        // resume spindle
                        controller.command('gcode', 'M3');
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

                    if (this.pauseStatus.headStatus === 'on') {
                        controller.command('gcode', 'M5');
                    }

                    // toolhead has stopped
                    if (this.pause3dpStatus.pausing) {
                        this.pause3dpStatus.pausing = false;
                        // const { workPosition } = this.state.controller.state;
                        const { workPosition } = this.state;
                        console.log('workpos0', workPosition);
                        this.pause3dpStatus.pos = {
                            x: Number(workPosition.x),
                            y: Number(workPosition.y),
                            z: Number(workPosition.z),
                            e: Number(workPosition.e)
                        };
                        const pos = this.pause3dpStatus.pos;
                        console.log('posZ2', pos.z);
                        // experience params for retraction: F3000, E->(E-5)
                        // pos.e is always zero from the firmware
                        // const targetE = Math.max(pos.e - 5, 0);
                        const targetZ = Math.min(pos.z + 60, this.props.size.z);
                        console.log('targetZ', targetZ);
                        /*
                        const cmd = [
                            `G1 E${targetE} F3000\n`,
                            `G1 Z${targetZ} F1000\n`,
                            `G1 E${pos.e} F3000\n`
                        ];
                        */
                        // controller.command('gcode', cmd);
                        // controller.command('gcode', `G1 E${targetE} F3000`);
                        controller.command('gcode', `G1 Z${targetZ} F1000`);
                        // controller.command('gcode', `G1 E${pos.e} F100`);
                    }
                } else {
                    this.actions.tryPause();
                }
            }, 50);
        },
        pause: () => {
            // const { workflowState } = this.state.controller.state;
            const { workflowState } = this.state;
            if ([WORKFLOW_STATE_RUNNING].includes(workflowState)) {
                controller.command('gcode:pause');

                if (this.actions.is3DP()) {
                    this.pause3dpStatus.pausing = true;
                    // TODO if press button too fast, the null-value of pos will throw errors and end up the printing
                    // this.pause3dpStatus.pos = null;
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
        'Marlin:state': (state) => {
            const { pos, headType, headPower, headStatus } = state;
            if (this.state.workflowState === WORKFLOW_STATE_RUNNING) {
                console.log('pos0', pos);
                this.actions.updateWorkPosition(pos);
            }
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
        'sender:status': (data) => {
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
        'workflow:state': (workflowState) => {
            console.log('www', workflowState);
            if (this.state.workflowState !== workflowState) {
                this.setState({ workflowState });
                switch (workflowState) {
                    case WORKFLOW_STATE_IDLE:
                        this.actions.updateWorkPositionToZero();
                        break;
                    case WORKFLOW_STATE_RUNNING:
                        break;
                    case WORKFLOW_STATE_PAUSED:
                        break;
                    default:
                        break;
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
        // const progress = total ? Number(sent / total).toFixed(3) : 0.0;
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
                <p style={{ margin: '0' }}>{gcodeFile}</p>
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
