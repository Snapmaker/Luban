import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import Select from 'react-select';

import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import { actions as editorActions } from '../../../flux/editor';

class ConfigGreyscale extends PureComponent {
    static propTypes = {
        invert: PropTypes.bool,
        contrast: PropTypes.number.isRequired,
        brightness: PropTypes.number.isRequired,
        whiteClip: PropTypes.number.isRequired,
        algorithm: PropTypes.string.isRequired,
        disabled: PropTypes.bool,

        updateSelectedModelConfig: PropTypes.func.isRequired,
        processSelectedModel: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onInverseBW: () => {
            this.props.updateSelectedModelConfig({ invert: !this.props.invert });
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
        }
    };

    render() {
        const { invert, contrast, brightness, whiteClip, algorithm, disabled } = this.props;

        return (
            <div>
                {this.state.expanded && (
                    <React.Fragment>
                        <div>
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Invert')}</span>
                                <input
                                    disabled={disabled}
                                    type="checkbox"
                                    className="sm-parameter-row__checkbox"
                                    checked={invert}
                                    onChange={() => {
                                        this.actions.onInverseBW();
                                        this.props.processSelectedModel();
                                    }}
                                />
                            </div>
                            <TipTrigger
                                title={i18n._('Contrast')}
                                content={i18n._('The difference between the lightest color and the darkest color.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Contrast')}</span>
                                    <Input
                                        disabled={disabled}
                                        className="sm-parameter-row__slider-input"
                                        value={contrast}
                                        min={0}
                                        max={100}
                                        onChange={(value) => {
                                            this.actions.onChangeContrast(value);
                                            this.props.processSelectedModel();
                                        }}
                                    />
                                    <Slider
                                        disabled={disabled}
                                        className="sm-parameter-row__slider"
                                        value={contrast}
                                        min={0}
                                        max={100}
                                        onChange={this.actions.onChangeContrast}
                                        onAfterChange={this.props.processSelectedModel}
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
                                        disabled={disabled}
                                        className="sm-parameter-row__slider-input"
                                        value={brightness}
                                        min={0}
                                        max={100}
                                        onChange={(value) => {
                                            this.actions.onChangeBrightness(value);
                                            this.props.processSelectedModel();
                                        }}
                                    />
                                    <Slider
                                        disabled={disabled}
                                        className="sm-parameter-row__slider"
                                        value={brightness}
                                        min={0}
                                        max={100}
                                        onChange={this.actions.onChangeBrightness}
                                        onAfterChange={this.props.processSelectedModel}
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
                                        disabled={disabled}
                                        className="sm-parameter-row__slider-input"
                                        value={whiteClip}
                                        min={0}
                                        max={255}
                                        onChange={(value) => {
                                            this.actions.onChangeWhiteClip(value);
                                            this.props.processSelectedModel();
                                        }}
                                    />
                                    <Slider
                                        disabled={disabled}
                                        className="sm-parameter-row__slider"
                                        value={whiteClip}
                                        min={0}
                                        max={255}
                                        onChange={this.actions.onChangeWhiteClip}
                                        onAfterChange={this.props.processSelectedModel}
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
                                        disabled={disabled}
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
                                        onChange={(value) => {
                                            this.actions.onChangeAlgorithm(value);
                                            this.props.processSelectedModel();
                                        }}
                                    />
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
    const { modelGroup } = state.laser;

    // assume that only one model is selected
    const selectedModels = modelGroup.getSelectedModelArray();
    const model = selectedModels[0];

    const { invert, contrast, brightness, whiteClip, algorithm } = model.config;

    return {
        invert,
        contrast,
        brightness,
        whiteClip,
        algorithm
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (config) => dispatch(editorActions.updateSelectedModelConfig('laser', config)),
        processSelectedModel: () => dispatch(editorActions.processSelectedModel('laser'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigGreyscale);
