import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { STAGE_PREVIEWED } from '../../constants';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import { actions } from '../../reducers/modules/laser';
import styles from '../styles.styl';


class GenerateGcodeParameters extends PureComponent {
    static propTypes = {
        mode: PropTypes.string.isRequired,
        stage: PropTypes.number.isRequired,
        target: PropTypes.shape({
            jogSpeed: PropTypes.number.isRequired,
            workSpeed: PropTypes.number.isRequired,
            dwellTime: PropTypes.number.isRequired
        }),

        // redux actions
        setTarget: PropTypes.func.isRequired,
        generateGcode: PropTypes.func.isRequired
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
        }
    };

    render() {
        const { mode, stage, target, generateGcode } = this.props;

        const disabled = stage < STAGE_PREVIEWED;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']}>
                    <tbody>
                        {mode !== 'greyscale' &&
                        <tr>
                            <td>
                                {i18n._('Jog Speed')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Jog Speed')}
                                    content={i18n._('Determines how fast the machine moves when it’s not engraving.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={target.jogSpeed}
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
                        </tr>
                        }
                        <tr>
                            <td>
                                {i18n._('Work Speed')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Work Speed')}
                                    content={i18n._('Determines how fast the machine moves when it’s engraving.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={target.workSpeed}
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
                        {mode === 'greyscale' &&
                        <tr>
                            <td>
                                {i18n._('Dwell Time')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Dwell Time')}
                                    content={i18n._('Determines how long the laser keeps on when it’s engraving a dot.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={target.dwellTime}
                                            min={0.1}
                                            max={1000}
                                            step={0.1}
                                            onChange={this.actions.onChangeDwellTime}
                                            disabled={disabled}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>ms/dot</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        }
                    </tbody>
                </table>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-green'])}
                    onClick={generateGcode}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    {i18n._('Generate G-code')}
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const laser = state.laser;
    return {
        mode: laser.mode,
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
