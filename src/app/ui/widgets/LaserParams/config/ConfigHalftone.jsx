import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from '../../../components/Slider';
import Select from '../../../components/Select';

import i18n from '../../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput } from '../../../components/Input';
import { actions as editorActions } from '../../../../flux/editor';


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
        expanded: true,
        npSize: 0,
        npAngle: 0,
        threshold: 0
    };

    actions = {
        onChangeType: (npType) => {
            this.props.updateSelectedModelConfig({ npType });
        },
        onChangeSize: (npSize) => {
            this.setState({
                npSize
            });
        },
        onAfterChangeSize: () => {
            const { npSize } = this.state;
            this.props.updateSelectedModelConfig({ npSize });
            this.props.processSelectedModel();
        },
        onChangeAngle: (npAngle) => {
            npAngle %= 180;
            if (npAngle < 0) npAngle += 180;
            this.setState({
                npAngle
            });
        },
        onAfterChangeAngle: () => {
            const { npAngle } = this.state;
            this.props.updateSelectedModelConfig({ npAngle });
            this.props.processSelectedModel();
        },
        onChangeBWThreshold: (threshold) => {
            this.setState({
                threshold
            });
        },
        onAfterChangeBWThreshold: () => {
            const { threshold } = this.state;
            this.props.updateSelectedModelConfig({ threshold });
            this.props.processSelectedModel();
        }
    };

    componentDidMount() {
        const { npSize, npAngle, threshold } = this.props;
        this.setState({
            npSize,
            npAngle,
            threshold
        });
    }

    getSnapshotBeforeUpdate(prevProps) {
        const { npSize, npAngle, threshold } = this.props;
        if (npSize !== prevProps.npSize) {
            this.setState({
                npSize
            });
        }
        if (npAngle !== prevProps.npAngle) {
            this.setState({
                npAngle
            });
        }
        if (threshold !== prevProps.threshold) {
            this.setState({
                threshold
            });
        }
        return this.props;
    }

    render() {
        const { disabled, npType } = this.props;
        return (
            <div>
                {this.state.expanded && (
                    <React.Fragment>
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-width">{i18n._('Type')}</span>
                            <Select
                                size="middle"
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
                        <TipTrigger
                            title={i18n._('Size')}
                            content={i18n._('Set halftone size')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('Size')}</span>
                                <Slider
                                    disabled={disabled}
                                    size="middle"
                                    value={this.state.npSize}
                                    min={5}
                                    max={50}
                                    onChange={this.actions.onChangeSize}
                                    onAfterChange={this.actions.onAfterChangeSize}
                                />
                                <NumberInput
                                    disabled={disabled}
                                    size="super-small"
                                    value={this.state.npSize}
                                    min={5}
                                    max={50}
                                    onChange={async (value) => {
                                        await this.actions.onChangeSize(value);
                                        this.actions.onAfterChangeSize();
                                    }}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Angle')}
                            content={i18n._('Set Halftone rotation angle')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('Angle')}</span>
                                <Slider
                                    disabled={disabled}
                                    size="middle"
                                    value={this.state.npAngle}
                                    min={0}
                                    max={180}
                                    onChange={this.actions.onChangeAngle}
                                    onAfterChange={this.actions.onAfterChangeAngle}
                                />
                                <NumberInput
                                    disabled={disabled}
                                    size="super-small"
                                    value={this.state.npAngle}
                                    min={0}
                                    max={180}
                                    onChange={async (value) => {
                                        await this.actions.onChangeAngle(value);
                                        this.actions.onAfterChangeAngle();
                                    }}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Threshold')}
                            content={i18n._('Color over threshold will turn to white')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('Threshold')}</span>
                                <Slider
                                    disabled={disabled}
                                    size="middle"
                                    value={this.state.threshold}
                                    min={0}
                                    max={255}
                                    onChange={this.actions.onChangeBWThreshold}
                                    onAfterChange={this.actions.onAfterChangeBWThreshold}
                                />
                                <NumberInput
                                    disabled={disabled}
                                    size="super-small"
                                    value={this.state.threshold}
                                    min={0}
                                    max={255}
                                    onChange={async (value) => {
                                        await this.actions.onChangeBWThreshold(value);
                                        this.actions.onAfterChangeBWThreshold();
                                    }}
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
