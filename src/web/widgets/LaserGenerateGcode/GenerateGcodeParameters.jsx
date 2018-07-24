import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import pubsub from 'pubsub-js';
import {
    STAGE_PREVIEWED,
    ACTION_REQ_GENERATE_GCODE_LASER,
    ACTION_CHANGE_PARAMETER_LASER
} from '../../constants';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import { actions } from '../../reducers/modules/laser';
import styles from '../styles.styl';


class GenerateGcodeParameters extends PureComponent {
    static propTypes = {
        stage: PropTypes.number.isRequired,
        target: PropTypes.shape({
            jogSpeed: PropTypes.number.isRequired,
            workSpeed: PropTypes.number.isRequired,
            dwellTime: PropTypes.number.isRequired
        }),
        setTarget: PropTypes.func.isRequired,
        generateGcode: PropTypes.func.isRequired
    };

    state = {
        mode: 'bw'
    };

    actions = {
        onChangeJogSpeed: (jogSpeed) => {
            this.props.setTarget({ jogSpeed });
        },
        onChangeWorkSpeed: (workSpeed) => {
            this.props.setTarget({ workSpeed });
        },
        onChangeDwellTime: (dwellTime) => {
            this.props.setTarget({ dwellTime });
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

    componentDidMount() {
        this.subscriptions = [
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
        const { jogSpeed, workSpeed, dwellTime } = this.props.target;
        const mode = this.state.mode;
        const disabled = this.props.stage < STAGE_PREVIEWED;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']}>
                    <tbody>
                        { mode !== 'greyscale' &&
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
                                            value={jogSpeed}
                                            min={1}
                                            max={6000}
                                            step={1}
                                            onChange={this.actions.onChangeJogSpeed}
                                            disabled={disabled}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm/minute</span>
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
                                            value={workSpeed}
                                            min={1}
                                            step={1}
                                            max={6000}
                                            onChange={this.actions.onChangeWorkSpeed}
                                            disabled={disabled}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm/minute</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        { mode === 'greyscale' &&
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
                                            value={dwellTime}
                                            min={0.1}
                                            max={1000}
                                            step={0.1}
                                            onChange={this.actions.onChangeDwellTime}
                                            disabled={disabled}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>ms/pixel</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>}
                    </tbody>
                </table>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-green'])}
                    onClick={this.actions.onClickGenerateGcode}
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
        stage: state.laser.stage,
        target: state.laser.target
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setTarget: (params) => dispatch(actions.targetSetState(params)),
        generateGcode: () => dispatch(actions.generateGcode())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(GenerateGcodeParameters);
