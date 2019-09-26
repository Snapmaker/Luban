import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import isEmpty from 'lodash/isEmpty';
import includes from 'lodash/includes';
import i18n from '../../lib/i18n';
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
        sender: PropTypes.object,
        size: PropTypes.object,
        gcodeFile: PropTypes.string,
        headType: PropTypes.string,
        workflowState: PropTypes.string,
        workPosition: PropTypes.object,
        headStatus: PropTypes.string,
        headPower: PropTypes.number,
        onChangeGcodeFile: PropTypes.func,
        executeGcode: PropTypes.func
    };

    gcodeFileRef = React.createRef();

    pauseStatus = {
        headStatus: 'off',
        headPower: 0
    };

    pause3dpStatus = {
        pausing: false,
        pos: null
    };

    actions = {
        clickUploadGcodeFile: () => {
            this.gcodeFileRef.current.value = null;
            this.gcodeFileRef.current.click();
        },
        isCNC: () => {
            return (this.props.headType === 'CNC');
        },
        is3DP: () => {
            return (this.props.headType === '3DP');
        },
        isLaser: () => {
            const headType = this.props.headType;
            return (headType === 'LASER' || headType === 'LASER350' || headType === 'LASER1600');
        },
        run: () => {
            const { workflowState } = this.props;

            if (workflowState === WORKFLOW_STATE_IDLE) {
                // controller.command('gcode:start');
                this.props.executeGcode('start print file');
            }
            if (workflowState === WORKFLOW_STATE_PAUSED) {
                if (this.actions.is3DP()) {
                    this.pause3dpStatus.pausing = false;
                    const pos = this.pause3dpStatus.pos;
                    const cmd = `G1 X${pos.x} Y${pos.y} Z${pos.z} F1800\n`;
                    controller.command('gcode', cmd);
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
                if (this.props.sender.received >= this.props.sender.sent) {
                    this.pauseStatus = {
                        headStatus: this.props.headStatus,
                        headPower: this.props.headPower
                    };

                    if (this.pauseStatus.headStatus === 'on') {
                        controller.command('gcode', 'M5');
                    }

                    // toolhead has stopped
                    if (this.pause3dpStatus.pausing) {
                        this.pause3dpStatus.pausing = false;
                        const workPosition = this.props.workPosition;
                        this.pause3dpStatus.pos = {
                            x: Number(workPosition.x),
                            y: Number(workPosition.y),
                            z: Number(workPosition.z),
                            e: Number(workPosition.e)
                        };
                        const pos = this.pause3dpStatus.pos;
                        // experience params for retraction: F3000, E->(E-5)
                        const targetE = Math.max(pos.e - 5, 0);
                        const targetZ = Math.min(pos.z + 30, this.props.size.z);
                        const cmd = [
                            `G1 F3000 E${targetE}\n`,
                            `G1 Z${targetZ} F3000\n`,
                            `G1 F100 E${pos.e}\n`
                        ];
                        controller.command('gcode', cmd);
                    }
                } else {
                    this.actions.tryPause();
                }
            }, 50);
        },
        pause: () => {
            const { workflowState } = this.props;
            if ([WORKFLOW_STATE_RUNNING].includes(workflowState)) {
                controller.command('gcode:pause');

                if (this.actions.is3DP()) {
                    this.pause3dpStatus.pausing = true;
                    this.pause3dpStatus.pos = null;
                }

                this.actions.tryPause();
            }
        },
        stop: () => {
            const { workflowState } = this.props;
            if ([WORKFLOW_STATE_PAUSED].includes(workflowState)) {
                controller.command('gcode:stop');
            }
        }
        /*
        close: () => {
            const { workflowState } = this.props;
            if ([WORKFLOW_STATE_IDLE].includes(workflowState)) {
                controller.command('gcode:unload');
            }
        }
        */
    };

    render() {
        const { sender, gcodeFile, workflowState } = this.props;
        const { sent, total } = sender;
        const hasGcodeFile = !isEmpty(gcodeFile);
        const progress = total ? Number(sent / total).toFixed(2) : 0.0;
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
                    onChange={this.props.onChangeGcodeFile}
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
                {/*<button
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
                        {progress * 100.0}%  {sent} / {total}
                    </div>
                )}
                {hasGcodeFile && (
                    <div className={styles['visualizer-progress']}>
                        <ProgressBar progress={progress * 100.0} />
                    </div>
                )}
            </div>
        );
    }
}

export default GcodeFile;
