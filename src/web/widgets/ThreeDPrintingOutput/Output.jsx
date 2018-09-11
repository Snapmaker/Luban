import React, { PureComponent } from 'react';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    ACTION_REQ_LOAD_GCODE_3DP,
    ACTION_REQ_EXPORT_GCODE_3DP,
    ACTION_CHANGE_STAGE_3DP,
    ACTION_3DP_GCODE_OVERSTEP_CHANGE,
    ACTION_3DP_EXPORT_MODEL,
    STAGES_3DP
} from '../../constants';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import modal from '../../lib/modal';
import styles from '../styles.styl';


class Output extends PureComponent {
    isGcodeOverstepped = true;
    state = {
        stage: STAGES_3DP.noModel,
        isWorking: false
    };

    actions = {
        onClickLoadGcode: () => {
            if (this.isGcodeOverstepped) {
                modal({
                    title: 'Warning',
                    body: 'Generated G-code overstepped out of the cube, please modify your model and re-generate G-code.'
                });
                return;
            }
            pubsub.publish(ACTION_REQ_LOAD_GCODE_3DP);
        },
        onClickExportGcode: () => {
            if (this.isGcodeOverstepped) {
                modal({
                    title: 'Warning',
                    body: 'Generated G-code overstepped out of the cube, please modify your model and re-generate G-code.'
                });
                return;
            }
            pubsub.publish(ACTION_REQ_EXPORT_GCODE_3DP);
        },
        onClickExportModel: (format, isBinary) => {
            pubsub.publish(ACTION_3DP_EXPORT_MODEL, { format: format, isBinary: isBinary });
        }
    };

    subscriptions = [];

    controllerEvents = {
        'workflow:state': (workflowState) => {
            this.setState({ isWorking: workflowState === 'running' });
        }
    };

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

    componentDidMount() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_STAGE_3DP, (msg, state) => {
                this.setState(state);
            }),
            pubsub.subscribe(ACTION_3DP_GCODE_OVERSTEP_CHANGE, (msg, state) => {
                this.isGcodeOverstepped = state.overstepped;
            })
        ];

        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];

        this.removeControllerEvents();
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        return (
            <div>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={actions.onClickLoadGcode}
                    disabled={state.isWorking || state.stage < STAGES_3DP.gcodeRendered}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Load G-code to Workspace')}
                </button>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={actions.onClickExportGcode}
                    disabled={state.stage < STAGES_3DP.gcodeRendered}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Export G-code to file')}
                </button>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={() => {
                        actions.onClickExportModel('stl', true);
                    }}
                    disabled={state.stage === STAGES_3DP.noModel}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Export As STL File (Binary)')}
                </button>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={() => {
                        actions.onClickExportModel('stl', false);
                    }}
                    disabled={state.stage === STAGES_3DP.noModel}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Export As STL File (ASCII)')}
                </button>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={() => {
                        actions.onClickExportModel('obj');
                    }}
                    disabled={state.stage === STAGES_3DP.noModel}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Export As OBJ File')}
                </button>
            </div>
        );
    }
}

export default Output;
