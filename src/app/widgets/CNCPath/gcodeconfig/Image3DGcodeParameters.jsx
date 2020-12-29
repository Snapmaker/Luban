import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';

import Select from 'react-select';
import i18n from '../../../lib/i18n';
import { NumberInput as Input, TextInput } from '../../../components/Input';
import Anchor from '../../../components/Anchor';
import TipTrigger from '../../../components/TipTrigger';
import { actions } from '../../../flux/editor';
import { CNC_MESH_SLICE_MODE_LINKAGE, CNC_MESH_SLICE_MODE_ROTATION } from '../../../constants';

class Image3DGcodeParameters extends PureComponent {
    static propTypes = {
        disabled: PropTypes.bool,
        size: PropTypes.object.isRequired,
        targetDepth: PropTypes.number,
        materials: PropTypes.object,
        sliceMode: PropTypes.string,
        smoothY: PropTypes.bool,
        stepDown: PropTypes.number,
        safetyHeight: PropTypes.number,
        stopHeight: PropTypes.number,
        methodType: PropTypes.string,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired
    };

    state = {
        methodExpanded: true,
        heightExpanded: true
    };

    actions = {
        onChangeTargetDepth: (targetDepth) => {
            if (targetDepth > this.props.size.z) {
                return;
            }
            this.props.updateSelectedModelGcodeConfig({ targetDepth: targetDepth });
            if (targetDepth < this.props.stepDown) {
                this.props.updateSelectedModelGcodeConfig({ stepDown: targetDepth });
            }
        },
        onChangeSliceMode: (option) => {
            this.props.updateSelectedModelGcodeConfig({ sliceMode: option.value });
        },
        onChangeSmoothY: () => {
            this.props.updateSelectedModelGcodeConfig({ smoothY: !this.props.smoothY });
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.props.updateSelectedModelGcodeConfig({ safetyHeight });
        },
        onChangeStopHeight: (stopHeight) => {
            this.props.updateSelectedModelGcodeConfig({ stopHeight });
        },
        onChangeDensity: (density) => {
            this.props.updateSelectedModelGcodeConfig({ density });
        }
    };

    render() {
        const { size, disabled, materials, sliceMode, smoothY, targetDepth, safetyHeight, stopHeight, methodType } = this.props;
        const { isRotate } = materials;

        const sliceModeOptions = [{
            value: CNC_MESH_SLICE_MODE_ROTATION,
            label: CNC_MESH_SLICE_MODE_ROTATION
        }, {
            value: CNC_MESH_SLICE_MODE_LINKAGE,
            label: CNC_MESH_SLICE_MODE_LINKAGE
        }
        ];

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleMethodExpand}>
                    <span className="fa fa-image sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Method')}</span>
                    <span className={classNames(
                        'fa',
                        this.state.methodExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {this.state.methodExpanded && (
                    <React.Fragment>
                        <TipTrigger
                            title={i18n._('Method')}
                            content={i18n._('Method')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Method')}</span>
                                <TextInput
                                    disabled
                                    className="sm-parameter-row__input"
                                    value={methodType}
                                />
                            </div>
                        </TipTrigger>

                        {isRotate && (
                            <React.Fragment>
                                <TipTrigger
                                    title={i18n._('Slice Mode')}
                                    content={i18n._('Select the slice mode of the mesh tool path')}
                                >
                                    <div className="sm-parameter-row">
                                        <span className="sm-parameter-row__label">{i18n._('Slice Mode')}</span>
                                        <Select
                                            disabled={disabled}
                                            className="sm-parameter-row__select"
                                            backspaceRemoves={false}
                                            clearable={false}
                                            searchable={false}
                                            options={sliceModeOptions}
                                            value={sliceMode}
                                            onChange={this.actions.onChangeSliceMode}
                                        />
                                    </div>
                                </TipTrigger>
                            </React.Fragment>
                        )}
                        {isRotate && sliceMode === CNC_MESH_SLICE_MODE_LINKAGE && (
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label-lg">{i18n._('Smooth Y')}</span>
                                <input
                                    disabled={disabled}
                                    type="checkbox"
                                    className="sm-parameter-row__checkbox"
                                    checked={smoothY}
                                    onChange={this.actions.onChangeSmoothY}
                                />
                            </div>
                        )}
                    </React.Fragment>
                )}
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleHeightExpand}>
                    <span className="fa fa-image sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Height')}</span>
                    <span className={classNames(
                        'fa',
                        this.state.heightExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {this.state.heightExpanded && (
                    <React.Fragment>
                        <TipTrigger
                            title={i18n._('Target Depth')}
                            content={i18n._('Enter the depth of the carved image. The depth cannot be deeper than the flute length.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Target Depth')}</span>
                                <Input
                                    disabled={disabled}
                                    className="sm-parameter-row__input"
                                    value={targetDepth}
                                    min={0.01}
                                    max={size.z}
                                    step={0.1}
                                    onChange={this.actions.onChangeTargetDepth}
                                />
                                <span className="sm-parameter-row__input-unit">mm</span>
                            </div>
                        </TipTrigger>

                        <TipTrigger
                            title={i18n._('Jog Height')}
                            content={i18n._('The distance between the tool and the material when it’s not carving.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Jog Height')}</span>
                                <Input
                                    disabled={disabled}
                                    className="sm-parameter-row__input"
                                    value={safetyHeight}
                                    min={0.1}
                                    max={size.z}
                                    step={1}
                                    onChange={this.actions.onChangeSafetyHeight}
                                />
                                <span className="sm-parameter-row__input-unit">mm</span>
                            </div>
                        </TipTrigger>

                        <TipTrigger
                            title={i18n._('Stop Height')}
                            content={i18n._('The distance between the tool and the material when the machine stops.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Stop Height')}</span>
                                <Input
                                    disabled={disabled}
                                    className="sm-parameter-row__input"
                                    value={stopHeight}
                                    min={0.1}
                                    max={size.z}
                                    step={1}
                                    onChange={this.actions.onChangeStopHeight}
                                />
                                <span className="sm-parameter-row__input-unit">mm</span>
                            </div>
                        </TipTrigger>

                    </React.Fragment>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { toolPathModelGroup, materials } = state.cnc;
    const toolPathModel = toolPathModelGroup.getSelectedModel();
    const { gcodeConfig } = toolPathModel;
    const { sliceMode, smoothY, targetDepth, stepDown, safetyHeight, stopHeight, density } = gcodeConfig;
    return {
        size: machine.size,
        materials,
        sliceMode,
        smoothY,
        targetDepth,
        stepDown,
        safetyHeight,
        stopHeight,
        density
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelGcodeConfig: (params) => dispatch(actions.updateSelectedModelGcodeConfig('cnc', params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Image3DGcodeParameters);
