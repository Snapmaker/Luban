import React, { PureComponent } from 'react';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import Select from 'react-select';
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
        isWorking: false,
        exportModelFormatInfo: 'stl_binary'
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
        onChangeExportModelFormat: (option) => {
            this.setState({
                exportModelFormatInfo: option.value
            });
        },
        onClickExportModel: () => {
            const infos = this.state.exportModelFormatInfo.split('_');
            const format = infos[0];
            const isBinary = (infos.length > 1) ? (infos[1] === 'binary') : false;
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
                <table >
                    <tbody>
                        <tr style={{ width: '80%' }}>
                            <td style={{ paddingLeft: '0px', width: '60%' }}>
                                <Select
                                    clearable={false}
                                    options={[{
                                        value: 'stl_binary',
                                        label: i18n._('STL File (Binary) (*.stl)')
                                    }, {
                                        value: 'stl_ascii',
                                        label: i18n._('STL File (ASCII) (*.stl)')
                                    }, {
                                        value: 'obj',
                                        label: i18n._('OBJ File (*.obj)')
                                    }]}
                                    value={state.exportModelFormatInfo}
                                    searchable={false}
                                    onChange={actions.onChangeExportModelFormat}
                                />
                            </td>
                            <td style={{ paddingRight: '0px', width: '30%' }}>
                                <button
                                    type="button"
                                    className={classNames(styles['btn-large'], styles['btn-default'])}
                                    style={{ width: '100%' }}
                                    disabled={state.stage === STAGES_3DP.noModel}
                                    onClick={() => {
                                        actions.onClickExportModel();
                                    }}
                                >
                                    {i18n._('Export Models')}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={actions.onClickLoadGcode}
                    disabled={state.isWorking || state.stage < STAGES_3DP.gcodeRendered}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Load G-code to Workspace')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={actions.onClickExportGcode}
                    disabled={state.stage < STAGES_3DP.gcodeRendered}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Export G-code to file')}
                </button>
            </div>
        );
    }
}

export default Output;
