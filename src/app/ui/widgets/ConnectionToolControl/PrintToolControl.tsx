import { WorkflowStatus } from '@snapmaker/luban-platform';
import { Space } from 'antd';
import { capitalize } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import SocketEvent from '../../../communication/socket-events';
import {
    LEFT_EXTRUDER,
    LEFT_EXTRUDER_MAP_NUMBER,
    RIGHT_EXTRUDER_MAP_NUMBER
} from '../../../constants';
import { isDualExtruder } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { actions as workspaceActions } from '../../../flux/workspace';
import { controller } from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import { machine as SnapmakerJ1Machine } from '../../../machines/snapmaker-j1';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import JogDistance from './JogDistance';
import WorkSpeed from './WorkSpeed';
import AttributeContainer from './components/AttributeContainer';


const PrintToolControl: React.FC = () => {
    const { isConnected } = useSelector((state: RootState) => state.workspace);

    const {
        toolHead: toolIdentifer,
    } = useSelector((state: RootState) => state.workspace);

    const machineIdentifier = useSelector((state: RootState) => state.workspace.machineIdentifier);

    const isDual = isDualExtruder(toolIdentifer);

    const {
        workflowStatus,

        // nozzle
        nozzleTemperature,
        nozzleTargetTemperature,

        nozzleTemperature1,
        nozzleTemperature2,

        nozzleTargetTemperature1,
        nozzleTargetTemperature2,

        nozzleRightTemperature,
        nozzleRightTargetTemperature,
    } = useSelector((state: RootState) => state.workspace, shallowEqual);


    // heated bed
    const {
        heatedBedTemperature,
        heatedBedTargetTemperature,
    } = useSelector((state: RootState) => state.workspace);

    const setHeatedBedTemperature = useCallback((temp) => {
        controller.emitEvent(SocketEvent.SetBedTemperature, {
            heatedBedTemperatureValue: temp
        });
    }, []);

    // active nozzle
    const {
        currentWorkNozzle,
    } = useSelector((state: RootState) => state.workspace);

    /**
     * Switch to another work nozzle.
     */
    const switchWorkNozzle = useCallback(() => {
        let extruderIndex = LEFT_EXTRUDER_MAP_NUMBER;
        if (currentWorkNozzle === LEFT_EXTRUDER) {
            extruderIndex = RIGHT_EXTRUDER_MAP_NUMBER;
        } else {
            extruderIndex = LEFT_EXTRUDER_MAP_NUMBER;
        }
        controller.emitEvent(SocketEvent.SwitchActiveExtruder, {
            extruderIndex,
        });
    }, [currentWorkNozzle]);

    const [leftZOffsetValue, setLeftZOffsetValue] = useState(0.05);
    const [rightZOffsetValue, setRightZOffsetValue] = useState(0.05);

    const [squeezing, setSqueezing] = useState(false);

    const zOffsetMarks = [0.05, 0.1, 0.2];

    const dispatch = useDispatch();

    const addConsoleLogs = useCallback((gcode: string[]) => {
        dispatch(workspaceActions.addConsoleLogs(gcode));
    }, [dispatch]);

    // const nozzleTemperatureValue = useState(nozzleTargetTemperature);
    const actions = {
        onChangeLeftZOffset: (value) => {
            setLeftZOffsetValue(value);
        },
        onChangeRightZOffset: (value) => {
            setRightZOffsetValue(value);
        },
        onClickPlusZOffset: (extruderIndex) => {
            const zOffset = extruderIndex === RIGHT_EXTRUDER_MAP_NUMBER ? rightZOffsetValue : leftZOffsetValue;
            controller
                .emitEvent(SocketEvent.SetZOffset, {
                    zOffset,
                    extruderIndex,
                })
                .once(SocketEvent.SetZOffset, ({ msg }) => {
                    if (msg) {
                        return;
                    }
                    addConsoleLogs([`Z Offset ${zOffset} ok`]);
                });
        },
        onClickMinusZOffset: (extruderIndex) => {
            const zOffset = 0 - (extruderIndex === RIGHT_EXTRUDER_MAP_NUMBER ? rightZOffsetValue : leftZOffsetValue);
            controller
                .emitEvent(SocketEvent.SetZOffset, {
                    zOffset,
                    extruderIndex,
                })
                .once(SocketEvent.SetZOffset, ({ msg }) => {
                    if (msg) {
                        return;
                    }
                    addConsoleLogs([`Z Offset ${zOffset} ok`]);
                });
        },
        onClickLoad: (extruderIndex) => {
            setSqueezing(true);
            controller.emitEvent(SocketEvent.LoadFilament, {
                extruderIndex: extruderIndex
            }).once(SocketEvent.LoadFilament, () => {
                setSqueezing(false);
            });
        },
        onClickUnload: (extruderIndex) => {
            setSqueezing(true);
            controller.emitEvent(SocketEvent.UnloadFilamnet, {
                extruderIndex: extruderIndex
            }).once(SocketEvent.UnloadFilamnet, () => {
                setSqueezing(false);
            });
        },

        updateNozzleTemp: (extruderIndex, temp) => {
            controller.emitEvent(SocketEvent.SetExtruderTemperature, {
                extruderIndex, // RIGHT_EXTRUDER_MAP_NUMBER
                nozzleTemperatureValue: temp
            });
        },
    };


    const isPrinting = () => {
        return workflowStatus === WorkflowStatus.Running
            || workflowStatus === WorkflowStatus.Pausing
            || workflowStatus === WorkflowStatus.Paused;
    };

    const isPausingOrPrinting = () => {
        return workflowStatus === WorkflowStatus.Running
            || workflowStatus === WorkflowStatus.Pausing;
    };

    const leftNozzleTemperature = nozzleTemperature || nozzleTemperature1;
    const leftNozzleTargetTemperature = nozzleTargetTemperature || nozzleTargetTemperature1;

    const rightNozzleTemperature = nozzleRightTemperature || nozzleTemperature2;
    const rightNozzleTargetTemperature = nozzleRightTargetTemperature || nozzleTargetTemperature2;

    const leftNozzleReady = leftNozzleTargetTemperature && (leftNozzleTemperature - leftNozzleTargetTemperature >= -5);
    const rightNozzleReady = rightNozzleTargetTemperature && (rightNozzleTemperature - rightNozzleTargetTemperature >= -5);

    const j1Disabled = machineIdentifier === SnapmakerJ1Machine.identifier;

    const uiConfig = useMemo(() => ({
        activeNozzle: isDual && !j1Disabled,

        nozzleTempDisplay: !isDual,

        leftNozzleTempDisplay: isDual,
        leftNozzleTempEditable: true,
        rightNozzleTempDisplay: isDual,
        rightNozzleTempEditable: true,

        bedTempDisplay: true,
        bedTempEditable: true,
    }), [isDual]);

    const renderActiveNozzle = useCallback(() => {
        if (!uiConfig.activeNozzle) {
            return null;
        }

        return (
            <div className="margin-bottom-8">
                <div className="sm-flex justify-space-between margin-bottom-8">
                    <span>{i18n._('key-unused-Current Work Nozzle')}</span>
                    <span>{i18n._(`key-setting/${capitalize(currentWorkNozzle)}-Nozzle`)}</span>
                </div>
                <Button
                    type="default"
                    disabled={squeezing || workflowStatus === WorkflowStatus.Running}
                    onClick={switchWorkNozzle}
                >
                    {i18n._('key-Workspace/Marlin-Switch working nozzle')}
                </Button>
            </div>
        );
    }, [
        workflowStatus, squeezing, uiConfig,
        currentWorkNozzle, switchWorkNozzle
    ]);

    return (
        <div>
            {renderActiveNozzle()}
            {
                uiConfig.nozzleTempDisplay && (
                    <AttributeContainer
                        handleSubmit={(value) => {
                            actions.updateNozzleTemp(LEFT_EXTRUDER_MAP_NUMBER, value);
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
                    </AttributeContainer>
                )
            }
            {
                uiConfig.nozzleTempDisplay && !isPausingOrPrinting() && (
                    <div className="sm-flex justify-flex-end margin-vertical-8">
                        <div>
                            <Button
                                type="default"
                                priority="level-three"
                                width="96px"
                                className="display-inline"
                                disabled={squeezing || !leftNozzleReady}
                                onClick={() => actions.onClickUnload(LEFT_EXTRUDER_MAP_NUMBER)}
                            >
                                {i18n._('key-unused-Unload')}
                            </Button>
                            <Button
                                type="default"
                                className="margin-left-4 display-inline"
                                priority="level-three"
                                width="96px"
                                disabled={squeezing || !leftNozzleReady}
                                onClick={() => actions.onClickLoad(LEFT_EXTRUDER_MAP_NUMBER)}
                            >
                                {i18n._('key-unused-Load')}
                            </Button>
                        </div>
                    </div>
                )
            }

            {
                uiConfig.leftNozzleTempDisplay && (
                    <AttributeContainer
                        editable={uiConfig.leftNozzleTempEditable}
                        handleSubmit={(value) => {
                            actions.updateNozzleTemp(LEFT_EXTRUDER_MAP_NUMBER, value);
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
                    </AttributeContainer>
                )
            }

            {
                uiConfig.leftNozzleTempDisplay && uiConfig.leftNozzleTempEditable && !j1Disabled && !isPausingOrPrinting() && (
                    <div className="sm-flex justify-flex-end margin-vertical-8">
                        <div>
                            <Button
                                type="default"
                                priority="level-three"
                                width="96px"
                                className="display-inline"
                                disabled={squeezing || !leftNozzleReady}
                                onClick={() => actions.onClickUnload(LEFT_EXTRUDER_MAP_NUMBER)}
                            >
                                {i18n._('key-unused-Unload')}
                            </Button>
                            <Button
                                type="default"
                                className="margin-left-4 display-inline"
                                priority="level-three"
                                width="96px"
                                disabled={squeezing || !leftNozzleReady}
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
                    <AttributeContainer
                        editable={uiConfig.rightNozzleTempEditable}
                        handleSubmit={(value) => {
                            actions.updateNozzleTemp(RIGHT_EXTRUDER_MAP_NUMBER, value);
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
                    </AttributeContainer>
                )
            }
            {
                uiConfig.rightNozzleTempDisplay && uiConfig.rightNozzleTempEditable && !j1Disabled && !isPausingOrPrinting() && (
                    <div className="sm-flex justify-flex-end margin-vertical-8">
                        <div>
                            <Button
                                type="default"
                                priority="level-three"
                                width="96px"
                                className="display-inline"
                                disabled={squeezing || !rightNozzleReady}
                                onClick={() => actions.onClickUnload(RIGHT_EXTRUDER_MAP_NUMBER)}
                            >
                                {i18n._('key-unused-Unload')}
                            </Button>
                            <Button
                                type="default"
                                className="margin-left-4 display-inline"
                                priority="level-three"
                                width="96px"
                                disabled={squeezing || !rightNozzleReady}
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
                    <AttributeContainer
                        editable={uiConfig.bedTempEditable}
                        handleSubmit={(value) => {
                            setHeatedBedTemperature(value);
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
                    </AttributeContainer>
                )
            }

            {workflowStatus === 'running' && <WorkSpeed />}

            {/* Adjust left extruder Z offset, note that z offset for dual extruders are not supported */}
            {isConnected && isPrinting() && !isDual && (
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
                {isConnected && isPrinting() && isDualExtruder(printingToolhead) && (
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
};

export default PrintToolControl;
