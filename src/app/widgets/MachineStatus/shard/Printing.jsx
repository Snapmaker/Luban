import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Anchor from '../../../components/Anchor';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import { actions as machineActions } from '../../../flux/machine';
import JogDistance from './JogDistance';


class Printing extends PureComponent {
    static propTypes = {
        printingExpanded: PropTypes.bool,
        isConnected: PropTypes.bool,
        nozzleTemperature: PropTypes.number.isRequired,
        nozzleTargetTemperature: PropTypes.number.isRequired,
        heatedBedTemperature: PropTypes.number.isRequired,
        heatedBedTargetTemperature: PropTypes.number.isRequired,

        executePrintingGcode: PropTypes.func.isRequired,
        updateWidgetState: PropTypes.func
    };


    state = {
        workSpeed: 100,
        workSpeedValue: 100,
        nozzleTemperatureValue: this.props.nozzleTargetTemperature,
        heatedBedTemperatureValue: this.props.heatedBedTargetTemperature,
        zOffsetValue: 0.05,
        zOffsetMarks: [0.05, 0.1, 0.2]
    };

    actions = {
        togglePrinting: () => {
            this.props.updateWidgetState({
                printingExpanded: !this.props.printingExpanded
            });
        },
        onChangeNozzleTemperatureValue: (value) => {
            this.setState({
                nozzleTemperatureValue: value
            });
        },
        onClickNozzleTemperature: () => {
            this.props.executePrintingGcode(`M104 S${this.state.nozzleTemperatureValue}`);
        },
        onChangeHeatedBedTemperatureValue: (value) => {
            this.setState({
                heatedBedTemperatureValue: value
            });
        },
        onClickHeatedBedTemperature: () => {
            this.props.executePrintingGcode(`M140 S${this.state.heatedBedTemperatureValue}`);
        },
        onChangeWorkSpeedValue: (value) => {
            this.setState({
                workSpeedValue: value
            });
        },
        onClickWorkSpeed: () => {
            const workSpeedValue = this.state.workSpeedValue;
            this.setState({
                workSpeed: workSpeedValue
            });
            this.props.executePrintingGcode(`M221 S${workSpeedValue}`);
        },
        onChangeZOffset: (value) => {
            this.setState({
                zOffsetValue: value
            });
        },
        onClickPlusZOffset: () => {
            const value = this.state.zOffsetValue;
            this.props.executePrintingGcode(`zOffset ${value}`);
        },
        onClickMinusZOffset: () => {
            const value = this.state.zOffsetValue;
            this.props.executePrintingGcode(`zOffset -${value}`);
        }
    };

    render() {
        const { printingExpanded, isConnected, nozzleTemperature, heatedBedTemperature } = this.props;
        const { nozzleTemperatureValue, heatedBedTemperatureValue, workSpeed, workSpeedValue, zOffsetMarks, zOffsetValue } = this.state;
        const actions = this.actions;
        return (
            <div>
                <div className="sm-parameter-container">
                    <Anchor className="sm-parameter-header" onClick={actions.togglePrinting}>
                        <span className="fa fa-gear sm-parameter-header__indicator" />
                        <span className="sm-parameter-header__title">{i18n._('3D Printer')}</span>
                        <span className={classNames(
                            'fa',
                            printingExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                            'sm-parameter-header__indicator',
                            'pull-right',
                        )}
                        />
                    </Anchor>
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label-lg">{i18n._('Work Speed')}</span>
                        <span className="sm-parameter-row__input2-text">{workSpeed}/</span>
                        <Input
                            className="sm-parameter-row__input2"
                            value={workSpeedValue}
                            max={500}
                            min={0}
                            onChange={actions.onChangeWorkSpeedValue}
                        />
                        <span className="sm-parameter-row__input2-unit">%</span>
                        <Anchor
                            className="sm-parameter-row__input2-check fa fa-chevron-circle-right"
                            onClick={actions.onClickWorkSpeed}
                        />
                    </div>
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label-lg">{i18n._('Nozzle Temp')}</span>
                        <span className="sm-parameter-row__input2-text">{nozzleTemperature}/</span>
                        <Input
                            className="sm-parameter-row__input2"
                            value={nozzleTemperatureValue}
                            max={250}
                            min={0}
                            onChange={actions.onChangeNozzleTemperatureValue}
                        />
                        <span className="sm-parameter-row__input2-unit">°C</span>
                        <Anchor
                            className="sm-parameter-row__input2-check fa fa-chevron-circle-right"
                            onClick={actions.onClickNozzleTemperature}
                        />
                    </div>

                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label">{i18n._('Heated Bed Temp')}</span>
                        <span className="sm-parameter-row__input2-text">{heatedBedTemperature}/</span>
                        <Input
                            className="sm-parameter-row__input2"
                            value={heatedBedTemperatureValue}
                            max={80}
                            min={0}
                            onChange={actions.onChangeHeatedBedTemperatureValue}
                        />
                        <span className="sm-parameter-row__input2-unit">°C</span>
                        <Anchor
                            className="sm-parameter-row__input2-check fa fa-chevron-circle-right"
                            onClick={actions.onClickHeatedBedTemperature}
                        />
                    </div>

                    {isConnected && (
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Z Offset')}</span>
                            <Anchor
                                className="sm-parameter-row__input2"
                                style={{
                                    marginRight: '84px'
                                }}
                            >
                                <JogDistance
                                    marks={zOffsetMarks}
                                    onChange={actions.onChangeZOffset}
                                    defaultValue={zOffsetValue}
                                />
                            </Anchor>
                            <Anchor
                                className="sm-parameter-row__input2-check fa fa-plus"
                                onClick={actions.onClickPlusZOffset}
                            />
                            <Anchor
                                className="sm-parameter-row__input2-check fa fa-minus"
                                style={{
                                    right: '152px'
                                }}
                                onClick={actions.onClickMinusZOffset}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { isConnected, nozzleTemperature, nozzleTargetTemperature, heatedBedTemperature, heatedBedTargetTemperature } = machine;

    return {
        isConnected,
        nozzleTemperature,
        nozzleTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executePrintingGcode: (gcode) => dispatch(machineActions.executePrintingGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
