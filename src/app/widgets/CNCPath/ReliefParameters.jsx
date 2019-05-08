import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';

import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions } from '../../reducers/cncLaserShared';


class ReliefParameters extends PureComponent {
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

    state = {
        expanded: true
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
            this.props.updateSelectedModelConfig({ stepDown });
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.props.updateSelectedModelConfig({ safetyHeight });
        },
        onChangeStopHeight: (stopHeight) => {
            this.props.updateSelectedModelConfig({ stopHeight });
        },
        onChangeDensity: (density) => {
            this.props.updateSelectedModelConfig({ density });
        },
        onToggleInvert: () => {
            const isInvert = !this.props.isInvert;
            this.props.updateSelectedModelConfig({ isInvert });
        }
    };

    render() {
        const actions = this.actions;
        const { size } = this.props;
        const { targetDepth, stepDown, safetyHeight, stopHeight, isInvert, density } = this.props;

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
                        <TipTrigger
                            title={i18n._('Target Depth')}
                            content={i18n._('Enter the depth of the carved image. The depth cannot be deeper than the flute length.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Target Depth')}</span>
                                <Input
                                    style={{ width: '45%' }}
                                    value={targetDepth}
                                    min={0.01}
                                    max={size.z}
                                    step={0.1}
                                    onChange={actions.onChangeTargetDepth}
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
                                    style={{ width: '45%' }}
                                    value={stepDown}
                                    min={0.01}
                                    max={targetDepth}
                                    step={0.1}
                                    onChange={actions.onChangeStepDown}
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
                                    style={{ width: '45%' }}
                                    value={safetyHeight}
                                    min={0.1}
                                    max={size.z}
                                    step={1}
                                    onChange={actions.onChangeSafetyHeight}
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
                                    style={{ width: '45%' }}
                                    value={stopHeight}
                                    min={0.1}
                                    max={size.z}
                                    step={1}
                                    onChange={actions.onChangeStopHeight}
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
                                    style={{ width: '45%' }}
                                    value={density}
                                    min={1}
                                    max={10}
                                    step={1}
                                    onChange={actions.onChangeDensity}
                                />
                                <span className="sm-parameter-row__input-unit">dot/mm</span>
                            </div>
                        </TipTrigger>

                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Invert')}</span>
                            <input
                                className="sm-parameter-row__checkbox"
                                type="checkbox"
                                defaultChecked={isInvert}
                                onChange={actions.onToggleInvert}
                            />
                        </div>
                    </React.Fragment>
                )}
            </div>
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

export default connect(mapStateToProps, mapDispatchToProps)(ReliefParameters);
