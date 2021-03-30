import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import Select from '../../../components/Select';

import i18n from '../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput } from '../../../components/Input';
import { actions as editorActions } from '../../../flux/editor';


class ConfigHalftone extends PureComponent {
    static propTypes = {
        disabled: PropTypes.bool,

        npType: PropTypes.string,
        npSize: PropTypes.number,
        npAngle: PropTypes.number,
        threshold: PropTypes.number,

        processSelectedModel: PropTypes.func.isRequired,
        updateSelectedModelConfig: PropTypes.func.isRequired
    };

    processTimeout = null;

    state = {
        expanded: true
    };

    actions = {
        onChangeType: (npType) => {
            this.props.updateSelectedModelConfig({ npType });
        },
        onChangeSize: (npSize) => {
            this.props.updateSelectedModelConfig({ npSize });
        },
        onChangeAngle: (npAngle) => {
            npAngle %= 180;
            if (npAngle < 0) npAngle += 180;
            this.props.updateSelectedModelConfig({ npAngle });
        },
        onChangeBWThreshold: (threshold) => {
            this.props.updateSelectedModelConfig({ threshold });
        }
    };

    render() {
        const { disabled, npType, npSize, npAngle, threshold } = this.props;
        return (
            <div>
                {this.state.expanded && (
                    <React.Fragment>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Type')}</span>

                            <div style={{ float: 'right', display: 'inline-block', width: '50%' }}>
                                <Select
                                    clearable={false}
                                    options={[{
                                        value: 'line',
                                        label: i18n._('Line')
                                    }, {
                                        value: 'round',
                                        label: i18n._('Round')
                                    }, {
                                        value: 'diamond',
                                        label: i18n._('Diamond')
                                    }]}
                                    value={npType}
                                    searchable={false}
                                    onChange={({ value }) => {
                                        this.actions.onChangeType(value);
                                        this.props.processSelectedModel();
                                    }}
                                />

                            </div>

                        </div>
                        <TipTrigger
                            title={i18n._('Size')}
                            content={i18n._('Set halftone size')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Size')}</span>
                                <NumberInput
                                    disabled={disabled}
                                    className="sm-parameter-row__slider-input"
                                    value={npSize}
                                    min={5}
                                    max={50}
                                    onChange={(value) => {
                                        this.actions.onChangeSize(value);
                                        this.props.processSelectedModel();
                                    }}
                                />
                                <Slider
                                    disabled={disabled}
                                    className="sm-parameter-row__slider"
                                    value={npSize}
                                    min={5}
                                    max={50}
                                    onChange={this.actions.onChangeSize}
                                    onAfterChange={this.props.processSelectedModel}
                                />

                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Angle')}
                            content={i18n._('Set Halftone rotation angle')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Angle')}</span>
                                <NumberInput
                                    disabled={disabled}
                                    className="sm-parameter-row__slider-input"
                                    value={npAngle}
                                    min={0}
                                    max={180}
                                    onChange={(value) => {
                                        this.actions.onChangeAngle(value);
                                        this.props.processSelectedModel();
                                    }}
                                />
                                <Slider
                                    disabled={disabled}
                                    className="sm-parameter-row__slider"
                                    value={npAngle}
                                    min={0}
                                    max={180}
                                    onChange={this.actions.onChangeAngle}
                                    onAfterChange={this.props.processSelectedModel}
                                />

                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Threshold')}
                            content={i18n._('Color over threshold will turn to white')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Threshold')}</span>
                                <NumberInput
                                    disabled={disabled}
                                    className="sm-parameter-row__slider-input"
                                    value={threshold}
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
                                    value={threshold}
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

    const { npType, npSize, npAngle, threshold } = model.config;

    return {
        npType,
        npSize,
        npAngle,
        threshold
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (config) => dispatch(editorActions.updateSelectedModelConfig('laser', config)),
        processSelectedModel: () => dispatch(editorActions.processSelectedModel('laser'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigHalftone);
