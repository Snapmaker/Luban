import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';

import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import { actions as editorActions } from '../../../flux/editor';

class ConfigRasterVector extends PureComponent {
    static propTypes = {
        vectorThreshold: PropTypes.number,
        invert: PropTypes.bool,
        turdSize: PropTypes.number,
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
        changeVectorThreshold: (vectorThreshold) => {
            this.props.updateSelectedModelConfig({ vectorThreshold });
        },
        onChangeTurdSize: (turdSize) => {
            this.props.updateSelectedModelConfig({ turdSize });
        },
        onToggleInvert: () => {
            this.props.updateSelectedModelConfig({ invert: !this.props.invert });
        }
    };

    render() {
        const { vectorThreshold, invert, turdSize, disabled } = this.props;

        return (
            <div>
                {this.state.expanded && (
                    <React.Fragment>
                        <div>
                            <TipTrigger
                                title={i18n._('Invert')}
                                content={i18n._('Inverts black to white and vise versa.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Invert')}</span>
                                    <input
                                        disabled={disabled}
                                        type="checkbox"
                                        className="sm-parameter-row__checkbox"
                                        checked={invert}
                                        onChange={() => {
                                            this.actions.onToggleInvert();
                                            this.props.processSelectedModel();
                                        }}
                                    />
                                </div>
                            </TipTrigger>
                            <TipTrigger
                                title={i18n._('B&W')}
                                content={i18n._('Set the proportion of the black color based on the original color of the image.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('B&W')}</span>
                                    <Input
                                        disabled={disabled}
                                        className="sm-parameter-row__slider-input"
                                        value={vectorThreshold}
                                        min={0}
                                        max={255}
                                        onChange={(value) => {
                                            this.actions.changeVectorThreshold(value);
                                            this.props.processSelectedModel();
                                        }}
                                    />
                                    <Slider
                                        disabled={disabled}
                                        className="sm-parameter-row__slider"
                                        defaultValue={vectorThreshold}
                                        min={0}
                                        max={255}
                                        step={1}
                                        onChange={this.actions.changeVectorThreshold}
                                        onAfterChange={this.props.processSelectedModel}
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
                                        disabled={disabled}
                                        className="sm-parameter-row__input"
                                        value={turdSize}
                                        min={0}
                                        max={10000}
                                        onChange={(value) => {
                                            this.actions.onChangeTurdSize(value);
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

    const { vectorThreshold, invert, turdSize } = model.config;

    return {
        vectorThreshold,
        invert,
        turdSize
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (config) => dispatch(editorActions.updateSelectedModelConfig('laser', config)),
        processSelectedModel: () => dispatch(editorActions.processSelectedModel('laser'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigRasterVector);
