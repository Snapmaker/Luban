import isEmpty from 'lodash/isEmpty';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import OptionalDropdown from '../../components/OptionalDropdown';
import styles from './styles.styl';
import { ABSENT_VALUE } from '../../constants';


class GcodeConfig extends PureComponent {
    static propTypes = {
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        gcodeConfig: PropTypes.shape({
            jogSpeed: PropTypes.number.isRequired,
            workSpeed: PropTypes.number.isRequired,
            plungeSpeed: PropTypes.number.isRequired,
            dwellTime: PropTypes.number.isRequired,
            multiPassEnabled: PropTypes.bool,
            multiPassDepth: PropTypes.number,
            multiPasses: PropTypes.number,
            fixedPowerEnabled: PropTypes.bool,
            fixedPower: PropTypes.number,
        }),
        paramsDescs: PropTypes.shape({
            jogSpeed: PropTypes.string,
            workSpeed: PropTypes.string,
            plungeSpeed: PropTypes.string,
            dwellTime: PropTypes.string
        })
    };

    actions = {
        onChangeJogSpeed: (jogSpeed) => {
            this.props.updateSelectedModelGcodeConfig({ jogSpeed });
        },
        onChangeWorkSpeed: (workSpeed) => {
            this.props.updateSelectedModelGcodeConfig({ workSpeed });
        },
        onChangePlungeSpeed: (plungeSpeed) => {
            this.props.updateSelectedModelGcodeConfig({ plungeSpeed });
        },
        onChangeDwellTime: (dwellTime) => {
            this.props.updateSelectedModelGcodeConfig({ dwellTime });
        },
        // multi-pass
        onToggleMultiPassEnabled: () => {
            this.props.updateSelectedModelGcodeConfig({ multiPassEnabled: !this.props.gcodeConfig.multiPassEnabled });
        },
        onChangeMultiDepth: (multiPassDepth) => {
            this.props.updateSelectedModelGcodeConfig({ multiPassDepth });
        },
        onChangeMultiPasses: (multiPasses) => {
            this.props.updateSelectedModelGcodeConfig({ multiPasses });
        },
        // fixed power
        onToggleFixedPowerEnabled: () => {
            this.props.updateSelectedModelGcodeConfig({ fixedPowerEnabled: !this.props.gcodeConfig.fixedPowerEnabled });
        },
        onChangeFixedPower: (fixedPower) => {
            this.props.updateSelectedModelGcodeConfig({ fixedPower });
        }
    };

    render() {
        if (isEmpty(this.props.gcodeConfig)) {
            return null;
        }
        const actions = this.actions;
        const {
            jogSpeed, workSpeed, dwellTime, plungeSpeed,
            fixedPowerEnabled = null, fixedPower,
            multiPassEnabled = null, multiPasses, multiPassDepth
        } = this.props.gcodeConfig;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']}>
                    <tbody>
                        {jogSpeed !== ABSENT_VALUE && (
                            <tr>
                                <td>
                                    {i18n._('Jog Speed')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Jog Speed')}
                                        content={this.props.paramsDescs.jogSpeed}
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
                        )}
                        {workSpeed !== ABSENT_VALUE && (
                            <tr>
                                <td>
                                    {i18n._('Work Speed')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Work Speed')}
                                        content={this.props.paramsDescs.workSpeed}
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
                        )}
                        {dwellTime !== ABSENT_VALUE && (
                            <tr>
                                <td>
                                    {i18n._('Dwell Time')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Dwell Time')}
                                        content={this.props.paramsDescs.dwellTime}
                                    >
                                        <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                            <Input
                                                style={{ width: '45%' }}
                                                value={dwellTime}
                                                min={0.1}
                                                max={1000}
                                                step={0.1}
                                                onChange={actions.onChangeDwellTime}
                                            />
                                            <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>ms/dot</span>
                                        </div>
                                    </TipTrigger>
                                </td>
                            </tr>
                        )}
                        {plungeSpeed !== ABSENT_VALUE && (
                            <tr>
                                <td>
                                    {i18n._('Plunge Speed')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Plunge Speed')}
                                        content={this.props.paramsDescs.plungeSpeed}
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
                                            <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm/minute</span>
                                        </div>
                                    </TipTrigger>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {multiPassEnabled !== null && (
                    <OptionalDropdown
                        style={{ marginTop: '10px' }}
                        title={i18n._('Multi-pass')}
                        titleTip={i18n._('When enabled, the printer will run the G-code multiple times automatically according to the below settings. This feature helps you cut materials that can\'t be cut with only one pass.')}
                        onClick={actions.onToggleMultiPassEnabled}
                        hidden={!multiPassEnabled}
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
                                                    value={multiPasses}
                                                    onChange={actions.onChangeMultiPasses}
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
                                                    value={multiPassDepth}
                                                    onChange={actions.onChangeMultiDepth}
                                                />
                                                <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                            </div>
                                        </TipTrigger>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </OptionalDropdown>
                )}
                {fixedPowerEnabled !== null && (
                    <OptionalDropdown
                        style={{ marginTop: '10px' }}
                        title={i18n._('Fixed Power')}
                        titleTip={i18n._('When enabled, the power used to engrave this image will be set in the G-code, so it is not affected by the power you set in Workspace. When engraving multiple images, you can set the power for each image separately.')}
                        onClick={actions.onToggleFixedPowerEnabled}
                        hidden={!fixedPowerEnabled}
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
                                            <div
                                                style={{ display: 'inline-block', width: '60%', marginRight: '10%' }}
                                            >
                                                <Slider
                                                    value={fixedPower}
                                                    min={0}
                                                    max={100}
                                                    step={0.5}
                                                    onChange={actions.onChangeFixedPower}
                                                />
                                            </div>
                                            <Input
                                                style={{ display: 'inline-block', width: '30%' }}
                                                min={1}
                                                max={100}
                                                value={fixedPower}
                                                onChange={actions.onChangeFixedPower}
                                            />
                                        </TipTrigger>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </OptionalDropdown>
                )}
            </React.Fragment>
        );
    }
}

export default GcodeConfig;
