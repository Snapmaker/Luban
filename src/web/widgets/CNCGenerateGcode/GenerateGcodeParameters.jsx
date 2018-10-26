import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import {
    STAGE_PREVIEWED
} from '../../constants';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions } from '../../reducers/modules/cnc';
import styles from '../styles.styl';

class GenerateGcodeParameters extends PureComponent {
    static propTypes = {
        // from redux
        state: PropTypes.object.isRequired,
        changeGcodeParams: PropTypes.func.isRequired,
        generateGCode: PropTypes.func.isRequired
    };

    state = {
        jogSpeed: 800,
        workSpeed: 300,
        plungeSpeed: 500
    };

    actions = {
        onChangeJogSpeed: (jogSpeed) => {
            this.props.changeGcodeParams({ jogSpeed: jogSpeed });
        },
        onChangeWorkSpeed: (workSpeed) => {
            this.props.changeGcodeParams({ workSpeed: workSpeed });
        },
        onChangePlungeSpeed: (plungeSpeed) => {
            this.props.changeGcodeParams({ plungeSpeed: plungeSpeed });
        },
        onClickGenerateGcode: () => {
            this.props.generateGCode(this.props.state);
        }
    };

    render() {
        const gcodeParams = { ...this.props.state.gcodeParams };
        const actions = this.actions;
        const disabled = this.props.state.stage < STAGE_PREVIEWED;
        return (
            <React.Fragment>
                <table className={styles['parameter-table']}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('Jog Speed')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Jog Speed')}
                                    content={i18n._('Determines how fast the tool moves when it’s not carving.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={gcodeParams.jogSpeed}
                                            min={1}
                                            max={6000}
                                            step={10}
                                            onChange={actions.onChangeJogSpeed}
                                            disabled={disabled}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm/minute</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Work Speed')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Work Speed')}
                                    content={i18n._('Determines how fast the tool moves on the material.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={gcodeParams.workSpeed}
                                            min={1}
                                            max={3600}
                                            step={10}
                                            onChange={actions.onChangeWorkSpeed}
                                            disabled={disabled}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm/minute</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Plunge Speed')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Plunge Speed')}
                                    content={i18n._('Determines how fast the tool feeds into the material.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={gcodeParams.plungeSpeed}
                                            min={1}
                                            max={3600}
                                            step={10}
                                            onChange={actions.onChangePlungeSpeed}
                                            disabled={disabled}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm/minute</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-success'])}
                    onClick={actions.onClickGenerateGcode}
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
    return {
        state: state.cnc
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changeGcodeParams: (params) => dispatch(actions.changeGcodeParams(params)),
        generateGCode: (state) => dispatch(actions.generateGCode(state))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(GenerateGcodeParameters);
