import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import Space from '../../components/Space';
import TipTrigger from '../../components/TipTrigger';
import { actions } from '../../reducers/cncLaserShared';
import styles from '../styles.styl';

class ConfigRasterGreyscale extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        model: PropTypes.object,
        targetDepth: PropTypes.number,
        stepDown: PropTypes.number,
        safetyHeight: PropTypes.number,
        stopHeight: PropTypes.number,
        density: PropTypes.number,
        isInvert: PropTypes.bool,
        updateSelectedModelConfig: PropTypes.func.isRequired
    };

    actions = {
        onChangeTargetDepth: (targetDepth) => {
            if (targetDepth > this.props.size.z) {
                return;
            }
            this.props.updateSelectedModelConfig({ targetDepth: targetDepth });
            if (targetDepth < this.props.stepDown) {
                this.props.updateSelectedModelConfig({ stepDown: targetDepth });
            }
        },
        onChangeStepDown: (stepDown) => {
            this.props.updateSelectedModelConfig({ stepDown: stepDown });
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.props.updateSelectedModelConfig({ safetyHeight: safetyHeight });
        },
        onChangeStopHeight: (stopHeight) => {
            this.props.updateSelectedModelConfig({ stopHeight: stopHeight });
        },
        onChangeDensity: (density) => {
            this.props.updateSelectedModelConfig({ density: density });
        },
        onToggleInvert: () => {
            const isInvert = !this.props.isInvert;
            this.props.updateSelectedModelConfig({ isInvert: isInvert });
        }
    };

    render() {
        if (!this.props.model) {
            return null;
        }

        const actions = this.actions;
        const { size } = this.props;
        const { targetDepth, stepDown, safetyHeight, stopHeight, isInvert, density } = this.props;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']} style={{ marginBottom: '10px' }}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('Target Depth')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Target Depth')}
                                    content={i18n._('Enter the depth of the carved image. The depth cannot be deeper than the flute length.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={targetDepth}
                                            min={0.01}
                                            max={size.z}
                                            step={0.1}
                                            onChange={actions.onChangeTargetDepth}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Step Down')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Step Down')}
                                    content={i18n._('Enter the depth of each carving step.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={stepDown}
                                            min={0.01}
                                            max={targetDepth}
                                            step={0.1}
                                            onChange={actions.onChangeStepDown}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Jog Height')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Jog Height')}
                                    content={i18n._('The distance between the tool and the material when it’s not carving.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={safetyHeight}
                                            min={0.1}
                                            max={size.z}
                                            step={1}
                                            onChange={actions.onChangeSafetyHeight}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Stop Height')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Stop Height')}
                                    content={i18n._('The distance between the tool and the material when the machine stops.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={stopHeight}
                                            min={0.1}
                                            max={size.z}
                                            step={1}
                                            onChange={actions.onChangeStopHeight}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Density')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Density')}
                                    content={i18n._('Adjusts the density of tool movement.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={density}
                                            min={0.1}
                                            max={1}
                                            step={0.1}
                                            onChange={actions.onChangeDensity}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td />
                            <td>
                                <input
                                    type="checkbox"
                                    defaultChecked={isInvert}
                                    onChange={actions.onToggleInvert}
                                />
                                <Space width={4} />
                                <span>{i18n._('Invert')}</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { model, config } = state.cnc;
    const { targetDepth, stepDown, safetyHeight, stopHeight, isInvert, density } = config;
    return {
        size: machine.size,
        model,
        targetDepth,
        stepDown,
        safetyHeight,
        stopHeight,
        isInvert,
        density
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (params) => dispatch(actions.updateSelectedModelConfig('cnc', params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigRasterGreyscale);
