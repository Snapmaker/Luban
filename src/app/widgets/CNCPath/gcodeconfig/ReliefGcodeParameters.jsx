import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';

import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import Anchor from '../../../components/Anchor';
import TipTrigger from '../../../components/TipTrigger';
import { actions } from '../../../flux/editor';

class ReliefGcodeParameters extends PureComponent {
    static propTypes = {
        disabled: PropTypes.bool,
        size: PropTypes.object.isRequired,
        targetDepth: PropTypes.number,
        stepDown: PropTypes.number,
        safetyHeight: PropTypes.number,
        stopHeight: PropTypes.number,
        density: PropTypes.number,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onChangeTargetDepth: (targetDepth) => {
            if (targetDepth > this.props.size.z) {
                return;
            }
            this.props.updateSelectedModelGcodeConfig({ targetDepth: targetDepth });
            if (targetDepth < this.props.stepDown) {
                this.props.updateSelectedModelGcodeConfig({ stepDown: targetDepth });
            }
        },
        onChangeStepDown: (stepDown) => {
            this.props.updateSelectedModelGcodeConfig({ stepDown });
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.props.updateSelectedModelGcodeConfig({ safetyHeight });
        },
        onChangeStopHeight: (stopHeight) => {
            this.props.updateSelectedModelGcodeConfig({ stopHeight });
        },
        onChangeDensity: (density) => {
            this.props.updateSelectedModelGcodeConfig({ density });
        }
    };

    render() {
        const { size, disabled } = this.props;
        const { targetDepth, stepDown, safetyHeight, stopHeight, density } = this.props;
        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-image sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Relief')}</span>
                    <span className={classNames(
                        'fa',
                        this.state.expanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {this.state.expanded && (
                    <React.Fragment>
                        <div>
                            <TipTrigger
                                title={i18n._('Target Depth')}
                                content={i18n._('Enter the depth of the carved image. The depth cannot be deeper than the flute length.')}
                            >
                                <div
                                    className="sm-parameter-row"
                                >
                                    <span className="sm-parameter-row__label">{i18n._('Target Depth')}</span>
                                    <Input
                                        disabled={disabled}
                                        className="sm-parameter-row__input"
                                        value={targetDepth}
                                        min={0.01}
                                        max={size.z}
                                        step={0.1}
                                        onChange={this.actions.onChangeTargetDepth}
                                    />
                                    <span className="sm-parameter-row__input-unit">dot/mm</span>
                                </div>
                            </TipTrigger>

                            <TipTrigger
                                title={i18n._('Step Down')}
                                content={i18n._('Enter the depth of each carving step.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Step Down')}</span>
                                    <Input
                                        disabled={disabled}
                                        className="sm-parameter-row__input"
                                        value={stepDown}
                                        min={0.01}
                                        max={targetDepth}
                                        step={0.1}
                                        onChange={this.actions.onChangeStepDown}
                                    />
                                    <span className="sm-parameter-row__input-unit">mm</span>
                                </div>
                            </TipTrigger>

                            <TipTrigger
                                title={i18n._('Jog Height')}
                                content={i18n._('The distance between the tool and the material when it’s not carving.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Jog Height')}</span>
                                    <Input
                                        disabled={disabled}
                                        className="sm-parameter-row__input"
                                        value={safetyHeight}
                                        min={0.1}
                                        max={size.z}
                                        step={1}
                                        onChange={this.actions.onChangeSafetyHeight}
                                    />
                                    <span className="sm-parameter-row__input-unit">mm</span>
                                </div>
                            </TipTrigger>

                            <TipTrigger
                                title={i18n._('Stop Height')}
                                content={i18n._('The distance between the tool and the material when the machine stops.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Stop Height')}</span>
                                    <Input
                                        disabled={disabled}
                                        className="sm-parameter-row__input"
                                        value={stopHeight}
                                        min={0.1}
                                        max={size.z}
                                        step={1}
                                        onChange={this.actions.onChangeStopHeight}
                                    />
                                    <span className="sm-parameter-row__input-unit">mm</span>
                                </div>
                            </TipTrigger>

                            <TipTrigger
                                title={i18n._('Density')}
                                content={i18n._('Set the density of the tool head movements. The highest density is 10 dot/mm. When generating G-code, the density will be re-calculated to ensure the process work normally.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Density')}</span>
                                    <Input
                                        disabled={disabled}
                                        className="sm-parameter-row__input"
                                        value={density}
                                        min={0.1}
                                        max={20}
                                        step={0.1}
                                        onChange={this.actions.onChangeDensity}
                                    />
                                    <span className="sm-parameter-row__input-unit">dot/mm</span>
                                </div>
                            </TipTrigger>
                        </div>


                    </React.Fragment>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { gcodeConfig } = state.cnc;
    const { targetDepth, stepDown, safetyHeight, stopHeight, density } = gcodeConfig;
    return {
        size: machine.size,
        targetDepth,
        stepDown,
        safetyHeight,
        stopHeight,
        density
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelGcodeConfig: (params) => dispatch(actions.updateSelectedModelGcodeConfig('cnc', params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ReliefGcodeParameters);
