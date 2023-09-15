import { WorkflowStatus } from '@snapmaker/luban-platform';
import { includes } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import SocketEvent from '../../../communication/socket-events';
import { LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2 } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { controller } from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import { SnapmakerArtisanMachine } from '../../../machines';
import EditComponent from '../../components/EditComponent';
import Switch from '../../components/Switch';
import WorkSpeed from './WorkSpeed';
import AttributeContainer from './components/AttributeContainer';

const CNC: React.FC = () => {
    const { series, toolHead } = useSelector((state: RootState) => state.workspace);

    const {
        headStatus,
        workflowStatus,

        cncCurrentSpindleSpeed,
        cncTargetSpindleSpeed,
    } = useSelector((state: RootState) => state.workspace);

    const [isHeadOn, setIsHeadOn] = useState(
        toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2
            ? cncCurrentSpindleSpeed > 0
            : headStatus
    );

    const onClickToolHead = useCallback(() => {
        controller.emitEvent(SocketEvent.SwitchCNC, {
            headStatus: isHeadOn,
            speed: cncTargetSpindleSpeed,
            toolHead,
        });
        if (series !== SnapmakerArtisanMachine.identifier) {
            setIsHeadOn((prev) => !prev);
        }
    }, [isHeadOn, cncTargetSpindleSpeed, toolHead, series]);

    const updateToolHeadSpeed = useCallback((speed: number) => {
        controller.emitEvent(SocketEvent.SetSpindleSpeed, {
            speed,
        });
    }, []);

    const isPrinting = useMemo(() => {
        return includes(
            [WorkflowStatus.Running, WorkflowStatus.Pausing, WorkflowStatus.Paused],
            workflowStatus
        );
    }, [workflowStatus]);

    useEffect(() => {
        if (headStatus !== undefined && headStatus !== isHeadOn) {
            setIsHeadOn(headStatus);
        }
    }, [headStatus, isHeadOn]);

    useEffect(() => {
        if (toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2 && cncCurrentSpindleSpeed !== undefined) {
            setIsHeadOn(cncCurrentSpindleSpeed > 0);
        }
    }, [toolHead, cncCurrentSpindleSpeed]);

    const isLevelTwoCNC = toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2;

    return (
        <div>
            {isPrinting && <WorkSpeed />}
            {isPrinting && isLevelTwoCNC && (
                <AttributeContainer
                    handleSubmit={(value) => {
                        updateToolHeadSpeed(value);
                    }}
                    initValue={cncTargetSpindleSpeed}
                    title={isLevelTwoCNC ? i18n._('key-Workspace/Marlin-Spindle Speed') : i18n._('key-unused-Toolhead')}
                    suffix="rpm"
                    inputMax={18000}
                    inputMin={8000}
                >
                    <div className="width-44 sm-flex align-center margin-left-16 ">
                        <span>{cncCurrentSpindleSpeed} rpm</span>
                    </div>
                </AttributeContainer>
            )}
            {!isPrinting && (
                <div className="sm-flex-overflow-visible margin-vertical-8 justify-space-between">
                    <div className="height-32 width-176 display-inline text-overflow-ellipsis">{i18n._('key-unused-Toolhead')}</div>
                    <div className="sm-flex margin-left-24 overflow-visible align-center">
                        <Switch
                            className="sm-flex-auto"
                            style={{ order: 0 }}
                            onClick={onClickToolHead}
                            checked={headStatus}
                            disabled={isPrinting}
                        />

                        {/* //  <div className="sm-flex align-center"> */}
                        {isLevelTwoCNC && (
                            <div className=" sm-flex sm-flex-direction-c  margin-right-16  margin-left-16">
                                <span>{cncTargetSpindleSpeed}rpm</span>
                            </div>
                        )}
                        {isLevelTwoCNC && (
                            <EditComponent
                                handleSubmit={(value) => {
                                    updateToolHeadSpeed(value);
                                }}
                                initValue={cncTargetSpindleSpeed}
                                suffix="rpm"
                                inputMax={18000}
                                inputMin={8000}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CNC;
