import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';

import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import OptionalDropdown from '../../../components/OptionalDropdown';
import { actions } from '../../../flux/editor';
import Anchor from '../../../components/Anchor';

class GcodeConfigRasterVector extends PureComponent {
    static propTypes = {
        optimizePath: PropTypes.bool,
        fillEnabled: PropTypes.bool,
        fillDensity: PropTypes.number,
        disabled: PropTypes.bool,

        updateSelectedModelGcodeConfig: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onToggleFill: () => {
            this.props.updateSelectedModelGcodeConfig({ fillEnabled: !this.props.fillEnabled });
        },
        onChangeFillDensity: (fillDensity) => {
            this.props.updateSelectedModelGcodeConfig({ fillDensity });
        },
        onToggleOptimizePath: (event) => {
            this.props.updateSelectedModelGcodeConfig({ optimizePath: event.target.checked });
        }
    };

    render() {
        const { optimizePath, fillEnabled, fillDensity, disabled } = this.props;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-image sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Vector')}</span>
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
                                title={i18n._('Optimize Path')}
                                content={i18n._('Optimizes the path based on the proximity of the lines in the image.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Optimize Path')}</span>
                                    <input
                                        disabled={disabled}
                                        type="checkbox"
                                        className="sm-parameter-row__checkbox"
                                        checked={optimizePath}
                                        onChange={this.actions.onToggleOptimizePath}
                                    />
                                </div>
                            </TipTrigger>
                            <OptionalDropdown
                                disabled={disabled}
                                style={{ marginBottom: '10px' }}
                                title={i18n._('Fill')}
                                onClick={this.actions.onToggleFill}
                                hidden={!fillEnabled}
                            >
                                <TipTrigger
                                    title={i18n._('Fill Density')}
                                    content={i18n._('Set the degree to which an area is filled with laser dots. The highest density is 20 dot/mm. When it is set to 0, the SVG image will be engraved without fill.')}
                                >
                                    <div className="sm-parameter-row">
                                        <span className="sm-parameter-row__label">{i18n._('Fill Density')}</span>
                                        <Input
                                            disabled={disabled}
                                            className="sm-parameter-row__slider-input"
                                            value={fillDensity}
                                            min={0}
                                            max={20}
                                            onChange={this.actions.onChangeFillDensity}
                                        />
                                        <Slider
                                            disabled={disabled}
                                            className="sm-parameter-row__slider"
                                            value={fillDensity}
                                            min={0}
                                            max={20}
                                            onChange={this.actions.onChangeFillDensity}
                                        />
                                    </div>
                                </TipTrigger>
                            </OptionalDropdown>
                        </div>
                    </React.Fragment>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const toolPathModelGroup = state.laser.toolPathModelGroup;
    const toolPathModel = toolPathModelGroup.getSelectedModel();
    const { gcodeConfig } = toolPathModel;
    const { optimizePath, fillEnabled, fillDensity } = gcodeConfig;
    return {
        optimizePath,
        fillEnabled,
        fillDensity
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelGcodeConfig: (config) => dispatch(actions.updateSelectedModelGcodeConfig('laser', config))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(GcodeConfigRasterVector);
