import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import styles from '../styles.styl';
import { actions } from '../../reducers/cnc';


class GcodeConfig extends PureComponent {
    static propTypes = {
        model: PropTypes.object,
        jogSpeed: PropTypes.number,
        workSpeed: PropTypes.number,
        plungeSpeed: PropTypes.number,
        updateGcodeConfig: PropTypes.func.isRequired
    };

    actions = {
        onChangeJogSpeed: (jogSpeed) => {
            this.props.updateGcodeConfig({ jogSpeed });
        },
        onChangeWorkSpeed: (workSpeed) => {
            this.props.updateGcodeConfig({ workSpeed });
        },
        onChangePlungeSpeed: (plungeSpeed) => {
            this.props.updateGcodeConfig({ plungeSpeed });
        }
    };

    render() {
        if (!this.props.model) {
            return null;
        }

        const { jogSpeed, workSpeed, plungeSpeed } = this.props;
        const actions = this.actions;

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
                                    content={i18n._('Determines how fast the machine moves when it’s not engraving.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={jogSpeed}
                                            min={1}
                                            max={6000}
                                            step={1}
                                            onChange={actions.onChangeJogSpeed}
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
                                    content={i18n._('Determines how fast the machine moves when it’s engraving.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={workSpeed}
                                            min={1}
                                            step={1}
                                            max={6000}
                                            onChange={actions.onChangeWorkSpeed}
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
                                    title={i18n._('Dwell Time')}
                                    content={i18n._('Determines how long the laser keeps on when it’s engraving a dot.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={plungeSpeed}
                                            min={0.1}
                                            max={1000}
                                            step={0.1}
                                            onChange={actions.onChangePlungeSpeed}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>ms/dot</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { model, gcodeConfig } = state.cnc;
    const { jogSpeed, workSpeed, plungeSpeed } = gcodeConfig;
    return {
        model: model,
        jogSpeed: jogSpeed,
        workSpeed: workSpeed,
        plungeSpeed: plungeSpeed
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateGcodeConfig: (params) => dispatch(actions.updateGcodeConfig(params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(GcodeConfig);

