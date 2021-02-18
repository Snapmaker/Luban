import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as textActions } from '../../flux/text';
import TipTrigger from '../../components/TipTrigger';
import { actions as editorActions } from '../../flux/editor';
import { NumberInput as Input } from '../../components/Input';
import { BACK, BOTTOM, FRONT, LEFT, RIGHT, TOP } from '../../constants';

class Image3dParameters extends PureComponent {
    static propTypes = {
        disabled: PropTypes.bool,
        materials: PropTypes.object.isRequired,
        config: PropTypes.shape({
            direction: PropTypes.string,
            placement: PropTypes.string,
            minGray: PropTypes.number,
            maxGray: PropTypes.number,
            sliceDensity: PropTypes.number
        }),
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
        onChangeDirectionFace: (option) => {
            this.props.updateSelectedModelConfig({ direction: option.value });
        },
        onChangePlacementFace: (option) => {
            this.props.updateSelectedModelConfig({ placement: option.value });
        },
        onChangeMinGray: (minGray) => {
            this.props.updateSelectedModelConfig({ minGray });
        },
        onChangeMaxGray: (maxGray) => {
            this.props.updateSelectedModelConfig({ maxGray });
        },
        onChangeSliceDensityGray: (sliceDensity) => {
            this.props.updateSelectedModelConfig({ sliceDensity });
        }
    };

    render() {
        const { config, disabled } = this.props;
        const { direction, placement, sliceDensity } = config;
        const Options = [{
            value: FRONT,
            label: 'Front'
        }, {
            value: BACK,
            label: 'Back'
        }, {
            value: LEFT,
            label: 'Left'
        }, {
            value: RIGHT,
            label: 'Right'
        }, {
            value: TOP,
            label: 'Top'
        }, {
            value: BOTTOM,
            label: 'Bottom'
        }];
        const actions = this.actions;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-gears sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Model')}</span>
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
                        {!this.props.materials.isRotate && (
                            <TipTrigger
                                title={i18n._('Projection Direction')}
                                content={i18n._('Select the model\'s projection orientation.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Projection Direction')}</span>
                                    <Select
                                        disabled={disabled}
                                        className="sm-parameter-row__select"
                                        backspaceRemoves={false}
                                        clearable={false}
                                        searchable={false}
                                        options={Options}
                                        value={direction}
                                        onChange={(option) => {
                                            actions.onChangeDirectionFace(option);
                                            this.props.processSelectedModel();
                                        }}
                                    />
                                </div>
                            </TipTrigger>
                        )}
                        {this.props.materials.isRotate && (
                            <TipTrigger
                                title={i18n._('Placement Face')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Placement Face')}</span>
                                    <Select
                                        disabled={disabled}
                                        className="sm-parameter-row__select"
                                        backspaceRemoves={false}
                                        clearable={false}
                                        searchable={false}
                                        options={Options}
                                        value={placement}
                                        onChange={(option) => {
                                            actions.onChangePlacementFace(option);
                                            this.props.processSelectedModel();
                                        }}
                                    />
                                </div>
                            </TipTrigger>
                        )}
                        <TipTrigger
                            title={i18n._('Image Density')}
                            content={i18n._('Set the density of the images generated by model')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Image Density')}</span>
                                <Input
                                    disabled={disabled}
                                    className="sm-parameter-row__input"
                                    value={sliceDensity}
                                    min={1}
                                    max={20}
                                    step={1}
                                    onChange={(option) => {
                                        actions.onChangeSliceDensityGray(option);
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
    const { materials } = state.cnc;
    return { materials };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadFont: (file) => dispatch(textActions.uploadFont(file)),
        processSelectedModel: () => dispatch(editorActions.processSelectedModel('cnc'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Image3dParameters);
