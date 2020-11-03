import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Slider from 'rc-slider';

import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import OptionalDropdown from '../../components/OptionalDropdown';
import { ABSENT_VALUE } from '../../constants';


class GcodeParameters extends PureComponent {
    static propTypes = {
        selectedModelArray: PropTypes.array,
        selectedModelVisible: PropTypes.bool,
        printOrder: PropTypes.number.isRequired,
        gcodeConfig: PropTypes.shape({
            // jogSpeed: PropTypes.number.isRequired,
            jogSpeed: PropTypes.number,
            workSpeed: PropTypes.number,
            plungeSpeed: PropTypes.number,
            dwellTime: PropTypes.number,
            multiPassEnabled: PropTypes.bool,
            multiPassDepth: PropTypes.number,
            multiPasses: PropTypes.number,
            fixedPowerEnabled: PropTypes.bool,
            fixedPower: PropTypes.number
        }),
        paramsDescs: PropTypes.shape({
            jogSpeed: PropTypes.string,
            workSpeed: PropTypes.string,
            plungeSpeed: PropTypes.string,
            dwellTime: PropTypes.string
        }),

        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onChangePrintOrder: (printOrder) => {
            this.props.updateSelectedModelPrintOrder(printOrder);
        },
        onChangeJogSpeed: (jogSpeed) => {
            this.props.updateSelectedModelGcodeConfig({ jogSpeed });
        },
        onChangeWorkSpeed: (workSpeed) => {
            this.props.updateSelectedModelGcodeConfig({ workSpeed });
        },
        onChangePlungeSpeed: (plungeSpeed) => {
            this.props.updateSelectedModelGcodeConfig({ plungeSpeed });
        },
        onChangeDwellTime: (dwellTime) => {
            this.props.updateSelectedModelGcodeConfig({ dwellTime });
        },
        // multi-pass
        onToggleMultiPassEnabled: () => {
            this.props.updateSelectedModelGcodeConfig({ multiPassEnabled: !this.props.gcodeConfig.multiPassEnabled });
        },
        onChangeMultiDepth: (multiPassDepth) => {
            this.props.updateSelectedModelGcodeConfig({ multiPassDepth });
        },
        onChangeMultiPasses: (multiPasses) => {
            this.props.updateSelectedModelGcodeConfig({ multiPasses });
        },
        // fixed power
        onToggleFixedPowerEnabled: () => {
            this.props.updateSelectedModelGcodeConfig({ fixedPowerEnabled: !this.props.gcodeConfig.fixedPowerEnabled });
        },
        onChangeFixedPower: (fixedPower) => {
            this.props.updateSelectedModelGcodeConfig({ fixedPower });
        }
    };

