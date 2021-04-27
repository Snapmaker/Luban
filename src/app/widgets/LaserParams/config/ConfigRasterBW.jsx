import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';

import i18n from '../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput } from '../../../components/Input';
import { actions as editorActions } from '../../../flux/editor';


class ConfigRasterBW extends PureComponent {
    static propTypes = {
        invert: PropTypes.bool,
        bwThreshold: PropTypes.number,
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
        onChangeBWThreshold: (bwThreshold) => {
            this.props.updateSelectedModelConfig({ bwThreshold });
        }
    };

    render() {
        const { invert, bwThreshold, disabled } = this.props;

        return (
            <div>
                {this.state.expanded && (
                    <React.Fragment>
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
                            title={i18n._('B&W')}
                            content={i18n._('Set the proportion of the black color based on the original color of the image.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('B&W')}</span>
                                <NumberInput
                                    disabled={disabled}
                                    className="sm-parameter-row__slider-input"
                                    value={bwThreshold}
                                    min={0}
                                    max={255}
                                    onChange={(value) => {
                                        this.actions.onChangeBWThreshold(value);
                                        this.props.processSelectedModel();
                                    }}
                                />
                                <Slider
                                    disabled={disabled}
                                    className="sm-parameter-row__slider"
                                    value={bwThreshold}
                                    min={0}
                                    max={255}
                                    onChange={this.actions.onChangeBWThreshold}
                                    onAfterChange={this.props.processSelectedModel}
                                />

                            </div>
                        </TipTrigger>
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

    const { invert, bwThreshold } = model.processConfig;

    return {
        invert,
        bwThreshold
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (config) => dispatch(editorActions.updateSelectedModelConfig('laser', config)),
        processSelectedModel: () => dispatch(editorActions.processSelectedModel('laser'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigRasterBW);
