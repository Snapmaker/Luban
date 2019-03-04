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
import { actions } from '../../reducers/cncLaserShared';


class ConfigSvgVector extends PureComponent {
    static propTypes = {
        optimizePath: PropTypes.bool,
        fillEnabled: PropTypes.bool,
        fillDensity: PropTypes.number,
        updateSelectedModelConfig: PropTypes.func.isRequired
    };

    actions = {
        onToggleFill: () => {
            this.props.updateSelectedModelConfig({ fillEnabled: !this.props.fillEnabled });
        },
        onChangeFillDensity: (fillDensity) => {
            this.props.updateSelectedModelConfig({ fillDensity });
        },
        onToggleOptimizePath: (event) => {
            this.props.updateSelectedModelConfig({ optimizePath: event.target.checked });
        }
    };

    render() {
        const { optimizePath, fillEnabled, fillDensity } = this.props;
        const actions = this.actions;

        return (
            <div>
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
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
    const { config } = state.laser;
    const { optimizePath, fillEnabled, fillDensity } = config;
    return {
        optimizePath,
        fillEnabled,
        fillDensity
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (params) => dispatch(actions.updateSelectedModelConfig('laser', params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigSvgVector);
