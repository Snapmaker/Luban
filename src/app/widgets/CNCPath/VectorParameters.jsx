import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
// import Slider from 'rc-slider';

import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input, TextInput } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown/OptionalDropdown';
import { actions } from '../../flux/editor';


class VectorParameters extends PureComponent {
    static propTypes = {
        disabled: PropTypes.bool,
        size: PropTypes.object.isRequired,
        pathType: PropTypes.string,
        targetDepth: PropTypes.number,
        stepDown: PropTypes.number,
        safetyHeight: PropTypes.number,
        stopHeight: PropTypes.number,
        enableTab: PropTypes.bool,
        tabWidth: PropTypes.number,
        tabHeight: PropTypes.number,
        tabSpace: PropTypes.number,
        methodType: PropTypes.string,
        // fillDensity: PropTypes.number.isRequired,

        // action
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired
    };

    state = {
        methodExpanded: true,
        heightExpanded: true
    };

    actions = {
        onToggleMethodExpand: () => {
            this.setState(state => ({ methodExpanded: !state.methodExpanded }));
        },
        onToggleHeightExpand: () => {
            this.setState(state => ({ heightExpanded: !state.heightExpanded }));
        },
        // config
        onChangePathType: (options) => {
            this.props.updateSelectedModelGcodeConfig({
                pathType: options.value,
                fillEnabled: (options.value === 'pocket')
            });
        },
        onChangeTargetDepth: (targetDepth) => {
            if (targetDepth > this.props.size.z) {
                return;
            }
            this.props.updateSelectedModelGcodeConfig({ targetDepth: targetDepth });
            if (targetDepth < this.props.stepDown) {
                this.props.updateSelectedModelGcodeConfig({ stepDown: targetDepth });
            }
            if (-targetDepth > this.props.tabHeight) {
                this.props.updateSelectedModelGcodeConfig({ stepDown: -targetDepth });
            }
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.props.updateSelectedModelGcodeConfig({ safetyHeight: safetyHeight });
        },
        onChangeStopHeight: (stopHeight) => {
            this.props.updateSelectedModelGcodeConfig({ stopHeight: stopHeight });
        },
        // Fill
        onChangeFillDensity: (fillDensity) => {
            this.props.updateSelectedModelGcodeConfig({ fillDensity });
        },
        // Tab
        onToggleEnableTab: () => {
            const enableTab = !this.props.enableTab;
            this.props.updateSelectedModelGcodeConfig({ enableTab: enableTab });
        },
        onTabWidth: (tabWidth) => {
            this.props.updateSelectedModelGcodeConfig({ tabWidth: tabWidth });
        },
        onTabHeight: (tabHeight) => {
            this.props.updateSelectedModelGcodeConfig({ tabHeight: tabHeight });
        },
        onTabSpace: (tabSpace) => {
            this.props.updateSelectedModelGcodeConfig({ tabSpace: tabSpace });
        }
    };

    render() {
        const { size, disabled } = this.props;
        const {
            pathType, targetDepth, safetyHeight, stopHeight,
            enableTab, tabWidth, tabHeight, tabSpace, methodType
        } = this.props;
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
                        <TipTrigger
                            title={i18n._('method')}
                            content={(
                                <div>
                                    <p>{i18n._('Select a carving path:')}</p>
                                    <ul>
                                        <li><b>{i18n._('On the Path')}</b>: {i18n._('Carve along the shape of the image.')}</li>
                                        <li><b>{i18n._('Outline')}</b>: {i18n._('Carve along the contour of the image.')}</li>
                                        <li><b>{i18n._('Fill')}</b>: {i18n._('Carve away the inner of the image.')}</li>
                                    </ul>
                                </div>
                            )}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Path')}</span>
                                <Select
                                    disabled={disabled}
                                    className="sm-parameter-row__select"
                                    backspaceRemoves={false}
                                    clearable={false}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name="carvePath"
                                    options={[
                                        {
                                            label: i18n._('On the Path'),
                                            value: 'path'
                                        },
                                        {
                                            label: i18n._('Outline'),
                                            value: 'outline'
                                        },
                                        {
                                            label: i18n._('Fill'),
                                            value: 'pocket'
                                        }
                                    ]}
                                    placeholder={i18n._('Choose carving path')}
                                    value={pathType}
                                    onChange={this.actions.onChangePathType}
                                />
                            </div>
                        </TipTrigger>
                        {(pathType === 'path' || pathType === 'outline') && (
                            <OptionalDropdown
                                style={{ marginBottom: '10px' }}
                                title={i18n._('Tabs')}
                                onClick={this.actions.onToggleEnableTab}
                                hidden={!enableTab}
                            >
                                <TipTrigger
                                    title={i18n._('Tab Height')}
                                    content={i18n._('Enter the height of the tabs.')}
                                >
                                    <div className="sm-parameter-row">
                                        <span className="sm-parameter-row__label">{i18n._('Tab Height')}</span>
                                        <Input
                                            className="sm-parameter-row__input"
                                            value={tabHeight}
                                            min={-targetDepth}
                                            max={0}
                                            step={0.5}
                                            onChange={this.actions.onTabHeight}
                                            disabled={disabled & !enableTab}
                                        />
                                        <span className="sm-parameter-row__input-unit">mm</span>
                                    </div>
                                </TipTrigger>
                                <TipTrigger
                                    title={i18n._('Tab Space')}
                                    content={i18n._('Enter the space between any two tabs.')}
                                >
                                    <div className="sm-parameter-row">
                                        <span className="sm-parameter-row__label">{i18n._('Tab Space')}</span>
                                        <Input
                                            className="sm-parameter-row__input"
                                            value={tabSpace}
                                            min={1}
                                            step={1}
                                            onChange={this.actions.onTabSpace}
                                            disabled={disabled & !enableTab}
                                        />
                                        <span className="sm-parameter-row__input-unit">mm</span>
                                    </div>
                                </TipTrigger>
                                <TipTrigger
                                    title={i18n._('Tab Width')}
                                    content={i18n._('Enter the width of the tabs.')}
                                >
                                    <div className="sm-parameter-row">
                                        <span className="sm-parameter-row__label">{i18n._('Tab Width')}</span>
                                        <Input
                                            className="sm-parameter-row__input"
                                            value={tabWidth}
                                            min={1}
                                            step={1}
                                            onChange={this.actions.onTabWidth}
                                            disabled={disabled & !enableTab}
                                        />
                                        <span className="sm-parameter-row__input-unit">mm</span>
                                    </div>
                                </TipTrigger>
                            </OptionalDropdown>
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
    const toolPathModelGroup = state.cnc.toolPathModelGroup;
    const toolPathModel = toolPathModelGroup.getSelectedModel();
    const { gcodeConfig } = toolPathModel;
    const {
        pathType, targetDepth, stepDown, safetyHeight, stopHeight,
        fillEnabled, fillDensity,
        enableTab, tabWidth, tabHeight, tabSpace
    } = gcodeConfig;
    return {
        size: machine.size,
        pathType,
        targetDepth,
        stepDown,
        safetyHeight,
        stopHeight,
        // fill
        fillEnabled,
        fillDensity,
        // tab
        enableTab,
        tabWidth,
        tabHeight,
        tabSpace
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelGcodeConfig: (params) => dispatch(actions.updateSelectedModelGcodeConfig('cnc', params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(VectorParameters);
