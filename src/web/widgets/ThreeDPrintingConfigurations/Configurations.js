import React, { PureComponent } from 'react';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    ACTION_CHANGE_STAGE_3DP,
    ACTION_REQ_GENERATE_GCODE_3DP
} from '../../constants';
import styles from '../styles.styl';


const PRINTING_TYPE_FAST_PRINT = 'FAST_PRINT';
// const PRINTING_TYPE_NORMAL_QUALITY = 'NORMAL_QUALITY';
// const PRINTING_TYPE_HIGH_QUALITY = 'HIGH_QUALITY';
// const PRINTING_TYPE_CUSTOM = 'CUSTOM';


class Configurations extends PureComponent {
    state = {
        stage: STAGE_IDLE,
        configType: PRINTING_TYPE_FAST_PRINT
    };

    actions = {
        onClickGenerateGcode: () => {
            // request generate G-code directly
            pubsub.publish(ACTION_REQ_GENERATE_GCODE_3DP);
        }
    };

    subscriptions = [];

    componentDidMount() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_STAGE_3DP, (msg, state) => {
                this.setState(state);
            })
        ];
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        const disabled = state.stage < STAGE_IMAGE_LOADED;

        return (
            <div>
                <p>{state.configType}</p>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-green'])}
                    onClick={actions.onClickGenerateGcode}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    Generate G-code
                </button>
            </div>
        );
    }
}

export default Configurations;
