import React, { PureComponent } from 'react';
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
import styles from './styles.styl';


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
            this.update({ jogSpeed });
            return true;
        },
        onChangeWorkSpeed: (workSpeed) => {
            this.update({ workSpeed });
            return true;
        },
        onChangeDwellTime: (dwellTime) => {
            this.update({ dwellTime });
            return true;
        },
        onClickGenerateGcode: () => {
            pubsub.publish(ACTION_REQ_GENERATE_GCODE_LASER);
        }
    };

    subscriptions = [];

    update(state) {
        this.setState(state);
        pubsub.publish(ACTION_CHANGE_GENERATE_GCODE_LASER, state);
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
                                            value={state.jogSpeed}
                                            min={1}
                                            max={6000}
                                            step={1}
                                            onChange={actions.onChangeJogSpeed}
                                            disabled={disabled}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm/minute</span>
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
                                            value={state.workSpeed}
                                            min={1}
                                            step={1}
                                            max={6000}
                                            onChange={actions.onChangeWorkSpeed}
                                            disabled={disabled}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm/minute</span>
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
                                            value={state.dwellTime}
                                            min={0.1}
                                            max={1000}
                                            step={0.1}
                                            onChange={actions.onChangeDwellTime}
                                            disabled={state.stage < STAGE_PREVIEWED}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>ms/pixel</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>}
                    </tbody>
                </table>
                <button
                    type="button"
                    className="btn btn-default"
                    onClick={actions.onClickGenerateGcode}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%', margin: '10px 0 10px 0' }}
                >
                    GenerateGCode
                </button>
            </React.Fragment>
        );
    }
}

export default GenerateGcodeParameters;
