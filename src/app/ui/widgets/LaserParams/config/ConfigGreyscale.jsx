import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from '../../../components/Slider';
import Select from '../../../components/Select';
import Checkbox from '../../../components/Checkbox';
import i18n from '../../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import { actions as editorActions } from '../../../../flux/editor';

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
        expanded: true,
        contrast: 0,
        brightness: 0,
        whiteClip: 0
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onInverseBW: () => {
            this.props.updateSelectedModelConfig({ invert: !this.props.invert });
        },
        onChangeContrast: (contrast) => {
            console.log('contrast', contrast);
            this.setState({
                contrast
            });
        },
        onAfterChangeContrast: () => {
            const { contrast } = this.state;
            this.props.updateSelectedModelConfig({ contrast });
            this.props.processSelectedModel();
        },
        onChangeBrightness: (brightness) => {
            this.setState({
                brightness
            });
        },
        onAfterChangeBrightness: () => {
            const { brightness } = this.state;
            this.props.updateSelectedModelConfig({ brightness });
            this.props.processSelectedModel();
        },
        onChangeWhiteClip: (whiteClip) => {
            this.setState({
                whiteClip
            });
        },
        onAfterChangeWhiteClip: () => {
            const { whiteClip } = this.state;
            this.props.updateSelectedModelConfig({ whiteClip });
            this.props.processSelectedModel();
        },
        onChangeAlgorithm: (options) => {
            this.props.updateSelectedModelConfig({ algorithm: options.value });
        }
    };

    componentDidMount() {
        const { contrast, brightness, whiteClip } = this.props;
        this.setState({
            contrast,
            brightness,
            whiteClip
        });
    }

    getSnapshotBeforeUpdate(prevProps) {
        const { contrast, brightness, whiteClip } = this.props;
        if (contrast !== prevProps.contrast) {
            this.setState({
                contrast
            });
        }
        if (brightness !== prevProps.brightness) {
            this.setState({
                brightness
            });
        }
        if (whiteClip !== prevProps.whiteClip) {
            this.setState({
                whiteClip
            });
        }
        return this.props;
    }

    render() {
        const { invert, algorithm, disabled } = this.props;

        return (
            <div>
                {this.state.expanded && (
                    <React.Fragment>
                        <div>
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('Invert')}</span>
                                <Checkbox
                                    disabled={disabled}
                                    className="sm-flex-auto"
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
                                <div className="sm-flex height-32 margin-vertical-8">
                                    <span className="sm-flex-width">{i18n._('Contrast')}</span>
                                    <Slider
                                        disabled={disabled}
                                        size="middle"
                                        value={this.state.contrast}
                                        min={0}
                                        max={100}
                                        onChange={this.actions.onChangeContrast}
                                        onAfterChange={this.actions.onAfterChangeContrast}
                                    />
                                    <Input
                                        disabled={disabled}
                                        size="super-small"
                                        value={this.state.contrast}
                                        min={0}
                                        max={100}
                                        onChange={async (value) => {
                                            await this.actions.onChangeContrast(value);
                                            this.actions.onAfterChangeContrast();
                                        }}
                                    />
                                </div>
                            </TipTrigger>

                            <TipTrigger
                                title={i18n._('Brightness')}
                                content={i18n._('The engraved picture is brighter when this value is larger.')}
                            >
                                <div className="sm-flex height-32 margin-vertical-8">
                                    <span className="sm-flex-width">{i18n._('Brightness')}</span>
                                    <Slider
                                        size="middle"
                                        disabled={disabled}
                                        value={this.state.brightness}
                                        min={0}
                                        max={100}
                                        onChange={this.actions.onChangeBrightness}
                                        onAfterChange={this.actions.onAfterChangeBrightness}
                                    />
                                    <Input
                                        disabled={disabled}
                                        size="super-small"
                                        value={this.state.brightness}
                                        min={0}
                                        max={100}
                                        onChange={async (value) => {
                                            await this.actions.onChangeBrightness(value);
                                            this.actions.onAfterChangeBrightness();
                                        }}
                                    />
                                </div>
                            </TipTrigger>
                            <TipTrigger
                                title={i18n._('White Clip')}
                                content={i18n._('Set the threshold to turn the color that is not pure white into pure white.')}
                            >

                                <div className="sm-flex height-32 margin-vertical-8">
                                    <span className="sm-flex-width">{i18n._('White Clip')}</span>
                                    <Slider
                                        disabled={disabled}
                                        size="middle"
                                        value={this.state.whiteClip}
                                        min={0}
                                        max={255}
                                        onChange={this.actions.onChangeWhiteClip}
                                        onAfterChange={this.actions.onAfterChangeWhiteClip}
                                    />
                                    <Input
                                        disabled={disabled}
                                        size="super-small"
                                        value={this.state.whiteClip}
                                        min={0}
                                        max={255}
                                        onChange={async (value) => {
                                            await this.actions.onChangeWhiteClip(value);
                                            this.actions.onAfterChangeWhiteClip();
                                        }}
                                    />
                                </div>
                            </TipTrigger>
                            <TipTrigger
                                title={i18n._('Algorithm')}
                                content={i18n._('Choose an algorithm for image processing.')}
                            >

                                <div className="sm-flex height-32 margin-vertical-8">
                                    <span className="sm-flex-width">{i18n._('Algorithm')}</span>
                                    <Select
                                        disabled={disabled}
                                        backspaceRemoves={false}
                                        size="large"
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
                                        placeholder=""
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
