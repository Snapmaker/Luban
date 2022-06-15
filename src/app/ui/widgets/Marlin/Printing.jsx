import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
import Anchor from '../../components/Anchor';
// import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import EditComponent from '../../components/Edit';
import i18n from '../../../lib/i18n';
// import { NumberInput as Input } from '../../components/Input';
import { actions as machineActions } from '../../../flux/machine';
import JogDistance from './JogDistance';
import WorkSpeed from './WorkSpeed';
import {
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    CONNECTION_Z_OFFSET,
    CONNECTION_LOAD_FILAMENT,
    CONNECTION_UNLOAD_FILAMENT,
    DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    CONNECTION_NOZZLE_TEMPERATURE,
    CONNECTION_BED_TEMPERATURE
} from '../../../constants';
import { controller } from '../../../lib/controller';

class Printing extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool,
        nozzleTargetTemperature: PropTypes.number.isRequired,
        heatedBedTargetTemperature: PropTypes.number.isRequired,
        workflowStatus: PropTypes.string.isRequired,
        nozzleTemperature: PropTypes.number.isRequired,
        addConsoleLogs: PropTypes.func.isRequired,
        heatedBedTemperature: PropTypes.number.isRequired,
        printingToolhead: PropTypes.string.isRequired,
        currentWorkNozzle: PropTypes.string.isRequired
    };

    state = {
        nozzleTemperatureValue: this.props.nozzleTargetTemperature,
        heatedBedTemperatureValue: this.props.heatedBedTargetTemperature,
        zOffsetValue: 0.05,
        zOffsetMarks: [0.05, 0.1, 0.2]
    };

    actions = {
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

    getSnapshotBeforeUpdate(prevProps) {
        const { heatedBedTargetTemperature, nozzleTargetTemperature } = this.props;
        if (heatedBedTargetTemperature !== prevProps.heatedBedTargetTemperature) {
            this.setState({ heatedBedTemperatureValue: heatedBedTargetTemperature });
        }
        if (nozzleTargetTemperature !== prevProps.nozzleTargetTemperature) {
            this.setState({ nozzleTemperatureValue: nozzleTargetTemperature });
        }
        return prevProps;
    }

    componentDidUpdate() {

    }

    render() {
        const { isConnected, heatedBedTemperature, heatedBedTargetTemperature, nozzleTemperature, nozzleTargetTemperature, workflowStatus, currentWorkNozzle, printingToolhead } = this.props;
        const { zOffsetMarks, zOffsetValue } = this.state;
        const actions = this.actions;
        return (
            <div>
                {workflowStatus === 'running' && <WorkSpeed />}
                {printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && (
                    <div>
                        <div>
                            <span>{i18n._('key-unused-Current Work Nozzle')}</span>
                            <span>{i18n._(`key-unused-Nozzle-${currentWorkNozzle}`)}</span>
                        </div>
                        <Button>
                            {i18n._('key-unused-Switch working nozzle')}
                        </Button>
                        <div className="dashed-border-use-background" />
                    </div>
                )}
                <div className="sm-flex-overflow-visible margin-vertical-8">
                    <div className="height-32 width-176 display-inline text-overflow-ellipsis">{i18n._(`${printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 ? 'key-unused-Left Nozzle Temp' : 'key-unused-Nozzle Temp.'}`)}</div>
                    <div className="sm-flex margin-left-24 overflow-visible">
                        <div className="width-40 sm-flex sm-flex-direction-c">
                            {/* <span>{i18n._('key-unused-Actual')}</span> */}
                            <span>Actual</span>
                            <span>{nozzleTemperature} °C</span>
                        </div>
                        <div className="width-40 sm-flex sm-flex-direction-c margin-left-16">
                            {/* <span>{i18n._('key-unused-Target')}</span> */}
                            <span>Target</span>
                            <span>{nozzleTargetTemperature} °C</span>
                        </div>
                        <EditComponent />
                    </div>
                </div>
                {workflowStatus !== 'running' && (
                    <div className="sm-flex justify-flex-end margin-vertical-8">
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

                {printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && (
                    <div>
                        <div className="sm-flex-overflow-visible margin-vertical-8">
                            <div className="height-32 width-176 display-inline text-overflow-ellipsis">{i18n._('key-unused-Right Nozzle Temp')}</div>
                            <div className="sm-flex margin-left-24 overflow-visible">
                                <div className="width-40 sm-flex sm-flex-direction-c">
                                    {/* <span>{i18n._('key-unused-Actual')}</span> */}
                                    <span>Actual</span>
                                    <span>{nozzleTemperature} °C</span>
                                </div>
                                <div className="width-40 sm-flex sm-flex-direction-c margin-left-16">
                                    {/* <span>{i18n._('key-unused-Target')}</span> */}
                                    <span>Target</span>
                                    <span>{nozzleTargetTemperature} °C</span>
                                </div>
                                <EditComponent />
                            </div>
                        </div>
                        {workflowStatus !== 'running' && (
                            <div className="sm-flex justify-flex-end margin-vertical-8">
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
                    </div>
                )}
                {/* <div className="sm-flex justify-space-between margin-vertical-8">
                    <span className="height-32 max-width-160 display-inline text-overflow-ellipsis">{i18n._('key-Workspace/Connection-Build Plate Temp.')}</span>
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
                </div> */}
                <div className="sm-flex-overflow-visible margin-vertical-8">
                    <div className="height-32 width-176 display-inline text-overflow-ellipsis">{i18n._('key-Workspace/Connection-Build Plate Temp.')}</div>
                    <div className="sm-flex margin-left-24 overflow-visible">
                        <div className="width-40 sm-flex sm-flex-direction-c">
                            {/* <span>{i18n._('key-unused-Actual')}</span> */}
                            <span>Actual</span>
                            <span>{heatedBedTemperature}°C</span>
                        </div>
                        <div className="width-40 sm-flex sm-flex-direction-c margin-left-16">
                            {/* <span>{i18n._('key-unused-Target')}</span> */}
                            <span>Target</span>
                            <span>{heatedBedTargetTemperature}°C</span>
                        </div>
                        <EditComponent />
                    </div>
                </div>

                {/* {workflowStatus !== 'running' && (
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
                )} */}

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
    const workspace = state.workspace;
    const { isConnected,
        connectionType,
        nozzleTemperature,
        nozzleTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature,
        workflowStatus,
        // toolHead: {
        //     printingToolhead
        // },
        currentWorkNozzle
    } = machine;
    const { toolHead: printingToolhead } = workspace;
    return {
        isConnected,
        connectionType,
        nozzleTemperature,
        nozzleTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature,
        workflowStatus,
        printingToolhead,
        currentWorkNozzle
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        addConsoleLogs: (gcode, context) => dispatch(machineActions.addConsoleLogs(gcode, context)),
        executeGcode: (gcode, context, cmd) => dispatch(machineActions.executeGcode(gcode, context, cmd))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
