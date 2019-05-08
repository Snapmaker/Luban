import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import Slider from 'rc-slider';

import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import { actions } from '../../reducers/cncLaserShared';


class ConfigRasterBW extends PureComponent {
    static propTypes = {
        invertGreyscale: PropTypes.bool,
        bwThreshold: PropTypes.number,
        density: PropTypes.number,
        direction: PropTypes.string,
        updateSelectedModelConfig: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onInverseBW: () => {
            this.props.updateSelectedModelConfig({ invertGreyscale: !this.props.invertGreyscale });
        },
        onChangeBWThreshold: (bwThreshold) => {
            this.props.updateSelectedModelConfig({ bwThreshold });
        },
        onChangeDirection: (option) => {
            this.props.updateSelectedModelConfig({ direction: option.value });
        },
        onChangeDensity: (density) => {
            this.props.updateSelectedModelConfig({ density });
        }
    };

    render() {
        const { invertGreyscale, bwThreshold, density, direction } = this.props;
        const actions = this.actions;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-image sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('B&W')}</span>
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
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Invert')}</span>
                            <input
                                type="checkbox"
                                className="sm-parameter-row__checkbox"
                                value={invertGreyscale}
                                onClick={actions.onInverseBW}
                            />
                        </div>
                        <TipTrigger
                            title={i18n._('B&W')}
                            content={i18n._('Set the proportion of the black color based on the original color of the image.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('B&W')}</span>
                                <Input
                                    className="sm-parameter-row__slider-input"
                                    value={bwThreshold}
                                    min={0}
                                    max={255}
                                    onChange={actions.onChangeBWThreshold}
                                />
                                <Slider
                                    className="sm-parameter-row__slider"
                                    value={bwThreshold}
                                    min={0}
                                    max={255}
                                    onChange={actions.onChangeBWThreshold}
                                />

                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Line Direction')}
                            content={i18n._('Select the direction of the engraving path.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Line Direction')}</span>
                                <Select
                                    backspaceRemoves={false}
                                    className="sm-parameter-row__select"
                                    clearable={false}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name="line_direction"
                                    options={[{
                                        value: 'Horizontal',
                                        label: i18n._('Horizontal')
                                    }, {
                                        value: 'Vertical',
                                        label: i18n._('Vertical')
                                    }, {
                                        value: 'Diagonal',
                                        label: i18n._('Diagonal')
                                    }, {
                                        value: 'Diagonal2',
                                        label: i18n._('Diagonal2')
                                    }]}
                                    placeholder={i18n._('Choose an algorithm')}
                                    searchable={false}
                                    value={direction}
                                    onChange={actions.onChangeDirection}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Density')}
                            content={i18n._('Determines how fine and smooth the engraved picture will be. \
The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Density')}</span>
                                <Input
                                    className="sm-parameter-row__input"
                                    value={density}
                                    min={1}
                                    max={10}
                                    step={1}
                                    onChange={actions.onChangeDensity}
                                />
                                <span className="sm-parameter-row__input-unit">dot/mm</span>
                            </div>
                        </TipTrigger>
                    </React.Fragment>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { config } = state.laser;
    const { invertGreyscale, bwThreshold, density, direction } = config;
    return {
        invertGreyscale,
        bwThreshold,
        density,
        direction
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (config) => dispatch(actions.updateSelectedModelConfig('laser', config))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigRasterBW);
