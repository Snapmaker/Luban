import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from '../../../components/Slider';
import Checkbox from '../../../components/Checkbox';
import i18n from '../../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput } from '../../../components/Input';
import { actions as editorActions } from '../../../../flux/editor';


class ConfigRasterBW extends PureComponent {
    static propTypes = {
        invert: PropTypes.bool,
        bwThreshold: PropTypes.number,
        disabled: PropTypes.bool,

        updateSelectedModelConfig: PropTypes.func.isRequired,
        processSelectedModel: PropTypes.func.isRequired
    };

    state = {
        bwThreshold: 0,
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
            this.setState({
                bwThreshold
            });
        },
        onAfterChangeBWThreshold: () => {
            const { bwThreshold } = this.state;
            this.props.updateSelectedModelConfig({ bwThreshold });
            this.props.processSelectedModel();
        }
    };

    componentDidMount() {
        const { bwThreshold } = this.props;
        this.setState({
            bwThreshold
        });
    }

    getSnapshotBeforeUpdate(prevProps) {
        const { bwThreshold } = this.props;
        if (bwThreshold !== prevProps.bwThreshold) {
            this.setState({
                bwThreshold
            });
        }
        return this.props;
    }

    render() {
        const { invert, disabled } = this.props;

        return (
            <div>
                {this.state.expanded && (
                    <React.Fragment>
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
                            title={i18n._('Threshold')}
                            content={i18n._('Set a value above which colors will be rendered in white.')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('Threshold')}</span>
                                <Slider
                                    disabled={disabled}
                                    size="middle"
                                    value={this.state.bwThreshold}
                                    min={0}
                                    max={255}
                                    onChange={this.actions.onChangeBWThreshold}
                                    onAfterChange={this.actions.onAfterChangeBWThreshold}
                                />
                                <NumberInput
                                    disabled={disabled}
                                    value={this.state.bwThreshold}
                                    className="sm-flex-auto"
                                    size="super-small"
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

    const { invert, bwThreshold } = model.config;

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
