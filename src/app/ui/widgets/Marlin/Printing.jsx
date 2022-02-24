import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import { actions as machineActions } from '../../../flux/machine';
import JogDistance from './JogDistance';
import WorkSpeed from './WorkSpeed';
import { CONNECTION_TYPE_WIFI,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    CONNECTION_BED_TEMPERATURE,
    CONNECTION_NOZZLE_TEMPERATURE,
    CONNECTION_Z_OFFSET,
    CONNECTION_LOAD_FILAMENT,
    CONNECTION_UNLOAD_FILAMENT
} from '../../../constants';
import { controller } from '../../../lib/controller';

class Printing extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool,
        connectionType: PropTypes.string,
        nozzleTargetTemperature: PropTypes.number.isRequired,
        heatedBedTargetTemperature: PropTypes.number.isRequired,
        workflowStatus: PropTypes.string.isRequired,
        nozzleTemperature: PropTypes.number.isRequired,
        addConsoleLogs: PropTypes.func.isRequired,
        heatedBedTemperature: PropTypes.number.isRequired
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
            controller.emitEvent(CONNECTION_NOZZLE_TEMPERATURE, {
                nozzleTemperatureValue: this.state.nozzleTemperatureValue
            });
        },
        onChangeHeatedBedTemperatureValue: (value) => {
            this.setState({
                heatedBedTemperatureValue: value
            });
        },
        onClickHeatedBedTemperature: () => {
            controller.emitEvent(CONNECTION_BED_TEMPERATURE, {
                heatedBedTemperatureValue: this.state.heatedBedTemperatureValue
            });
        },
        onChangeZOffset: (value) => {
            this.setState({
                zOffsetValue: value
            });
        },
        onClickPlusZOffset: () => {
            const zOffset = this.state.zOffsetValue;
            controller.emitEvent(CONNECTION_Z_OFFSET, {
                zOffset
            }).once(CONNECTION_Z_OFFSET, ({ msg }) => {
                if (msg) {
                    return;
                }
                this.props.addConsoleLogs([`Z Offset ${zOffset} ok`]);
            });
        },
        onClickMinusZOffset: () => {
            const zOffset = 0 - this.state.zOffsetValue;
            controller.emitEvent(CONNECTION_Z_OFFSET, {
                zOffset
            }).once(CONNECTION_Z_OFFSET, ({ msg }) => {
                if (msg) {
                    return;
                }
                this.props.addConsoleLogs([`Z Offset ${zOffset} ok`]);
            });
        },
        onClickLoad: () => {
            controller.emitEvent(CONNECTION_LOAD_FILAMENT);
        },
        onClickUnload: () => {
            controller.emitEvent(CONNECTION_UNLOAD_FILAMENT);
        }
    };

    render() {
        const { isConnected, heatedBedTemperature, heatedBedTargetTemperature, nozzleTemperature, nozzleTargetTemperature, workflowStatus } = this.props;
        const { zOffsetMarks, zOffsetValue } = this.state;
        const actions = this.actions;
        return (
            <div>
                {workflowStatus === 'running' && <WorkSpeed />}
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span className="height-32">{i18n._('key-unused-Nozzle Temp.')}</span>
                    <div className="sm-flex-auto">
                        <span className="height-32">{nozzleTemperature} / </span>
                        <Input
                            suffix="°C"
                            size="small"
                            defaultValue={nozzleTargetTemperature}
                            value={this.state.nozzleTemperatureValue}
                            max={250}
                            min={0}
                            onChange={actions.onChangeNozzleTemperatureValue}
                        />
                        <SvgIcon
                            name="Reset"
                            size={24}
                            className="border-default-black-5 margin-left-4 border-radius-8"
                            onClick={actions.onClickNozzleTemperature}
                            borderRadius={8}
                        />
                    </div>
                </div>

                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span className="height-32">{i18n._('key-Workspace/Connection-Build Plate Temp.')}</span>
                    <div className="sm-flex-auto">
                        <span className="height-32">{heatedBedTemperature} / </span>
                        <Input
                            suffix="°C"
                            size="small"
                            defaultValue={heatedBedTargetTemperature}
                            value={this.state.heatedBedTemperatureValue}
                            max={80}
                            min={0}
                            onChange={actions.onChangeHeatedBedTemperatureValue}
                        />
                        <SvgIcon
                            name="Reset"
                            size={24}
                            className="border-default-black-5 margin-left-4 border-radius-8"
                            onClick={actions.onClickHeatedBedTemperature}
                            borderRadius={8}
                        />
                    </div>
                </div>

                {workflowStatus !== 'running' && (
                    <div className="sm-flex justify-space-between margin-vertical-8">
                        <span className="height-32">{i18n._('key-unused-Filament')}</span>
                        <div>
                            <Button
                                priority="level-three"
                                width="96px"
                                className="display-inline"
                                onClick={actions.onClickUnload}
                            >
                                {i18n._('key-unused-Unload')}
                            </Button>
                            <Button
                                className="margin-left-4 display-inline"
                                priority="level-three"
                                width="96px"
                                onClick={actions.onClickLoad}
                            >
                                {i18n._('key-unused-Load')}
                            </Button>
                        </div>
                    </div>
                )}

                {isConnected && _.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus) && (
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label">{i18n._('key-unused-Z Offset')}</span>
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
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { isConnected,
        connectionType,
        nozzleTemperature,
        nozzleTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature,
        workflowStatus } = machine;

    return {
        isConnected,
        connectionType,
        nozzleTemperature,
        nozzleTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature,
        workflowStatus
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        addConsoleLogs: (gcode, context) => dispatch(machineActions.addConsoleLogs(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
