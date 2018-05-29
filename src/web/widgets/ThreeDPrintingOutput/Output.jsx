import React, { PureComponent } from 'react';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    ACTION_REQ_LOAD_GCODE_3DP,
    ACTION_REQ_EXPORT_GCODE_3DP,
    ACTION_CHANGE_STAGE_3DP,
    STAGE_IDLE,
    STAGE_GENERATED
} from '../../constants';
import controller from '../../lib/controller';
import styles from '../styles.styl';


class Output extends PureComponent {
    state = {
        stage: STAGE_IDLE,
        isReady: false
    };

    actions = {
        onClickLoadGcode: () => {
            pubsub.publish(ACTION_REQ_LOAD_GCODE_3DP);
        },
        onClickExportGcode: () => {
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
        const disabled = state.stage < STAGE_GENERATED || !state.isReady;

        return (
            <div>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={actions.onClickLoadGcode}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    Load G-code to Workspace
                </button>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={actions.onClickExportGcode}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    Export G-code to file
                </button>
            </div>
        );
    }
}

export default Output;
