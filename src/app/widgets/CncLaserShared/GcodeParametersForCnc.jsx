import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Slider from 'rc-slider';
import { connect } from 'react-redux';

import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
// import OptionalDropdown from '../../components/OptionalDropdown';
import { ABSENT_VALUE } from '../../constants';


class GcodeParameters extends PureComponent {
    static propTypes = {
        selectedModelArray: PropTypes.array,
        selectedModelVisible: PropTypes.bool,
        printOrder: PropTypes.number.isRequired,
        materials: PropTypes.object,
        gcodeConfig: PropTypes.shape({
            stepDown: PropTypes.number,
            jogSpeed: PropTypes.number,
            workSpeed: PropTypes.number,
            plungeSpeed: PropTypes.number,
            targetDepth: PropTypes.number,
            density: PropTypes.number
            // dwellTime: PropTypes.number,
            // multiPassEnabled: PropTypes.bool,
            // multiPassDepth: PropTypes.number,
            // multiPasses: PropTypes.number,
            // fixedPowerEnabled: PropTypes.bool,
            // fixedPower: PropTypes.number
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
        toolExpanded: true
    };

    actions = {
        onChangeDensity: (density) => {
            this.props.updateSelectedModelGcodeConfig({ density });
        },
        onToggleToolExpand: () => {
            this.setState(state => ({ toolExpanded: !state.toolExpanded }));
        },
        onChangePrintOrder: (printOrder) => {
            this.props.updateSelectedModelPrintOrder(printOrder);
        },
        onChangeStepDown: (stepDown) => {
            this.props.updateSelectedModelGcodeConfig({ stepDown });
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
        onChangeMultiDepth: (multiPassDepth) => {
            this.props.updateSelectedModelGcodeConfig({ multiPassDepth });
        },
        onChangeMultiPasses: (multiPasses) => {
            this.props.updateSelectedModelGcodeConfig({ multiPasses });
        }
    };

    render() {
        const { selectedModelArray, selectedModelVisible, materials, printOrder } = this.props;
        const actions = this.actions;
        const { isRotate, diameter } = materials;
        const {
            jogSpeed = 0, workSpeed = 0, plungeSpeed = 0,
            stepDown = 0, density,
            targetDepth = 0
        } = this.props.gcodeConfig;
        // todo
        const disabled = !(selectedModelArray && selectedModelArray.length === 1 && selectedModelVisible);

        return (
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

                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleToolExpand}>
                    <span className="fa fa-image sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Path')}</span>
                    <span className={classNames(
                        'fa',
                        this.state.toolExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {this.state.toolExpanded && (
                    <React.Fragment>
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
                        {stepDown !== undefined && (
                            <TipTrigger
                                title={i18n._('Step Down')}
                                content={i18n._('Enter the depth of each carving step.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Step Down')}</span>
                                    <Input
                                        disabled={disabled}
                                        className="sm-parameter-row__input"
                                        value={stepDown}
                                        min={0.01}
                                        max={isRotate ? diameter : targetDepth}
                                        step={0.1}
                                        onChange={this.actions.onChangeStepDown}
                                    />
                                    <span className="sm-parameter-row__input-unit">mm</span>
                                </div>
                            </TipTrigger>
                        )}
                        {density !== undefined && (
                            <TipTrigger
                                title={i18n._('Density')}
                                content={i18n._('Set the density of the tool head movements. The highest density is 10 dot/mm. When generating G-code, the density will be re-calculated to ensure the process work normally.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Density')}</span>
                                    <Input
                                        disabled={disabled}
                                        className="sm-parameter-row__input"
                                        value={density}
                                        min={0.1}
                                        max={20}
                                        step={0.1}
                                        onChange={this.actions.onChangeDensity}
                                    />
                                    <span className="sm-parameter-row__input-unit">dot/mm</span>
                                </div>
                            </TipTrigger>
                        )}
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    }
}
const mapStateToProps = (state) => {
    const { materials } = state.cnc;
    return {
        materials
    };
};

export default connect(mapStateToProps)(GcodeParameters);
