import React, { PureComponent } from 'react';
import pubsub from 'pubsub-js';
import {
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    ACTION_REQ_GENERATE_GCODE_CNC,
    ACTION_CHANGE_STAGE_CNC,
    ACTION_CHANGE_GENERATE_GCODE_CNC
} from '../../constants';
import { InputWithValidation as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './styles.styl';


class GenerateGcodeParameters extends PureComponent {
    state = {
        stage: STAGE_IMAGE_LOADED,
        jogSpeed: 800,
        workSpeed: 300,
        plungeSpeed: 500
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
        onChangePlungeSpeed: (plungeSpeed) => {
            this.update({ plungeSpeed });
            return true;
        },
        onClickGenerateGcode: () => {
            pubsub.publish(ACTION_REQ_GENERATE_GCODE_CNC);
        }
    };

    subscriptions = [];

    update(state) {
        this.setState(state);
        pubsub.publish(ACTION_CHANGE_GENERATE_GCODE_CNC, state);
    }

    componentDidMount() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_STAGE_CNC, (msg, data) => {
                this.setState(data);
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
                        <tr>
                            <td>
                                Jog Speed
                            </td>
                            <td>
                                <TipTrigger title="Jog Speed" content="Determines how fast the tool moves when it’s not carving.">
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.jogSpeed}
                                            min={1}
                                            max={6000}
                                            step={10}
                                            onChange={actions.onChangeJogSpeed}
                                            disabled={disabled}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm/minute</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Work Speed
                            </td>
                            <td>
                                <TipTrigger title="Work Speed" content="Determines how fast the tool moves on the meterial.">
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.workSpeed}
                                            min={1}
                                            max={3600}
                                            step={10}
                                            onChange={actions.onChangeWorkSpeed}
                                            disabled={disabled}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm/minute</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Plunge Speed
                            </td>
                            <td>
                                <TipTrigger title="Plunge Speed" content="Determines how fast the tool feeds into the material.">
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.plungeSpeed}
                                            min={1}
                                            max={3600}
                                            step={10}
                                            onChange={actions.onChangePlungeSpeed}
                                            disabled={disabled}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm/minute</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
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
