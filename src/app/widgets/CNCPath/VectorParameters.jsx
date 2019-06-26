import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import Slider from 'rc-slider';

import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown/OptionalDropdown';
import { actions } from '../../reducers/cncLaserShared';


class VectorParameters extends PureComponent {
    static propTypes = {
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
        fillDensity: PropTypes.number.isRequired,

        // action
        updateSelectedModelConfig: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        // config
        onChangePathType: (options) => {
            this.props.updateSelectedModelConfig({
                pathType: options.value,
                fillEnabled: (options.value === 'pocket')
            });
        },
        onChangeTargetDepth: (targetDepth) => {
            if (targetDepth > this.props.size.z) {
                return;
            }
            this.props.updateSelectedModelConfig({ targetDepth: targetDepth });
            if (targetDepth < this.props.stepDown) {
                this.props.updateSelectedModelConfig({ stepDown: targetDepth });
            }
            if (-targetDepth > this.props.tabHeight) {
                this.props.updateSelectedModelConfig({ stepDown: -targetDepth });
            }
        },
        onChangeStepDown: (stepDown) => {
            this.props.updateSelectedModelConfig({ stepDown: stepDown });
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.props.updateSelectedModelConfig({ safetyHeight: safetyHeight });
        },
        onChangeStopHeight: (stopHeight) => {
            this.props.updateSelectedModelConfig({ stopHeight: stopHeight });
        },
        // Fill
        onChangeFillDensity: (fillDensity) => {
            this.props.updateSelectedModelConfig({ fillDensity });
        },
        // Tab
        onToggleEnableTab: () => {
            const enableTab = !this.props.enableTab;
            this.props.updateSelectedModelConfig({ enableTab: enableTab });
        },
        onTabWidth: (tabWidth) => {
            this.props.updateSelectedModelConfig({ tabWidth: tabWidth });
        },
        onTabHeight: (tabHeight) => {
            this.props.updateSelectedModelConfig({ tabHeight: tabHeight });
        },
        onTabSpace: (tabSpace) => {
            this.props.updateSelectedModelConfig({ tabSpace: tabSpace });
        }
    };

    render() {
        const { size } = this.props;
        const {
            pathType, targetDepth, stepDown, safetyHeight, stopHeight,
            fillDensity,
            enableTab, tabWidth, tabHeight, tabSpace
        } = this.props;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-image sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Path')}</span>
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
                        <TipTrigger
                            title={i18n._('Carve Path')}
                            content={(
                                <div>
                                    <p>{i18n._('Select a carve path:')}</p>
                                    <ul>
                                        <li><b>{i18n._('On the Path')}</b>: {i18n._('Carve along the shape of the image.')}</li>
                                        <li><b>{i18n._('Outline')}</b>: {i18n._('Carve along the contour of the image.')}</li>
                                        <li><b>{i18n._('Fill')}</b>: {i18n._('Carve away the inner of the image.')}</li>
                                    </ul>
                                </div>
                            )}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Carve Path')}</span>
                                <Select
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
                                    placeholder={i18n._('Choose carve path')}
                                    value={pathType}
                                    onChange={this.actions.onChangePathType}
                                />
                            </div>
                        </TipTrigger>
                        {pathType === 'pocket' && (
                            <TipTrigger
                                title={i18n._('Fill Density')}
                                content={i18n._('Set the precision at which an area is carved. The highest density is 0.05 mm (20 dot/mm). When it is set to 0, the SVG image will be carved without fill.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Fill Density')}</span>
                                    <Input
                                        className="sm-parameter-row__slider-input"
                                        value={fillDensity}
                                        min={1}
                                        max={20}
                                        onChange={this.actions.onChangeFillDensity}
                                    />
                                    <Slider
                                        className="sm-parameter-row__slider"
                                        value={fillDensity}
                                        min={1}
                                        max={20}
                                        onChange={this.actions.onChangeFillDensity}
                                    />
                                </div>
                            </TipTrigger>
                        )}
                        <TipTrigger
                            title={i18n._('Target Depth')}
                            content={i18n._('Enter the depth of the carved image. The depth cannot be deeper than the flute length.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Target Depth')}</span>
                                <Input
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
                            title={i18n._('Step Down')}
                            content={i18n._('Enter the depth of each carving step.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Step Down')}</span>
                                <Input
                                    className="sm-parameter-row__input"
                                    value={stepDown}
                                    min={0.01}
                                    max={targetDepth}
                                    step={0.1}
                                    onChange={this.actions.onChangeStepDown}
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
                                            disabled={!enableTab}
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
                                            disabled={!enableTab}
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
                                            disabled={!enableTab}
                                        />
                                        <span className="sm-parameter-row__input-unit">mm</span>
                                    </div>
                                </TipTrigger>
                            </OptionalDropdown>
                        )}
                    </React.Fragment>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { config } = state.cnc;
    const {
        pathType, targetDepth, stepDown, safetyHeight, stopHeight,
        fillEnabled, fillDensity,
        enableTab, tabWidth, tabHeight, tabSpace
    } = config;

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
        updateSelectedModelConfig: (params) => dispatch(actions.updateSelectedModelConfig('cnc', params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(VectorParameters);
