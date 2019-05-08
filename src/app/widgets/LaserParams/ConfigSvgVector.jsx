import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Slider from 'rc-slider';

import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown';
import { actions } from '../../reducers/cncLaserShared';


class ConfigSvgVector extends PureComponent {
    static propTypes = {
        optimizePath: PropTypes.bool,
        fillEnabled: PropTypes.bool.isRequired,
        fillDensity: PropTypes.number.isRequired,
        updateSelectedModelConfig: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
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
                        <TipTrigger
                            title={i18n._('Optimize Path')}
                            content={i18n._('Optimizes the path based on the proximity of the lines in the image.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Optimize Path')}</span>
                                <input
                                    type="checkbox"
                                    className="sm-parameter-row__checkbox"
                                    checked={optimizePath}
                                    onChange={actions.onToggleOptimizePath}
                                />
                            </div>
                        </TipTrigger>
                        <OptionalDropdown
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
                                        className="sm-parameter-row__slider-input"
                                        value={fillDensity}
                                        min={0}
                                        max={20}
                                        onChange={actions.onChangeFillDensity}
                                    />
                                    <Slider
                                        className="sm-parameter-row__slider"
                                        value={fillDensity}
                                        min={0}
                                        max={20}
                                        onChange={this.actions.onChangeFillDensity}
                                    />
                                </div>
                            </TipTrigger>
                        </OptionalDropdown>
                    </React.Fragment>
                )}
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
