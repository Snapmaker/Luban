import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import { STAGE_PREVIEWED } from '../../constants';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import OptionalDropdown from '../../components/OptionalDropdown';
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
        multiPass: PropTypes.object.isRequired,

        // redux actions
        setTarget: PropTypes.func.isRequired,
        generateGcode: PropTypes.func.isRequired,
        multiPassSetState: PropTypes.func.isRequired
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
        // multi-pass
        onToggleMultiPass: () => {
            this.props.multiPassSetState({ enabled: !this.props.multiPass.enabled });
        },
        onChangeDepth: (depth) => {
            this.props.multiPassSetState({ depth });
        },
        onChangePasses: (passes) => {
            this.props.multiPassSetState({ passes });
        },
        // fixed power
        onToggleFixedPowerEnabled: () => {
            this.props.setTarget({ fixedPowerEnabled: !this.props.target.fixedPowerEnabled });
        },
        onSelectPower: (power) => {
            this.props.setTarget({ fixedPower: power });
        }
    };

    render() {
        const { mode, stage, target, generateGcode, multiPass } = this.props;
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
                <OptionalDropdown
                    style={{ marginTop: '10px' }}
                    title={i18n._('Multi-pass')}
                    titleTip={i18n._('When enabled, the printer will run the G-code multiple times automatically according to the below settings. This feature helps you cut materials that can\'t be cut with only one pass.')}
                    onClick={this.actions.onToggleMultiPass}
                    hidden={!multiPass.enabled}
                >
                    <table className={styles['parameter-table']}>
                        <tbody>
                            <tr>
                                <td>
                                    {i18n._('Passes')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Passes')}
                                        content={i18n._('Determines how many times the printer will run the G-code automatically.')}
                                    >
                                        <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                            <Input
                                                style={{ width: '45%' }}
                                                min={2}
                                                max={50}
                                                value={multiPass.passes}
                                                onChange={this.actions.onChangePasses}
                                            />
                                        </div>
                                    </TipTrigger>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    {i18n._('Pass Depth')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Pass Depth')}
                                        content={i18n._('Determines how much the laser module will be lowered after each pass.')}
                                    >
                                        <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                            <Input
                                                style={{ width: '45%' }}
                                                min={0}
                                                max={10}
                                                value={multiPass.depth}
                                                onChange={this.actions.onChangeDepth}
                                            />
                                            <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                        </div>
                                    </TipTrigger>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </OptionalDropdown>
                <OptionalDropdown
                    style={{ marginTop: '10px' }}
                    title={i18n._('Fixed Power')}
                    titleTip={i18n._('When enabled, the power used to engrave this image will be set in the G-code, so it is not affected by the power you set in Workspace.')}
                    onClick={this.actions.onToggleFixedPowerEnabled}
                    hidden={!target.fixedPowerEnabled}
                >
                    <table className={styles['parameter-table']}>
                        <tbody>
                            <tr>
                                <td>
                                    {i18n._('Power (%)')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Power')}
                                        content={i18n._('Power to use when laser is working.')}
                                    >
                                        <td style={{ width: '100%', paddingRight: '15px' }}>
                                            <Slider
                                                value={target.fixedPower}
                                                min={0}
                                                max={100}
                                                step={0.5}
                                                onChange={this.actions.onSelectPower}
                                            />
                                        </td>
                                        <td style={{ width: '48px' }}>
                                            <Input
                                                min={1}
                                                max={100}
                                                value={target.fixedPower}
                                                onChange={this.actions.onSelectPower}
                                            />
                                        </td>
                                    </TipTrigger>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </OptionalDropdown>
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
        target: state.laser.target,
        multiPass: state.laser.multiPass
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setTarget: (params) => dispatch(actions.targetSetState(params)),
        generateGcode: () => dispatch(actions.generateGcode()),
        multiPassSetState: (multiPass) => dispatch(actions.multiPassSetState(multiPass))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(GenerateGcodeParameters);
