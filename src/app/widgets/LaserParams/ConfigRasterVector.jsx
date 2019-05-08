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


class ConfigRasterVector extends PureComponent {
    static propTypes = {
        optimizePath: PropTypes.bool,
        fillEnabled: PropTypes.bool,
        fillDensity: PropTypes.number,
        vectorThreshold: PropTypes.number,
        isInvert: PropTypes.bool,
        turdSize: PropTypes.number,
        updateSelectedModelConfig: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        changeVectorThreshold: (vectorThreshold) => {
            this.props.updateSelectedModelConfig({ vectorThreshold });
        },
        onChangeTurdSize: (turdSize) => {
            this.props.updateSelectedModelConfig({ turdSize });
        },
        onToggleInvert: (event) => {
            this.props.updateSelectedModelConfig({ isInvert: event.target.checked });
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
        const { optimizePath, fillEnabled, fillDensity, vectorThreshold, isInvert, turdSize } = this.props;
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
                            title={i18n._('B&W')}
                            content={i18n._('Set the proportion of the black color based on the original color of the image.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('B&W')}</span>
                                <Input
                                    className="sm-parameter-row__slider-input"
                                    value={vectorThreshold}
                                    min={0}
                                    max={20}
                                    onChange={actions.changeVectorThreshold}
                                />
                                <Slider
                                    className="sm-parameter-row__slider"
                                    defaultValue={vectorThreshold}
                                    min={0}
                                    max={255}
                                    step={1}
                                    onChange={actions.changeVectorThreshold}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Impurity Size')}
                            content={i18n._('Determines the minimum size of impurity which allows to be showed.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Impurity Size')}</span>
                                <Input
                                    className="sm-parameter-row__input"
                                    value={turdSize}
                                    min={0}
                                    max={10000}
                                    onChange={actions.onChangeTurdSize}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Invert')}
                            content={i18n._('Inverts black to white and vise versa.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Invert')}</span>
                                <input
                                    type="checkbox"
                                    className="sm-parameter-row__checkbox"
                                    checked={isInvert}
                                    onChange={actions.onToggleInvert}
                                />
                            </div>
                        </TipTrigger>
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
    const { optimizePath, fillEnabled, fillDensity, vectorThreshold, isInvert, turdSize } = config;
    return {
        optimizePath,
        fillEnabled,
        fillDensity,
        vectorThreshold,
        isInvert,
        turdSize
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (config) => dispatch(actions.updateSelectedModelConfig('laser', config))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigRasterVector);
