import React, { PureComponent } from 'react';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    ACTION_REQ_GENERATE_GCODE_LASER,
    ACTION_CHANGE_STAGE_LASER,
    ACTION_CHANGE_PARAMETER_LASER,
    ACTION_CHANGE_GENERATE_GCODE_LASER
} from '../../constants';
import TipTrigger from '../../components/TipTrigger';
import { InputWithValidation as Input } from '../../components/Input';
import styles from '../styles.styl';


class GenerateGcodeParameters extends PureComponent {
    state = {
        stage: STAGE_IMAGE_LOADED,
        mode: 'bw',
        jogSpeed: 1500,
        workSpeed: 288,
        dwellTime: 42
    };

    actions = {
        onChangeJogSpeed: (jogSpeed) => {
            return this.update({ jogSpeed });
        },
        onChangeWorkSpeed: (workSpeed) => {
            return this.update({ workSpeed });
        },
        onChangeDwellTime: (dwellTime) => {
            return this.update({ dwellTime });
        },
        onClickGenerateGcode: () => {
            pubsub.publish(ACTION_REQ_GENERATE_GCODE_LASER);
        }
    };

    subscriptions = [];

    update(state) {
        this.setState(state);
        pubsub.publish(ACTION_CHANGE_GENERATE_GCODE_LASER, state);

        return true;
    }

    componentDidMount() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_STAGE_LASER, (msg, data) => {
                this.setState(data);
            }),
            pubsub.subscribe(ACTION_CHANGE_PARAMETER_LASER, (msg, data) => {
                if (data.mode && data.mode !== this.state.mode) {
                    this.setState({ mode: data.mode });
                }
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
        const disabled = state.stage < STAGE_PREVIEWED;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']}>
                    <tbody>
                        { state.mode !== 'greyscale' &&
                        <tr>
                            <td>
                                Jog Speed
                            </td>
                            <td>
                                <TipTrigger title="Jog Speed" content="Determines how fast the machine moves when it’s not engraving.">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={state.jogSpeed}
                                            min={1}
                                            max={6000}
                                            step={1}
                                            onChange={actions.onChangeJogSpeed}
                                            disabled={disabled}
                                        />
                                        <span className={styles.descriptionText} style={{ margin: '8px 0 6px 4px' }}>mm/minute</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>}
                        <tr>
                            <td>
                                Work Speed
                            </td>
                            <td>
                                <TipTrigger title="Work Speed" content="Determines how fast the machine moves when it’s engraving.">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={state.workSpeed}
                                            min={1}
                                            step={1}
                                            max={6000}
                                            onChange={actions.onChangeWorkSpeed}
                                            disabled={disabled}
                                        />
                                        <span className={styles.descriptionText} style={{ margin: '8px 0 6px 4px' }}>mm/minute</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        { state.mode === 'greyscale' &&
                        <tr>
                            <td>
                                Dwell Time
                            </td>
                            <td>
                                <TipTrigger title="Dwell Time" content="Determines how long the laser keeps on when it’s engraving a dot.">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={state.dwellTime}
                                            min={0.1}
                                            max={1000}
                                            step={0.1}
                                            onChange={actions.onChangeDwellTime}
                                            disabled={state.stage < STAGE_PREVIEWED}
                                        />
                                        <span className={styles.descriptionText} style={{ margin: '8px 0 6px 4px' }}>ms/pixel</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>}
                    </tbody>
                </table>
                <button
                    type="button"
                    className={classNames(styles.btn, styles.btnLargeGreen)}
                    onClick={actions.onClickGenerateGcode}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    Generate G-code
                </button>
            </React.Fragment>
        );
    }
}

export default GenerateGcodeParameters;
