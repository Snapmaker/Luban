import _ from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import i18n from '../../lib/i18n';
import TipTrigger from '../TipTrigger';
import { NumberInput as Input } from '../Input';
import OptionalDropdown from '../OptionalDropdown';
import styles from '../../widgets/styles.styl';


class GcodeConfig extends PureComponent {
    static propTypes = {
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        gcodeConfig: PropTypes.shape({
            jogSpeed: PropTypes.number,
            workSpeed: PropTypes.number,
            dwellTime: PropTypes.number,
            multiPassEnabled: PropTypes.bool,
            multiPassDepth: PropTypes.number,
            multiPasses: PropTypes.number,
            fixedPowerEnabled: PropTypes.bool,
            fixedPower: PropTypes.number,
        })
    };

    actions = {
        onChangeJogSpeed: (jogSpeed) => {
            this.props.updateSelectedModelGcodeConfig({ jogSpeed });
        },
        onChangeWorkSpeed: (workSpeed) => {
            this.props.updateSelectedModelGcodeConfig({ workSpeed });
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
        if (_.isEmpty(this.props.gcodeConfig)) {
            return null;
        }

        const {
            jogSpeed, workSpeed, dwellTime,
            fixedPowerEnabled, fixedPower,
            multiPassEnabled, multiPasses, multiPassDepth
        } = this.props.gcodeConfig;
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
                        {workSpeed !== null && workSpeed !== undefined &&
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
                        }
                        {dwellTime !== null && dwellTime !== undefined &&
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
                        }
                    </tbody>
                </table>
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
                                            <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>
                                                mm
                                            </span>
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
                                        <td style={{ width: '100%', paddingRight: '15px' }}>
                                            <Slider
                                                value={fixedPower}
                                                min={0}
                                                max={100}
                                                step={0.5}
                                                onChange={actions.onChangeFixedPower}
                                            />
                                        </td>
                                        <td style={{ width: '48px' }}>
                                            <Input
                                                min={1}
                                                max={100}
                                                value={fixedPower}
                                                onChange={actions.onChangeFixedPower}
                                            />
                                        </td>
                                    </TipTrigger>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </OptionalDropdown>
            </React.Fragment>
        );
    }
}

export default GcodeConfig;

