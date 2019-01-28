import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import OptionalDropdown from '../../components/OptionalDropdown';
import styles from '../styles.styl';
import { actions } from '../../reducers/modules/laser';


class GcodeConfig extends PureComponent {
    static propTypes = {
        model: PropTypes.object,
        modelType: PropTypes.string,
        processMode: PropTypes.string,
        movementMode: PropTypes.string,
        jogSpeed: PropTypes.number,
        workSpeed: PropTypes.number,
        dwellTime: PropTypes.number,
        multiPassEnabled: PropTypes.bool,
        multiPassDepth: PropTypes.number,
        multiPasses: PropTypes.number,
        fixedPowerEnabled: PropTypes.bool,
        fixedPower: PropTypes.number,
        updateGcodeConfig: PropTypes.func.isRequired
    };

    actions = {
        onChangeJogSpeed: (jogSpeed) => {
            this.props.updateGcodeConfig({ jogSpeed });
        },
        onChangeWorkSpeed: (workSpeed) => {
            this.props.updateGcodeConfig({ workSpeed });
        },
        onChangeDwellTime: (dwellTime) => {
            this.props.updateGcodeConfig({ dwellTime });
        },
        // multi-pass
        onToggleMultiPassEnabled: () => {
            this.props.updateGcodeConfig({ multiPassEnabled: !this.props.multiPassEnabled });
        },
        onChangeMultiDepth: (multiPassDepth) => {
            this.props.updateGcodeConfig({ multiPassDepth });
        },
        onChangeMultiPasses: (multiPasses) => {
            this.props.updateGcodeConfig({ multiPasses });
        },
        // fixed power
        onToggleFixedPowerEnabled: () => {
            this.props.updateGcodeConfig({ fixedPowerEnabled: !this.props.fixedPowerEnabled });
        },
        onChangeFixedPower: (fixedPower) => {
            this.props.updateGcodeConfig({ fixedPower });
        }
    };

    render() {
        if (!this.props.model) {
            return null;
        }

        const {
            modelType, processMode, movementMode,
            jogSpeed, workSpeed, dwellTime, fixedPowerEnabled, fixedPower,
            multiPassEnabled, multiPasses, multiPassDepth
        } = this.props;

        let combinedType = `${modelType}-${processMode}`;
        if (combinedType === 'raster-greyscale') {
            combinedType = `${combinedType}_${movementMode}`;
        }

        const actions = this.actions;
        return (
            <React.Fragment>
                <table className={styles['parameter-table']}>
                    <tbody>
                        {(['raster-bw', 'raster-greyscale_greyscale-line', 'raster-greyscale_greyscale-dot', 'raster-vector', 'svg-vector', 'text-vector'].includes(combinedType)) &&
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
                        }
                        {(['raster-bw', 'raster-greyscale_greyscale-line', 'raster-vector', 'svg-vector', 'text-vector'].includes(combinedType)) &&
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
                        {(['raster-greyscale_greyscale-dot'].includes(combinedType)) &&
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

const mapStateToProps = (state) => {
    const { model, gcodeConfig, modelType, processMode } = state.laser;
    const movementMode = model.modelInfo.config.movementMode;
    const { jogSpeed, workSpeed, dwellTime, fixedPowerEnabled,
        fixedPower, multiPassEnabled, multiPasses, multiPassDepth } = gcodeConfig;
    return {
        model: model,
        modelType: modelType,
        processMode: processMode,
        movementMode: movementMode,
        jogSpeed: jogSpeed,
        workSpeed: workSpeed,
        dwellTime: dwellTime,
        fixedPowerEnabled: fixedPowerEnabled,
        fixedPower: fixedPower,
        multiPassEnabled: multiPassEnabled,
        multiPasses: multiPasses,
        multiPassDepth: multiPassDepth
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateGcodeConfig: (params) => dispatch(actions.updateGcodeConfig(params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(GcodeConfig);