    render() {
        const { printOrder, selectedModelArray, selectedModelVisible } = this.props;
        const actions = this.actions;
        const {
            jogSpeed = 0, workSpeed = 0, dwellTime = 0, plungeSpeed = 0,
            fixedPowerEnabled, fixedPower = 0,
            multiPassEnabled, multiPasses = 0, multiPassDepth = 0
        } = this.props.gcodeConfig;
        // todo
        const disabled = !(selectedModelArray && selectedModelArray.length === 1 && selectedModelVisible);

        return (
            <React.Fragment>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-gears sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Working Parameters')}</span>
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
                            title={i18n._('Processing Order')}
                            content={i18n._('When engraving multiple images, this parameter determines the print order of the selected image. When the orders are the same, the image uploaded first will be engraved first.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Print Order')}</span>
                                <Input
                                    className="sm-parameter-row__slider-input"
                                    value={printOrder}
                                    disabled={disabled}
                                    min={1}
                                    max={10}
                                    onChange={actions.onChangePrintOrder}
                                />
                                <Slider
                                    className="sm-parameter-row__slider"
                                    value={printOrder}
                                    disabled={disabled}
                                    min={1}
                                    max={10}
                                    onChange={actions.onChangePrintOrder}
                                />
                            </div>
                        </TipTrigger>
                        {jogSpeed !== ABSENT_VALUE && (
                            <TipTrigger
                                title={i18n._('Jog Speed')}
                                content={this.props.paramsDescs.jogSpeed}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Jog Speed')}</span>
                                    <Input
                                        className="sm-parameter-row__input"
                                        value={jogSpeed}
                                        disabled={disabled}
                                        min={1}
                                        max={6000}
                                        step={1}
                                        onChange={actions.onChangeJogSpeed}
                                    />
                                    <span className="sm-parameter-row__input-unit">mm/min</span>
                                </div>
                            </TipTrigger>
                        )}
                        {workSpeed !== ABSENT_VALUE && (
                            <TipTrigger
                                title={i18n._('Work Speed')}
                                content={this.props.paramsDescs.workSpeed}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Work Speed')}</span>
                                    <Input
                                        className="sm-parameter-row__input"
                                        value={workSpeed}
                                        disabled={disabled}
                                        min={1}
                                        step={1}
                                        max={6000}
                                        onChange={actions.onChangeWorkSpeed}
                                    />
                                    <span className="sm-parameter-row__input-unit">mm/min</span>
                                </div>
                            </TipTrigger>
                        )}
                        {dwellTime !== ABSENT_VALUE && (
                            <TipTrigger
                                title={i18n._('Dwell Time')}
                                content={this.props.paramsDescs.dwellTime}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Dwell Time')}</span>
                                    <Input
                                        className="sm-parameter-row__input"
                                        value={dwellTime}
                                        disabled={disabled}
                                        min={0.1}
                                        max={1000}
                                        step={0.1}
                                        onChange={actions.onChangeDwellTime}
                                    />
                                    <span className="sm-parameter-row__input-unit">ms/dot</span>
                                </div>
                            </TipTrigger>
                        )}
                        {plungeSpeed !== ABSENT_VALUE && (
                            <TipTrigger
                                title={i18n._('Plunge Speed')}
                                content={this.props.paramsDescs.plungeSpeed}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Plunge Speed')}</span>
                                    <Input
                                        className="sm-parameter-row__input"
                                        value={plungeSpeed}
                                        disabled={disabled}
                                        min={0.1}
                                        max={1000}
                                        step={0.1}
                                        onChange={actions.onChangePlungeSpeed}
                                    />
                                    <span className="sm-parameter-row__input-unit">mm/min</span>
                                </div>
                            </TipTrigger>
                        )}
                        {multiPassEnabled !== undefined && (
                            <OptionalDropdown
                                style={{ marginTop: '10px', marginBottom: '10px' }}
                                title={i18n._('Multi-pass')}
                                titleTip={i18n._('When enabled, the printer will run the G-code multiple times automatically according to the below settings. This feature helps you cut materials that can\'t be cut with only one pass.')}
                                disabled={disabled}
                                onClick={actions.onToggleMultiPassEnabled}
                                hidden={!multiPassEnabled}
                            >

                                <TipTrigger
                                    title={i18n._('Passes')}
                                    content={i18n._('Determines how many times the printer will run the G-code automatically.')}
                                >
                                    <div className="sm-parameter-row">
                                        <span className="sm-parameter-row__label">{i18n._('Passes')}</span>
                                        <Input
                                            className="sm-parameter-row__input"
                                            min={2}
                                            max={50}
                                            disabled={disabled}
                                            value={multiPasses}
                                            onChange={actions.onChangeMultiPasses}
                                        />
                                    </div>
                                </TipTrigger>

                                <TipTrigger
                                    title={i18n._('Pass Depth')}
                                    content={i18n._('Determines how much the laser module will be lowered after each pass.')}
                                >
                                    <div className="sm-parameter-row">
                                        <span className="sm-parameter-row__label">{i18n._('Pass Depth')}</span>
                                        <Input
                                            className="sm-parameter-row__input"
                                            min={0}
                                            max={10}
                                            value={multiPassDepth}
                                            disabled={disabled}
                                            onChange={actions.onChangeMultiDepth}
                                        />
                                        <span className="sm-parameter-row__input-unit">mm</span>
                                    </div>
                                </TipTrigger>
                            </OptionalDropdown>
                        )}
                        {fixedPowerEnabled !== undefined && (
                            <OptionalDropdown
                                style={{ marginTop: '10px' }}
                                title={i18n._('Fixed Power')}
                                titleTip={i18n._('When enabled, the power used to engrave this image will be set in the G-code, so it is not affected by the power you set in Workspace. When engraving multiple images, you can set the power for each image separately.')}
                                disabled={disabled}
                                onClick={actions.onToggleFixedPowerEnabled}
                                hidden={!fixedPowerEnabled}
                            >
                                <TipTrigger
                                    title={i18n._('Power')}
                                    content={i18n._('Power to use when laser is working.')}
                                >
                                    <div className="sm-parameter-row">
                                        <span className="sm-parameter-row__label">{i18n._('Power (%)')}</span>
                                        <Input
                                            className="sm-parameter-row__slider-input"
                                            min={1}
                                            max={100}
                                            value={fixedPower}
                                            disabled={disabled}
                                            onChange={actions.onChangeFixedPower}
                                        />
                                        <Slider
                                            className="sm-parameter-row__slider"
                                            value={fixedPower}
                                            min={0}
                                            max={100}
                                            step={0.5}
                                            disabled={disabled}
                                            onChange={actions.onChangeFixedPower}
                                        />
                                    </div>
                                </TipTrigger>

                            </OptionalDropdown>
                        )}
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    }
}

export default GcodeParameters;
