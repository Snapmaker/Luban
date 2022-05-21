import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash';
import Anchor from '../../components/Anchor';
// import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
// import EditComponent from '../../components/Edit';
import i18n from '../../../lib/i18n';
// import { NumberInput as Input } from '../../components/Input';
import { actions as machineActions } from '../../../flux/machine';
import JogDistance from './JogDistance';
import WorkSpeed from './WorkSpeed';
import { CONNECTION_TYPE_WIFI,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    CONNECTION_Z_OFFSET,
    CONNECTION_LOAD_FILAMENT,
    CONNECTION_UNLOAD_FILAMENT,
    DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    LEFT_EXTRUDER_MAP_NUMBER,
    CONNECTION_NOZZLE_TEMPERATURE,
    RIGHT_EXTRUDER_MAP_NUMBER,
    CONNECTION_BED_TEMPERATURE,
    CONNECTION_WORK_NOZZLE,
    WORKFLOW_STATUS_PAUSING,
    LEFT_EXTRUDER,
    // RIGHT_EXTRUDER,
} from '../../../constants';
import { controller } from '../../../lib/controller';
import ParamsWrapper from './ParamsWrapper';

class Printing extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool,
        connectionType: PropTypes.string,
        nozzleTemperature: PropTypes.number.isRequired,
        nozzleTargetTemperature: PropTypes.number.isRequired,
        nozzleRightTemperature: PropTypes.number,
        nozzleRightTargetTemperature: PropTypes.number,
        heatedBedTargetTemperature: PropTypes.number.isRequired,
        workflowStatus: PropTypes.string.isRequired,
        addConsoleLogs: PropTypes.func.isRequired,
        executeGcode: PropTypes.func.isRequired,
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
        onClickNozzleTemperature: (extruderIndex) => {
            controller.emitEvent(CONNECTION_NOZZLE_TEMPERATURE, {
                extruderIndex: extruderIndex,
                temperature: this.state.nozzleTemperatureValue
            });
        },
        onChangeHeatedBedTemperatureValue: (value) => {
            this.setState({
                heatedBedTemperatureValue: value
            });
        },
        onClickHeatedBedTemperature: () => {
            // controller.emitEvent(CONNECTION_BED_TEMPERATURE, {
            //     heatedBedTemperatureValue: this.state.heatedBedTemperatureValue
            // });
            this.props.executeGcode(`M140 S${this.state.heatedBedTemperatureValue}`);
        },
        onChangeZOffset: (value) => {
            this.setState({
                zOffsetValue: value
            });
        },
        onClickPlusZOffset: (extruderIndex) => {
            const zOffset = this.state.zOffsetValue;
            controller.emitEvent(CONNECTION_Z_OFFSET, {
                zOffset,
                extruderIndex,
            }).once(CONNECTION_Z_OFFSET, ({ msg }) => {
                if (msg) {
                    return;
                }
                this.props.addConsoleLogs([`Z Offset ${zOffset} ok`]);
            });
        },
        onClickMinusZOffset: (extruderIndex) => {
            const zOffset = 0 - this.state.zOffsetValue;
            controller.emitEvent(CONNECTION_Z_OFFSET, {
                zOffset,
                extruderIndex,
            }).once(CONNECTION_Z_OFFSET, ({ msg }) => {
                if (msg) {
                    return;
                }
                this.props.addConsoleLogs([`Z Offset ${zOffset} ok`]);
            });
        },
        onClickLoad: (extruderIndex) => {
            controller.emitEvent(CONNECTION_LOAD_FILAMENT, { extruderIndex: extruderIndex });
        },
        onClickUnload: (extruderIndex) => {
            controller.emitEvent(CONNECTION_UNLOAD_FILAMENT, { extruderIndex: extruderIndex });
        },

        siwtchWorkNozzle: (extruderIndex) => {
            console.log(`${CONNECTION_WORK_NOZZLE}, switch to nozzle :[${extruderIndex}]]`);
            controller.emitEvent(CONNECTION_WORK_NOZZLE, {
                extruderIndex, // RIGHT_EXTRUDER_MAP_NUMBER
            });
        },

        updateNozzleTemp: (extruderIndex, temp) => {
            // this.actions.onChangeNozzleTemperatureValue(temp);
            console.log(`${CONNECTION_NOZZLE_TEMPERATURE}, side: [${extruderIndex}], temperature: [${temp}]`);
            controller.emitEvent(CONNECTION_NOZZLE_TEMPERATURE, {
                extruderIndex, // RIGHT_EXTRUDER_MAP_NUMBER
                nozzleTemperatureValue: temp
            });
        },
        updateHeatedBedTemp: (temp) => {
            console.log(`${CONNECTION_BED_TEMPERATURE}, temperature: [${temp}]`);
            controller.emitEvent(CONNECTION_BED_TEMPERATURE, {
                heatedBedTemperatureValue: temp
            });
        },

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

    isPrinting() {
        const { workflowStatus } = this.props;
        return workflowStatus === WORKFLOW_STATUS_RUNNING || workflowStatus === WORKFLOW_STATUS_PAUSING || workflowStatus === WORKFLOW_STATUS_PAUSED;
    }

    render() {
        const {
            isConnected, heatedBedTemperature, heatedBedTargetTemperature, nozzleTemperature, nozzleTargetTemperature, currentWorkNozzle,
            printingToolhead,
            workflowStatus
        } = this.props;
        const { zOffsetMarks, zOffsetValue } = this.state;
        const actions = this.actions;

        console.log(currentWorkNozzle);
        // console.log('printingToolhead', this.props.printingToolhead);
        // const workflowStatus = 'running';
        // const printingToolhead = DUAL_EXTRUDER_TOOLHEAD_FOR_SM2;
        const nozzleTempratureTitle = i18n._(`${printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 ? 'key-Workspace/Marlin-Left Nozzle Temp' : 'key-Workspace/Marlin-Nozzle Temp'}`);
        const nozzleRightTempratureTitle = i18n._('key-Workspace/Marlin-Right Nozzle Temp');
        // console.log(isConnected, heatedBedTemperature, heatedBedTargetTemperature, nozzleTemperature, nozzleTargetTemperature, currentWorkNozzle);



        return (
            <div>
                {printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && (
                    <div>
                        <div className="sm-flex-overflow-visible justify-space-between margin-top-24 margin-bottom-16">
                            <span>{i18n._('key-Workspace/Marlin-Current Work Nozzle')}</span>
                            <span>{i18n._(`key-Workspace/Marlin-Nozzle ${currentWorkNozzle}`)}</span>
                        </div>
                        <Button onClick={() => this.actions.siwtchWorkNozzle(currentWorkNozzle === LEFT_EXTRUDER ? RIGHT_EXTRUDER_MAP_NUMBER : LEFT_EXTRUDER_MAP_NUMBER)}>
                            {i18n._('key-Workspace/Marlin-Switch working nozzle')}
                        </Button>
                        <div className="dashed-border-use-background" />
                    </div>
                )}

                <ParamsWrapper
                    handleSubmit={(value) => { console.log('update temp', value); this.actions.updateNozzleTemp(LEFT_EXTRUDER_MAP_NUMBER, value); }}
                    initValue={nozzleTargetTemperature}
                    title={nozzleTempratureTitle}
                    suffix="°C"
                >
                    <div className="width-40 sm-flex sm-flex-direction-c">
                        {/* <span>{i18n._('key-unused-{i18n._('key-Workspace/Marlin-Actual Data Title')}')}</span> */}
                        <span>{i18n._('key-Workspace/Marlin-Actual Data Title')}</span>
                        <span>{Math.floor(nozzleTemperature)}°C</span>
                    </div>
                    <div className="width-40 sm-flex sm-flex-direction-c margin-left-16">
                        {/* <span>{i18n._('key-unused-{i18n._('key-Workspace/Marlin-Target Data Title')}')}</span> */}
                        <span>{i18n._('key-Workspace/Marlin-Target Data Title')}</span>
                        <span>{Math.floor(nozzleTargetTemperature)}°C</span>
                    </div>
                </ParamsWrapper>

                {!this.isPrinting() && (
                    <div className="sm-flex justify-flex-end margin-vertical-8">
                        <div>
                            <Button
                                priority="level-three"
                                width="96px"
                                className="display-inline"
                                onClick={() => actions.onClickUnload(LEFT_EXTRUDER_MAP_NUMBER)}
                            >
                                {i18n._('key-unused-Unload')}
                            </Button>
                            <Button
                                className="margin-left-4 display-inline"
                                priority="level-three"
                                width="96px"
                                onClick={() => actions.onClickLoad(LEFT_EXTRUDER_MAP_NUMBER)}
                            >
                                {i18n._('key-unused-Load')}
                            </Button>
                        </div>
                    </div>
                )}

                {printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && (
                    <ParamsWrapper
                        handleSubmit={(value) => { console.log('update temp', value); this.actions.updateNozzleTemp(RIGHT_EXTRUDER_MAP_NUMBER, value); }}
                        initValue={this.props.nozzleRightTargetTemperature}
                        title={nozzleRightTempratureTitle}
                        suffix="°C"
                    >
                        <div className="width-40 sm-flex sm-flex-direction-c">
                            {/* <span>{i18n._('key-unused-{i18n._('key-Workspace/Marlin-Actual Data Title')}')}</span> */}
                            <span>{i18n._('key-Workspace/Marlin-Actual Data Title')}</span>
                            <span>{Math.floor(this.props.nozzleRightTemperature)}°C</span>
                        </div>
                        <div className="width-40 sm-flex sm-flex-direction-c margin-left-16">
                            {/* <span>{i18n._('key-unused-{i18n._('key-Workspace/Marlin-Target Data Title')}')}</span> */}
                            <span>{i18n._('key-Workspace/Marlin-Target Data Title')}</span>
                            <span>{Math.floor(this.props.nozzleRightTargetTemperature)}°C</span>
                        </div>
                    </ParamsWrapper>
                )}
                {printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && !this.isPrinting() && (
                    <div className="sm-flex justify-flex-end margin-vertical-8">
                        <div>
                            <Button
                                priority="level-three"
                                width="96px"
                                className="display-inline"
                                onClick={() => actions.onClickUnload(RIGHT_EXTRUDER_MAP_NUMBER)}
                            >
                                {i18n._('key-unused-Unload')}
                            </Button>
                            <Button
                                className="margin-left-4 display-inline"
                                priority="level-three"
                                width="96px"
                                onClick={() => actions.onClickLoad(RIGHT_EXTRUDER_MAP_NUMBER)}
                            >
                                {i18n._('key-unused-Load')}
                            </Button>
                        </div>
                    </div>
                )}


                <ParamsWrapper
                    handleSubmit={(value) => { console.log('update temp', value); this.actions.updateHeatedBedTemp(value); }}
                    initValue={heatedBedTargetTemperature}
                    title={i18n._('key-Workspace/Marlin-Heated Bed Temp')}
                    suffix="°C"
                >
                    <div className="width-40 sm-flex sm-flex-direction-c">
                        {/* <span>{i18n._('key-unused-{i18n._('key-Workspace/Marlin-Actual Data Title')}')}</span> */}
                        <span>{i18n._('key-Workspace/Marlin-Actual Data Title')}</span>
                        <span>{Math.floor(heatedBedTemperature)}°C</span>
                    </div>
                    <div className="width-40 sm-flex sm-flex-direction-c margin-left-16">
                        {/* <span>{i18n._('key-unused-{i18n._('key-Workspace/Marlin-Target Data Title')}')}</span> */}
                        <span>{i18n._('key-Workspace/Marlin-Target Data Title')}</span>
                        <span>{Math.floor(heatedBedTargetTemperature)}°C</span>
                    </div>
                </ParamsWrapper>

                {workflowStatus === 'running' && <WorkSpeed />}
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
                            onClick={() => actions.onClickPlusZOffset(0)}
                        />
                        <Anchor
                            className="sm-parameter-row__input2-check fa fa-minus"
                            style={{
                                right: '152px'
                            }}
                            onClick={() => actions.onClickMinusZOffset(0)}
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
        nozzleRightTemperature,
        nozzleRightTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature,
        workflowStatus,
        // toolHead: {
        //     printingToolhead
        // },
        currentWorkNozzle
    } = machine;
    // const currentWorkNozzle = 'left';
    const { toolHead: printingToolhead } = workspace;
    return {
        isConnected,
        connectionType,
        nozzleTemperature,
        nozzleTargetTemperature,
        nozzleRightTemperature,
        nozzleRightTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature,
        workflowStatus: workflowStatus || null,
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
