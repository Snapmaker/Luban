import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import i18n from '../../lib/i18n';
import Space from '../../components/Space';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown';
import styles from './styles.styl';
import { actions } from '../../reducers/modules/laser';


class ConfigRasterVector extends PureComponent {
    static propTypes = {
        modelType: PropTypes.string.isRequired,
        processMode: PropTypes.string.isRequired,
        optimizePath: PropTypes.bool,
        fillEnabled: PropTypes.bool,
        fillDensity: PropTypes.number,
        vectorThreshold: PropTypes.number,
        isInvert: PropTypes.bool,
        turdSize: PropTypes.number,
        updateConfig: PropTypes.func.isRequired
    };

    actions = {
        changeVectorThreshold: (vectorThreshold) => {
            this.props.updateConfig({ vectorThreshold });
        },
        onChangeTurdSize: (turdSize) => {
            this.props.updateConfig({ turdSize });
        },
        onToggleInvert: (event) => {
            this.props.updateConfig({ isInvert: event.target.checked });
        },
        onToggleFill: () => {
            this.props.updateConfig({ fillEnabled: !this.props.fillEnabled });
        },
        onChangeFillDensity: (fillDensity) => {
            this.props.updateConfig({ fillDensity });
        },
        onToggleOptimizePath: (event) => {
            this.props.updateConfig({ optimizePath: event.target.checked });
        }
    };

    render() {
        const { modelType, processMode } = this.props;
        if (`${modelType}-${processMode}` !== 'raster-vector') {
            return null;
        }

        const { optimizePath, fillEnabled, fillDensity, vectorThreshold, isInvert, turdSize } = this.props;
        const actions = this.actions;

        return (
            <div>
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('B&W')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('B&W')}
                                    content={i18n._('Set the proportion of the black color based on the original color of the image.')}
                                >
                                    <div className="text-center">{vectorThreshold}</div>
                                    <Slider
                                        style={{ padding: 0 }}
                                        defaultValue={vectorThreshold}
                                        min={0}
                                        max={255}
                                        step={1}
                                        onChange={actions.changeVectorThreshold}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Impurity Size')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Impurity Size')}
                                    content={i18n._('Determines the minimum size of impurity which allows to be showed.')}
                                >
                                    <Input
                                        value={turdSize}
                                        min={0}
                                        max={10000}
                                        onChange={actions.onChangeTurdSize}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td />
                            <td>
                                <TipTrigger
                                    title={i18n._('Invert')}
                                    content={i18n._('Inverts black to white and vise versa.')}
                                >
                                    <input type="checkbox" checked={isInvert} onChange={actions.onToggleInvert} /> <span>{i18n._('Invert')}</span>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td />
                            <td>
                                <TipTrigger
                                    title={i18n._('Optimize Path')}
                                    content={i18n._('Optimizes the path based on the proximity of the lines in the image.')}
                                >
                                    <input
                                        type="checkbox"
                                        checked={optimizePath}
                                        onChange={actions.onToggleOptimizePath}
                                    />
                                    <Space width={4} />
                                    <span>{i18n._('Optimize Path')}</span>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <OptionalDropdown
                    title={i18n._('Fill')}
                    onClick={this.actions.onToggleFill}
                    hidden={!fillEnabled}
                >
                    <table className={styles['parameter-table']}>
                        <tbody>
                            <tr>
                                <td>
                                    {i18n._('Fill Density')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Fill Density')}
                                        content={i18n._('Set the degree to which an area is filled with laser dots. The highest density is 20 dot/mm. When it is set to 0, the SVG image will be engraved without fill.')}
                                    >
                                        <div style={{ display: 'inline-block', width: '50%' }}>
                                            <Slider
                                                value={fillDensity}
                                                min={0}
                                                max={20}
                                                onChange={this.actions.onChangeFillDensity}
                                            />
                                        </div>
                                        <div style={{ display: 'inline-block', width: '10%' }} />
                                        <Input
                                            style={{ width: '40%' }}
                                            value={fillDensity}
                                            min={0}
                                            max={20}
                                            onChange={actions.onChangeFillDensity}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '0 0 0 -50px' }}>dot/mm</span>
                                    </TipTrigger>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </OptionalDropdown>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { modelType, processMode, config } = state.laser;
    const { optimizePath, fillEnabled, fillDensity, vectorThreshold, isInvert, turdSize } = config;
    return {
        modelType: modelType,
        processMode: processMode,
        optimizePath: optimizePath,
        fillEnabled: fillEnabled,
        fillDensity: fillDensity,
        vectorThreshold: vectorThreshold,
        isInvert: isInvert,
        turdSize: turdSize
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateConfig: (params) => dispatch(actions.updateConfig(params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigRasterVector);
