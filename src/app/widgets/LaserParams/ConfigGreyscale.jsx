import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import Select from 'react-select';
import classNames from 'classnames';

import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions } from '../../reducers/cncLaserShared';
import { ABSENT_VALUE } from '../../constants';

class ConfigGreyscale extends PureComponent {
    static propTypes = {
        invertGreyscale: PropTypes.bool,
        contrast: PropTypes.number.isRequired,
        brightness: PropTypes.number.isRequired,
        whiteClip: PropTypes.number.isRequired,
        density: PropTypes.number.isRequired,
        algorithm: PropTypes.string.isRequired,
        movementMode: PropTypes.string.isRequired,
        updateSelectedModelConfig: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired
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
        onChangeContrast: (contrast) => {
            this.props.updateSelectedModelConfig({ contrast });
        },
        onChangeBrightness: (brightness) => {
            this.props.updateSelectedModelConfig({ brightness });
        },
        onChangeWhiteClip: (whiteClip) => {
            this.props.updateSelectedModelConfig({ whiteClip });
        },
        onChangeAlgorithm: (options) => {
            this.props.updateSelectedModelConfig({ algorithm: options.value });
        },
        onChangeMovementMode: (options) => {
            if (options.value === 'greyscale-line') {
                this.props.updateSelectedModelGcodeConfig({
                    dwellTime: ABSENT_VALUE,
                    jogSpeed: 1500,
                    workSpeed: 500
                });
            } else if (options.value === 'greyscale-dot') {
                this.props.updateSelectedModelGcodeConfig({
                    dwellTime: 42,
                    jogSpeed: ABSENT_VALUE,
                    workSpeed: 1500
                });
            }
            this.props.updateSelectedModelConfig({ movementMode: options.value });
        },
        onChangeDensity: (density) => {
            this.props.updateSelectedModelConfig({ density });
        }
    };

    render() {
        const { invertGreyscale, contrast, brightness, whiteClip, density, algorithm, movementMode } = this.props;
        const actions = this.actions;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-image sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Greyscale')}</span>
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
                            title={i18n._('Contrast')}
                            content={i18n._('The difference between the lightest color and the darkest color.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Contrast')}</span>
                                <Input
                                    className="sm-parameter-row__slider-input"
                                    value={contrast}
                                    min={0}
                                    max={100}
                                    onChange={actions.onChangeContrast}
                                />
                                <Slider
                                    className="sm-parameter-row__slider"
                                    value={contrast}
                                    min={0}
                                    max={100}
                                    onChange={actions.onChangeContrast}
                                />
                            </div>
                        </TipTrigger>

                        <TipTrigger
                            title={i18n._('Brightness')}
                            content={i18n._('The engraved picture is brighter when this value is bigger.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Brightness')}</span>
                                <Input
                                    className="sm-parameter-row__slider-input"
                                    value={brightness}
                                    min={0}
                                    max={100}
                                    onChange={actions.onChangeBrightness}
                                />
                                <Slider
                                    className="sm-parameter-row__slider"
                                    value={brightness}
                                    min={0}
                                    max={100}
                                    onChange={actions.onChangeBrightness}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('White Clip')}
                            content={i18n._('Set the threshold to turn the color that is not pure white into pure white.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('White Clip')}</span>
                                <Input
                                    className="sm-parameter-row__slider-input"
                                    value={whiteClip}
                                    min={0}
                                    max={255}
                                    onChange={actions.onChangeWhiteClip}
                                />
                                <Slider
                                    className="sm-parameter-row__slider"
                                    value={whiteClip}
                                    min={0}
                                    max={255}
                                    onChange={actions.onChangeWhiteClip}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Algorithm')}
                            content={i18n._('Choose an algorithm for image processing.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Algorithm')}</span>
                                <Select
                                    backspaceRemoves={false}
                                    className="sm-parameter-row__select-lg"
                                    clearable={false}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name="algorithm"
                                    options={[{
                                        value: 'FloydSteinburg',
                                        label: 'Floyd-Steinburg'
                                    }, {
                                        value: 'JarvisJudiceNinke',
                                        label: 'Jarvis-Judice-Ninke'
                                    }, {
                                        value: 'Stucki',
                                        label: 'Stucki'
                                    }, {
                                        value: 'Atkinson',
                                        label: 'Atkinson'
                                    }, {
                                        value: 'Burkes',
                                        label: 'Burkes'
                                    }, {
                                        value: 'Sierra2',
                                        label: 'Sierra-2'
                                    }, {
                                        value: 'Sierra3',
                                        label: 'Sierra-3'
                                    }, {
                                        value: 'SierraLite',
                                        label: 'Sierra Lite'
                                    }]}
                                    placeholder={i18n._('Choose algorithms')}
                                    searchable={false}
                                    value={algorithm}
                                    onChange={actions.onChangeAlgorithm}
                                />
                            </div>
                        </TipTrigger>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Movement Mode')}</span>
                            <Select
                                backspaceRemoves={false}
                                className="sm-parameter-row__select-lg"
                                clearable={false}
                                menuContainerStyle={{ zIndex: 5 }}
                                name="Movement"
                                options={[{
                                    value: 'greyscale-line',
                                    label: i18n._('Line (Normal Quality)')
                                }, {
                                    value: 'greyscale-dot',
                                    label: i18n._('Dot (High Quality)')
                                }]}
                                placeholder={i18n._('Choose movement mode')}
                                searchable={false}
                                value={movementMode}
                                onChange={actions.onChangeMovementMode}
                            />
                        </div>
                        <TipTrigger
                            title={i18n._('Density')}
                            content={i18n._('Determines how fine and smooth the engraved picture will be.' +
                                'The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.')}
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
    const { invertGreyscale, contrast, brightness, whiteClip, density, algorithm, movementMode } = config;
    return {
        invertGreyscale,
        contrast,
        brightness,
        whiteClip,
        density,
        algorithm,
        movementMode
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (config) => dispatch(actions.updateSelectedModelConfig('laser', config)),
        updateSelectedModelGcodeConfig: (params) => dispatch(actions.updateSelectedModelGcodeConfig('laser', params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigGreyscale);
