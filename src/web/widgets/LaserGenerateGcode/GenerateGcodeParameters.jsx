import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import pubsub from 'pubsub-js';
import {
    STAGE_PREVIEWED,
    ACTION_REQ_GENERATE_GCODE_LASER,
    // ACTION_CHANGE_STAGE_LASER,
    ACTION_CHANGE_PARAMETER_LASER,
    ACTION_CHANGE_GENERATE_GCODE_LASER
} from '../../constants';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import { actions } from '../../reducers/modules/laser';
import styles from '../styles.styl';


class GenerateGcodeParameters extends PureComponent {
    static propTypes = {
        stage: PropTypes.number.isRequired,
        generateGcode: PropTypes.func.isRequired
    };

    state = {
        mode: 'bw',
        jogSpeed: 1500,
        workSpeed: 288,
        dwellTime: 42
    };

    actions = {
        onChangeJogSpeed: (jogSpeed) => {
            this.update({ jogSpeed });
        },
        onChangeWorkSpeed: (workSpeed) => {
            this.update({ workSpeed });
        },
        onChangeDwellTime: (dwellTime) => {
            this.update({ dwellTime });
        },
        onClickGenerateGcode: () => {
            const { mode } = this.state;
            if (mode === 'text') {
                this.props.generateGcode();
            } else {
                pubsub.publish(ACTION_REQ_GENERATE_GCODE_LASER);
            }
        }
    };

    subscriptions = [];

    update(state) {
        this.setState(state);
        pubsub.publish(ACTION_CHANGE_GENERATE_GCODE_LASER, state);
    }

    componentDidMount() {
        this.subscriptions = [
            // pubsub.subscribe(ACTION_CHANGE_STAGE_LASER, (msg, data) => {
            //     this.setState(data);
            // }),
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
        const { stage } = this.props;
        const disabled = stage < STAGE_PREVIEWED;

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
                                <TipTrigger
                                    title={i18n._('Jog Speed')}
                                    content={i18n._('Determines how fast the machine moves when it’s not engraving.')}
                                >
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
                                <TipTrigger
                                    title={i18n._('Work Speed')}
                                    content={i18n._('Determines how fast the machine moves when it’s engraving.')}
                                >
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
                                <TipTrigger
                                    title={i18n._('Dwell Time')}
                                    content={i18n._('Determines how long the laser keeps on when it’s engraving a dot.')}
                                >
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

const mapStateToProps = (state) => {
    return {
        stage: state.laser.stage
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        generateGcode: () => dispatch(actions.generateGcode())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(GenerateGcodeParameters);
