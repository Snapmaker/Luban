import { Space } from 'antd';
import { capitalize } from 'lodash';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import {
    CONNECTION_BED_TEMPERATURE,
    CONNECTION_LOAD_FILAMENT,
    CONNECTION_NOZZLE_TEMPERATURE,
    CONNECTION_UNLOAD_FILAMENT,
    CONNECTION_WORK_NOZZLE,
    CONNECTION_Z_OFFSET,
    LEFT_EXTRUDER_MAP_NUMBER,
    RIGHT_EXTRUDER_MAP_NUMBER,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_PAUSING,
    WORKFLOW_STATUS_RUNNING,
} from '../../../constants';
import { isDualExtruder } from '../../../constants/machines';
import { actions as workspaceActions } from '../../../flux/workspace';
import { controller } from '../../../lib/controller';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import JogDistance from './JogDistance';
import ParamsWrapper from './ParamsWrapper';
import WorkSpeed from './WorkSpeed';

class Printing extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool,
        // connectionType: PropTypes.string,
        nozzleTemperature: PropTypes.number,
        nozzleTargetTemperature: PropTypes.number,

        nozzleTemperature1: PropTypes.number.isRequired,
        nozzleTargetTemperature1: PropTypes.number.isRequired,

        nozzleTemperature2: PropTypes.number.isRequired,
        nozzleTargetTemperature2: PropTypes.number.isRequired,

        nozzleRightTemperature: PropTypes.number,
        nozzleRightTargetTemperature: PropTypes.number,

        heatedBedTargetTemperature: PropTypes.number.isRequired,
        workflowStatus: PropTypes.string.isRequired,
        addConsoleLogs: PropTypes.func.isRequired,
        heatedBedTemperature: PropTypes.number.isRequired,
        printingToolhead: PropTypes.string.isRequired,
        currentWorkNozzle: PropTypes.string.isRequired
    };

    state = {
        nozzleTemperatureValue: this.props.nozzleTargetTemperature,
        heatedBedTemperatureValue: this.props.heatedBedTargetTemperature,
        leftZOffsetValue: 0.05,
        rightZOffsetValue: 0.05,
        squeezing: false,
        zOffsetMarks: [0.05, 0.1, 0.2]
    };

    actions = {
        onChangeNozzleTemperatureValue: (value) => {
            this.setState({
                nozzleTemperatureValue: value
            });
        },
        onClickNozzleTemperature: (extruderIndex) => {
            controller.emitEvent(CONNECTION_NOZZLE_TEMPERATURE, {
                extruderIndex: extruderIndex,
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
        onChangeLeftZOffset: (value) => {
            this.setState({
                leftZOffsetValue: value
            });
        },
        onChangeRightZOffset: (value) => {
            this.setState({
                rightZOffsetValue: value
            });
        },
        onClickPlusZOffset: (extruderIndex) => {
            const zOffset = extruderIndex === RIGHT_EXTRUDER_MAP_NUMBER ? this.state.rightZOffsetValue : this.state.leftZOffsetValue;
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
            const zOffset = 0 - (extruderIndex === RIGHT_EXTRUDER_MAP_NUMBER ? this.state.rightZOffsetValue : this.state.leftZOffsetValue);
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
            this.setState({
                squeezing: true
            });
            controller.emitEvent(CONNECTION_LOAD_FILAMENT, {
                extruderIndex: extruderIndex
            }).once(CONNECTION_LOAD_FILAMENT, () => {
                this.setState({
                    squeezing: false
                });
            });
        },
        onClickUnload: (extruderIndex) => {
            this.setState({
                squeezing: true
            });
            controller.emitEvent(CONNECTION_UNLOAD_FILAMENT, {
                extruderIndex: extruderIndex
            }).once(CONNECTION_UNLOAD_FILAMENT, () => {
                this.setState({
                    squeezing: false
                });
            });
        },

        siwtchWorkNozzle: (extruderIndex) => {
            controller.emitEvent(CONNECTION_WORK_NOZZLE, {
                extruderIndex, // RIGHT_EXTRUDER_MAP_NUMBER
            });
        },

        updateNozzleTemp: (extruderIndex, temp) => {
            controller.emitEvent(CONNECTION_NOZZLE_TEMPERATURE, {
                extruderIndex, // RIGHT_EXTRUDER_MAP_NUMBER
                nozzleTemperatureValue: temp
            });
        },
        updateHeatedBedTemp: (temp) => {
            // console.log(`${CONNECTION_BED_TEMPERATURE}, temperature: [${temp}]`);
            controller.emitEvent(CONNECTION_BED_TEMPERATURE, {
                heatedBedTemperatureValue: temp
            });
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

    isPrinting() {
        const { workflowStatus } = this.props;
        return workflowStatus === WORKFLOW_STATUS_RUNNING || workflowStatus === WORKFLOW_STATUS_PAUSING || workflowStatus === WORKFLOW_STATUS_PAUSED;
    }

    isPausingOrPrinting() {
        const { workflowStatus } = this.props;
        return workflowStatus === WORKFLOW_STATUS_RUNNING || workflowStatus === WORKFLOW_STATUS_PAUSING;
    }

    render() {
        const {
            isConnected,

            heatedBedTemperature,
            heatedBedTargetTemperature,

            nozzleTemperature,
            nozzleTargetTemperature,

            nozzleTemperature1,
            nozzleTemperature2,

            nozzleTargetTemperature1,
            nozzleTargetTemperature2,

            nozzleRightTemperature,
            nozzleRightTargetTemperature,

            currentWorkNozzle,
            printingToolhead,
            workflowStatus
        } = this.props;

        const leftNozzleTemperature = nozzleTemperature || nozzleTemperature1;
        const leftNozzleTargetTemperature = nozzleTargetTemperature || nozzleTargetTemperature1;

        const rightNozzleTemperature = nozzleRightTemperature || nozzleTemperature2;
        const rightNozzleTargetTemperature = nozzleRightTargetTemperature || nozzleTargetTemperature2;

        const leftNozzleReady = leftNozzleTargetTemperature && (leftNozzleTemperature - leftNozzleTargetTemperature >= -5);
        const rightNozzleReady = rightNozzleTargetTemperature && (rightNozzleTemperature - rightNozzleTargetTemperature >= -5);

        const { zOffsetMarks, leftZOffsetValue } = this.state;
        const actions = this.actions;

        const isDual = isDualExtruder(printingToolhead);

        const uiConfig = {
            nozzleTempDisplay: !isDual,
            leftNozzleTempDisplay: isDual,
            leftNozzleTempEditable: !isDual,
            rightNozzleTempDisplay: isDual,
            rightNozzleTempEditable: !isDual,
            bedTempDisplay: true,
            bedTempEditable: !isDual,
        };

        return (
            <div>
                {/* Nozzle switch */
                    isDual && (
                        <div>
                            <div className="sm-flex justify-space-between">
                                <span>{i18n._('key-unused-Current Work Nozzle')}</span>
                                <span>{i18n._(`key-setting/${capitalize(currentWorkNozzle)}-Nozzle`)}</span>
                            </div>
                            {/*
                            <Button disabled={this.state.squeezing || workflowStatus === WORKFLOW_STATUS_RUNNING} onClick={() => this.actions.siwtchWorkNozzle(currentWorkNozzle === LEFT_EXTRUDER ? RIGHT_EXTRUDER_MAP_NUMBER : LEFT_EXTRUDER_MAP_NUMBER)}>
                                {i18n._('key-Workspace/Marlin-Switch working nozzle')}
                            </Button>
                            */}
                            <div className="dashed-border-use-background" />
                        </div>
                    )
                }
                {
                    uiConfig.nozzleTempDisplay && (
                        <ParamsWrapper
                            handleSubmit={(value) => {
                                this.actions.updateNozzleTemp(LEFT_EXTRUDER_MAP_NUMBER, value);
                            }}
                            initValue={nozzleTargetTemperature}
                            title={i18n._('key-Workspace/Connection-Nozzle Temp.')}
                            suffix="°C"
                        >
                            <div className="width-44 sm-flex sm-flex-direction-c">
                                <span>{i18n._('key-Workspace/Marlin-Actual Data Title')}</span>
                                <span>{Math.floor(leftNozzleTemperature)}°C</span>
                            </div>
                            <div className="width-44 sm-flex sm-flex-direction-c margin-left-16">
                                <span>{i18n._('key-Workspace/Marlin-Target Data Title')}</span>
                                <span>{Math.floor(leftNozzleTargetTemperature)}°C</span>
                            </div>
                        </ParamsWrapper>
                    )
                }
                {
                    uiConfig.leftNozzleTempDisplay && (
                        <ParamsWrapper
                            editable={uiConfig.leftNozzleTempEditable}
                            handleSubmit={(value) => {
                                this.actions.updateNozzleTemp(LEFT_EXTRUDER_MAP_NUMBER, value);
                            }}
                            initValue={nozzleTargetTemperature}
                            title={i18n._('key-Workspace/Marlin-Left Nozzle Temp')}
                            suffix="°C"
                        >
                            <div className="width-44 sm-flex sm-flex-direction-c">
                                <span>{i18n._('key-Workspace/Marlin-Actual Data Title')}</span>
                                <span>{Math.floor(leftNozzleTemperature)}°C</span>
                            </div>
                            <div className="width-44 sm-flex sm-flex-direction-c margin-left-16">
                                <span>{i18n._('key-Workspace/Marlin-Target Data Title')}</span>
                                <span>{Math.floor(leftNozzleTargetTemperature)}°C</span>
                            </div>
                        </ParamsWrapper>
                    )
                }

                {
                    uiConfig.leftNozzleTempDisplay && uiConfig.leftNozzleTempEditable && !this.isPausingOrPrinting() && (
                        <div className="sm-flex justify-flex-end margin-vertical-8">
                            <div>
                                <Button
                                    priority="level-three"
                                    width="96px"
                                    className="display-inline"
                                    disabled={this.state.squeezing || !leftNozzleReady}
                                    onClick={() => actions.onClickUnload(LEFT_EXTRUDER_MAP_NUMBER)}
                                >
                                    {i18n._('key-unused-Unload')}
                                </Button>
                                <Button
                                    className="margin-left-4 display-inline"
                                    priority="level-three"
                                    width="96px"
                                    disabled={this.state.squeezing || !leftNozzleReady}
                                    onClick={() => actions.onClickLoad(LEFT_EXTRUDER_MAP_NUMBER)}
                                >
                                    {i18n._('key-unused-Load')}
                                </Button>
                            </div>
                        </div>
                    )
                }

                {
                    uiConfig.rightNozzleTempDisplay && (
                        <ParamsWrapper
                            editable={uiConfig.rightNozzleTempEditable}
                            handleSubmit={(value) => {
                                this.actions.updateNozzleTemp(RIGHT_EXTRUDER_MAP_NUMBER, value);
                            }}
                            initValue={rightNozzleTemperature}
                            title={i18n._('key-Workspace/Marlin-Right Nozzle Temp')}
                            suffix="°C"
                        >
                            <div className="width-44 sm-flex sm-flex-direction-c">
                                <span>{i18n._('key-Workspace/Marlin-Actual Data Title')}</span>
                                <span>{Math.floor(rightNozzleTemperature)}°C</span>
                            </div>
                            <div className="width-44 sm-flex sm-flex-direction-c margin-left-16">
                                <span>{i18n._('key-Workspace/Marlin-Target Data Title')}</span>
                                <span>{Math.floor(rightNozzleTargetTemperature)}°C</span>
                            </div>
                        </ParamsWrapper>
                    )
                }
                {
                    uiConfig.rightNozzleTempDisplay && uiConfig.rightNozzleTempEditable && !this.isPausingOrPrinting() && (
                        <div className="sm-flex justify-flex-end margin-vertical-8">
                            <div>
                                <Button
                                    priority="level-three"
                                    width="96px"
                                    className="display-inline"
                                    disabled={this.state.squeezing || !rightNozzleReady}
                                    onClick={() => actions.onClickUnload(RIGHT_EXTRUDER_MAP_NUMBER)}
                                >
                                    {i18n._('key-unused-Unload')}
                                </Button>
                                <Button
                                    className="margin-left-4 display-inline"
                                    priority="level-three"
                                    width="96px"
                                    disabled={this.state.squeezing || !rightNozzleReady}
                                    onClick={() => actions.onClickLoad(RIGHT_EXTRUDER_MAP_NUMBER)}
                                >
                                    {i18n._('key-unused-Load')}
                                </Button>
                            </div>
                        </div>
                    )
                }


                {
                    uiConfig.bedTempDisplay && (
                        <ParamsWrapper
                            editable={uiConfig.bedTempEditable}
                            handleSubmit={(value) => {
                                this.actions.updateHeatedBedTemp(value);
                            }}
                            initValue={heatedBedTargetTemperature}
                            title={i18n._('key-Workspace/Marlin-Heated Bed Temp')}
                            suffix="°C"
                        >
                            <div className="width-44 sm-flex sm-flex-direction-c">
                                <span>{i18n._('key-Workspace/Marlin-Actual Data Title')}</span>
                                <span>{Math.floor(heatedBedTemperature)}°C</span>
                            </div>
                            <div className="width-44 sm-flex sm-flex-direction-c margin-left-16">
                                <span>{i18n._('key-Workspace/Marlin-Target Data Title')}</span>
                                <span>{Math.floor(heatedBedTargetTemperature)}°C</span>
                            </div>
                        </ParamsWrapper>
                    )
                }

                {workflowStatus === 'running' && <WorkSpeed />}

                {/* Adjust left extruder Z offset, note that z offset for dual extruders are not supported */}
                {isConnected && this.isPrinting() && !isDualExtruder(printingToolhead) && (
                    <div className="sm-flex-overflow-visible margin-vertical-8 justify-space-between">
                        <span className="display-inline-block height-32 sm-parameter-row__label">{i18n._('key-unused-Left Z Offset')}</span>
                        <Space size={8}>
                            <div className="height-32">
                                <Anchor
                                    className="fa fa-plus"
                                    onClick={() => actions.onClickPlusZOffset(LEFT_EXTRUDER_MAP_NUMBER)}
                                />
                            </div>
                            <JogDistance
                                marks={zOffsetMarks}
                                onChange={actions.onChangeLeftZOffset}
                                defaultValue={leftZOffsetValue}
                            />
                            <div className="height-32">
                                <Anchor
                                    className="fa fa-minus"
                                    onClick={() => actions.onClickMinusZOffset(LEFT_EXTRUDER_MAP_NUMBER)}
                                />
                            </div>
                        </Space>
                    </div>
                )}
                {/*
                {isConnected && this.isPrinting() && isDualExtruder(printingToolhead) && (
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label">{i18n._('key-unused-Right Z Offset')}</span>
                        <Anchor
                            className="sm-parameter-row__input2"
                            style={{
                                marginRight: '84px'
                            }}
                        >
                            <JogDistance
                                marks={zOffsetMarks}
                                onChange={actions.onChangeRightZOffset}
                                defaultValue={rightZOffsetValue}
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
                */}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const workspace = state.workspace;
    const {
        isConnected,
        connectionType,
        nozzleTemperature,
        nozzleTargetTemperature,

        nozzleTemperature1,
        nozzleTemperature2,

        nozzleTargetTemperature1,
        nozzleTargetTemperature2,

        nozzleRightTemperature,
        nozzleRightTargetTemperature,

        heatedBedTemperature,
        heatedBedTargetTemperature,
        workflowStatus,
        currentWorkNozzle
    } = workspace;

    const { toolHead: printingToolhead } = workspace;

    return {
        isConnected,
        connectionType,
        nozzleTemperature,
        nozzleTargetTemperature,

        nozzleTemperature1,
        nozzleTemperature2,

        nozzleTargetTemperature1,
        nozzleTargetTemperature2,

        nozzleRightTemperature,
        nozzleRightTargetTemperature,
        heatedBedTemperature,
        heatedBedTargetTemperature,
        workflowStatus,
        printingToolhead,
        currentWorkNozzle
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        addConsoleLogs: (gcode, context) => dispatch(workspaceActions.addConsoleLogs(gcode, context)),
        executeGcode: (gcode, context, cmd) => dispatch(workspaceActions.executeGcode(gcode, context, cmd))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
