import { WorkflowStatus } from '@snapmaker/luban-platform';
import _, { includes } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { controller } from '../../../communication/socket-communication';
import SocketEvent from '../../../communication/socket-events';
import { LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2, STANDARD_CNC_TOOLHEAD_FOR_SM2 } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { actions as workspaceActions } from '../../../flux/workspace';
import i18n from '../../../lib/i18n';
import EditComponent from '../../components/EditComponent';
import Switch from '../../components/Switch';
import WorkSpeed from './WorkSpeed';
import AttributeContainer from './components/AttributeContainer';
import { SnapmakerA150Machine, SnapmakerA250Machine, SnapmakerA350Machine } from '../../../machines';

const CNC: React.FC = () => {
    const { toolHead } = useSelector((state: RootState) => state.workspace);
    const dispatch = useDispatch();

    const {
        headStatus,
        workflowStatus,

        cncCurrentSpindleSpeed,
        cncTargetSpindleSpeed,
        activeMachine
    } = useSelector((state: RootState) => state.workspace);

    const [isHeadOn, setIsHeadOn] = useState(
        toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2
            ? cncCurrentSpindleSpeed > 0
            : headStatus
    );
    const [switchLoading, setSwitchLoading] = useState(false);

    const isConnectedSnapmake2 = useCallback(() => _.includes(
        [SnapmakerA350Machine.identifier, SnapmakerA250Machine.identifier, SnapmakerA150Machine.identifier],
        activeMachine.identifier
    ), [activeMachine]);
    let timeRef = null;
    const onClickToolHead = useCallback(() => {
        let speed = null;
        if (toolHead === STANDARD_CNC_TOOLHEAD_FOR_SM2 || (toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2 && isConnectedSnapmake2())) {
            // standard
            speed = (cncTargetSpindleSpeed && cncTargetSpindleSpeed > 8000) ? cncTargetSpindleSpeed : 8000;
        } else {
            speed = cncTargetSpindleSpeed;
        }
        controller.emitEvent(SocketEvent.SwitchCNC, {
            headStatus: isHeadOn,
            speed,
            toolHead,
        });

        clearTimeout(timeRef);
        setSwitchLoading(true);
        timeRef = setTimeout(() => setSwitchLoading(false), 3000);
    }, [isHeadOn, cncTargetSpindleSpeed, toolHead]);

    const updateToolHeadSpeed = useCallback((speed: number) => {
        // Technically, cncTargetSpindleSpeed should be obtained from the backend,
        // but here, to compensate for the 2nd generation serial
        // port protocol not supporting this target rotation speed.
        // so we mock a value from the front-end
        isConnectedSnapmake2() && dispatch(workspaceActions.updateState({ cncTargetSpindleSpeed: speed }));

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
        if (cncCurrentSpindleSpeed !== undefined) {
            setIsHeadOn(cncCurrentSpindleSpeed > 0);
        }
    }, [toolHead, cncCurrentSpindleSpeed]);

    const isLevelTwoCNC = toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2;

    return (
        <div>
            {isPrinting && <WorkSpeed />}
            {
                isPrinting && isLevelTwoCNC && (
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
                            <span>{cncCurrentSpindleSpeed} RPM</span>
                        </div>
                    </AttributeContainer>
                )
            }
            {
                !isPrinting && (
                    <div className="sm-flex-overflow-visible margin-vertical-8 justify-space-between">
                        <div className="height-32 width-176 display-inline text-overflow-ellipsis">{i18n._('key-unused-Toolhead')}</div>
                        <div className="sm-flex margin-left-24 overflow-visible align-center">
                            <Switch
                                loading={switchLoading}
                                className="sm-flex-auto"
                                style={{ order: 0 }}
                                onClick={onClickToolHead}
                                checked={isHeadOn}
                                disabled={isPrinting}
                            />

                            {/* //  <div className="sm-flex align-center"> */}
                            {isLevelTwoCNC && (
                                <div className=" sm-flex sm-flex-direction-c  margin-right-16  margin-left-16">
                                    <span>{cncCurrentSpindleSpeed} RPM</span>
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
                )
            }
        </div>
    );
};

export default CNC;
