import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from '../../../components/Slider';
import Checkbox from '../../../components/Checkbox';
import i18n from '../../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import { actions as editorActions } from '../../../../flux/editor';

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
        expanded: true,
        vectorThreshold: 0
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onChangeVectorThreshold: (vectorThreshold) => {
            this.setState({
                vectorThreshold
            });
        },
        onAfterChangeVectorThreshold: () => {
            const { vectorThreshold } = this.state;
            this.props.updateSelectedModelConfig({ vectorThreshold });
            this.props.processSelectedModel();
        },
        onChangeTurdSize: (turdSize) => {
            this.props.updateSelectedModelConfig({ turdSize });
        },
        onToggleInvert: () => {
            this.props.updateSelectedModelConfig({ invert: !this.props.invert });
        }
    };

    componentDidMount() {
        const { vectorThreshold } = this.props;
        this.setState({
            vectorThreshold
        });
    }

    getSnapshotBeforeUpdate(prevProps) {
        const { vectorThreshold } = this.props;
        if (vectorThreshold !== prevProps.vectorThreshold) {
            this.setState({
                vectorThreshold
            });
        }
        return this.props;
    }

    render() {
        const { invert, turdSize, disabled } = this.props;

        return (
            <div>
                {this.state.expanded && (
                    <React.Fragment>
                        <TipTrigger
                            title={i18n._('Invert')}
                            content={i18n._('Inverts black to white and vise versa.')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('Invert')}</span>
                                <Checkbox
                                    disabled={disabled}
                                    className="sm-flex-auto"
                                    checked={invert}
                                    onChange={() => {
                                        this.actions.onToggleInvert();
                                        this.props.processSelectedModel();
                                    }}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Threshold')}
                            content={i18n._('Set a value above which colors will be rendered in white.')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('Threshold')}</span>

                                <Slider
                                    disabled={disabled}
                                    size="middle"
                                    value={this.state.vectorThreshold}
                                    min={0}
                                    max={255}
                                    step={1}
                                    onChange={this.actions.onChangeVectorThreshold}
                                    onAfterChange={this.actions.onAfterChangeVectorThreshold}
                                />
                                <Input
                                    disabled={disabled}
                                    size="super-small"
                                    value={this.state.vectorThreshold}
                                    min={0}
                                    max={255}
                                    onChange={async (value) => {
                                        await this.actions.onChangeVectorThreshold(value);
                                        this.actions.onAfterChangeVectorThreshold();
                                    }}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Impurity Size')}
                            content={i18n._('Determines the minimum size of impurity which allows to be showed.')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('Impurity Size')}</span>
                                <Input
                                    disabled={disabled}
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
