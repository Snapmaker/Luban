import React, { PureComponent } from 'react';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    ACTION_REQ_LOAD_GCODE_3DP,
    ACTION_REQ_EXPORT_GCODE_3DP,
    ACTION_CHANGE_STAGE_3DP,
    STAGE_IDLE,
    STAGE_GENERATED,
    ACTION_3DP_GCODE_OVERSTEP_CHANGE
} from '../../constants';
import controller from '../../lib/controller';
import styles from '../styles.styl';


class Output extends PureComponent {
    isGcodeOverstepped = true;
    state = {
        stage: STAGE_IDLE,
        isReady: false
    };

    actions = {
        onClickLoadGcode: () => {
            if (this.isGcodeOverstepped) {
                //todo: show alert
                return;
            }
            pubsub.publish(ACTION_REQ_LOAD_GCODE_3DP);
        },
        onClickExportGcode: () => {
            if (this.isGcodeOverstepped) {
                //todo: show alert
                return;
            }
            pubsub.publish(ACTION_REQ_EXPORT_GCODE_3DP);
        }
    };

    subscriptions = [];

    controllerEvents = {
        'serialport:open': (options) => {
            this.setState({ isReady: true });
        },
        'serialport:close': (options) => {
            this.setState({ isReady: false });
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
                    disabled={state.stage < STAGE_GENERATED || !state.isReady}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    Load G-code to Workspace
                </button>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={actions.onClickExportGcode}
                    disabled={state.stage < STAGE_GENERATED}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    Export G-code to file
                </button>
            </div>
        );
    }
}

export default Output;
