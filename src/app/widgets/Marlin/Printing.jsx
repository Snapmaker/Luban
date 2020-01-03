import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import { actions as machineActions } from '../../flux/machine';
import JogDistance from './JogDistance';
import WorkSpeed from './WorkSpeed';
import { CONNECTION_TYPE_WIFI, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING } from '../../constants';


class Printing extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool,
        connectionType: PropTypes.string,
        server: PropTypes.object,
        nozzleTargetTemperature: PropTypes.number.isRequired,
        heatedBedTargetTemperature: PropTypes.number.isRequired,
        workflowStatus: PropTypes.string.isRequired,

        executeGcode: PropTypes.func.isRequired,
        addConsoleLogs: PropTypes.func.isRequired
    };

    state = {
        nozzleTemperatureValue: this.props.nozzleTargetTemperature,
        heatedBedTemperatureValue: this.props.heatedBedTargetTemperature,
        zOffsetValue: 0.05,
        zOffsetMarks: [0.05, 0.1, 0.2]
    };

    actions = {
        isWifiPrinting: () => {
            const { workflowStatus, connectionType } = this.props;
            return _.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus)
                && connectionType === CONNECTION_TYPE_WIFI;
        },
        onChangeNozzleTemperatureValue: (value) => {
            this.setState({
                nozzleTemperatureValue: value
            });
        },
        onClickNozzleTemperature: () => {
            if (this.actions.isWifiPrinting()) {
                this.props.server.updateNozzleTemperature(this.state.nozzleTemperatureValue);
            } else {
                this.props.executeGcode(`M104 S${this.state.nozzleTemperatureValue}`);
            }
        },
        onChangeHeatedBedTemperatureValue: (value) => {
            this.setState({
                heatedBedTemperatureValue: value
            });
        },
        onClickHeatedBedTemperature: () => {
            if (this.actions.isWifiPrinting()) {
                this.props.server.updateBedTemperature(this.state.heatedBedTemperatureValue);
            } else {
                this.props.executeGcode(`M140 S${this.state.heatedBedTemperatureValue}`);
            }
        },
        onChangeZOffset: (value) => {
            this.setState({
                zOffsetValue: value
            });
        },
        onClickPlusZOffset: () => {
            const value = this.state.zOffsetValue;
            if (this.actions.isWifiPrinting()) {
                this.props.server.updateZOffset(value, (err) => {
                    if (err) {
                        return;
                    }
                    this.props.addConsoleLogs([`Z Offset ${value} ok`]);
                });
            }
        },
        onClickMinusZOffset: () => {
            const value = this.state.zOffsetValue;
            if (this.actions.isWifiPrinting()) {
                this.props.server.updateZOffset(-value, (err) => {
                    if (err) {
                        return;
                    }
                    this.props.addConsoleLogs([`Z Offset ${-value} ok`]);
                });
            }
        },
        onClickLoad: () => {
            if (this.actions.isWifiPrinting()) {
                this.props.server.loadFilament();
            } else {
                this.props.executeGcode('G91;\nG0 E60 F200;\nG90;');
            }
        },
        onClickUnload: () => {
            if (this.actions.isWifiPrinting()) {
                this.props.server.unloadFilament();
            } else {
                this.props.executeGcode('G91;\nG0 E6 F200;\nG0 E-60 F150;\nG90;');
            }
        }
    };

    render() {
        const { isConnected, nozzleTargetTemperature, heatedBedTargetTemperature, workflowStatus } = this.props;
        const { nozzleTemperatureValue, heatedBedTemperatureValue, zOffsetMarks, zOffsetValue } = this.state;
        const actions = this.actions;
        return (
            <div>
                <div className="sm-parameter-container">
                    <WorkSpeed />
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label-lg">{i18n._('Nozzle Temp.')}</span>
                        <span className="sm-parameter-row__input2-text">{nozzleTargetTemperature} / </span>
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
                        <span className="sm-parameter-row__label">{i18n._('Heated Bed Temp.')}</span>
                        <span className="sm-parameter-row__input2-text">{heatedBedTargetTemperature} / </span>
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

                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label">{i18n._('Filament')}</span>
                        <button
                            type="button"
                            className="btn btn-default"
                            style={{
                                width: '82px',
                                float: 'right'
                            }}
                            onClick={actions.onClickUnload}
                        >
                            {i18n._('Unload')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-default"
                            style={{
                                width: '82px',
                                float: 'right',
                                marginRight: '2px'
                            }}
                            onClick={actions.onClickLoad}
                        >
                            {i18n._('load')}
                        </button>
                    </div>

                    {isConnected && _.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus) && (
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
    const { isConnected,
        connectionType,
        nozzleTemperature,
        server,
        nozzleTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature,
        workflowStatus } = machine;

    return {
        isConnected,
        connectionType,
        server,
        nozzleTemperature,
        nozzleTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature,
        workflowStatus
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context)),
        addConsoleLogs: (gcode, context) => dispatch(machineActions.addConsoleLogs(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
