import { Machine, MachineType, WorkflowStatus } from '@snapmaker/luban-platform';
import { Alert, Progress, Space } from 'antd';
import { includes } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { RootState } from '../../../flux/index.def';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { Button } from '../../components/Buttons';
import SvgIcon from '../../components/SvgIcon';
import { formatDuration } from '../GCode/GCode';
import Loading from './Loading';
import StopJobConfirmModal from './modals/StopJobConfirmModal';
import { SnapmakerRayMachine } from '../../../machines';

const COMPLETE_STATUS = 'Complete';

interface TextProps {
    name: string;
    value: string;
}

const Text: React.FC<TextProps> = ({ name, value }) => {
    return (
        <div className="margin-top-8 sm-flex align-c">
            <span className="unit-text margin-right-8 text-overflow-ellipsis display-inline align-l">{name}</span>
            <span className="main-text-normal text-overflow-ellipsis display-inline width-112 align-l">{value}</span>
        </div>
    );
};

interface JobStatusViewProps {
    controlActions: object;
    setDisplay: (display: boolean) => void;
}

const JobStatusView: React.FC<JobStatusViewProps> = (props) => {
    const { controlActions, setDisplay } = props;

    const activeMachine: Machine = useSelector((state: RootState) => state.machine.activeMachine);

    const {
        isConnected,
        workflowStatus,
        gcodePrintingInfo: { progress, elapsedTime, remainingTime, total, sent, printStatus },
        gcodeFileName
    } = useSelector((state: RootState) => state.workspace);
    const fileName = gcodeFileName;
    const [isPausing, setIsPausing] = useState(false);
    const [showStopComfirmModal, setShowStopComfirmModal] = useState(false);


    // Whether can control machine workflow
    const canControlWorkflow = useMemo(() => {
        if (activeMachine && activeMachine.machineType === MachineType.Laser) {
            return true;
            // return !(activeMachine.metadata as LaserMachineMetadata).disableWorkflowControl;
        }

        return true;
    }, [activeMachine]);


    useEffect(() => {
        const isWorking = includes([
            WorkflowStatus.Running, WorkflowStatus.Pausing, WorkflowStatus.Paused, WorkflowStatus.Stopping, WorkflowStatus.Resuming
        ], workflowStatus);

        if (
            isConnected && (isWorking || (total > 0 && sent >= total))
        ) {
            setDisplay(true);
        } else {
            setDisplay(false);
        }
    }, [setDisplay, isConnected, workflowStatus, sent, total]);

    useEffect(() => {
        if (workflowStatus !== WorkflowStatus.Pausing && workflowStatus !== WorkflowStatus.Resuming) {
            setIsPausing(false);
        } else {
            setIsPausing(true);
        }
    }, [workflowStatus]);


    const handleMachine = (type) => {
        try {
            switch (type) {
                case 'run':
                    setIsPausing(true);
                    controlActions.onCallBackRun();
                    break;
                case 'pause':
                    setIsPausing(true);
                    controlActions.onCallBackPause();
                    break;
                case 'stop':
                    setShowStopComfirmModal(true);
                    // controlActions.onCallBackStop();
                    break;
                default:
                    break;
            }
        } catch (e) {
            log.error(e);
            setIsPausing(false);
        }
    };
    let actualProgress = 0;
    if (printStatus === COMPLETE_STATUS) {
        actualProgress = 100;
    } else {
        actualProgress = Math.floor(progress ? progress * 100 : (sent / total) * 100) - 1;
    }

    return (
        <div>
            <div className="sm-flex justify-space-between align-center margin-top-8">
                <div>
                    <Text name={i18n._('key-Workspace/Workprogress-File')} value={fileName || i18n._('key-Workspace/Workprogress-Unknow')} />
                    <Text name={i18n._('key-Workspace/Workprogress-Elapsed Time')} value={formatDuration(elapsedTime, false)} />
                    <Text name={i18n._('key-Workspace/Workprogress-Remaining Time')} value={formatDuration(remainingTime, false)} />
                    <Text name={i18n._('key-Workspace/Workprogress-GCode Line')} value={`${sent} / ${total}`} />
                </div>
                <Progress percent={actualProgress} type="circle" width={88} />
            </div>
            {
                canControlWorkflow && printStatus !== COMPLETE_STATUS && (
                    <div className="sm-flex justify-space-between align-center margin-top-16">
                        <Button
                            width="160px"
                            type="default"
                            onClick={() => handleMachine(workflowStatus === 'running' ? 'pause' : 'run')}
                        >
                            {
                                !isPausing && (
                                    <SvgIcon
                                        // TODO: pause translation animation
                                        name={workflowStatus === 'running' ? 'WorkspaceSuspend' : 'WorkspacePlay'}
                                        type={['static']}
                                        color={workflowStatus === 'running' ? '#FFA940' : '#4CB518'}
                                    />
                                )
                            }
                            {
                                isPausing && (
                                    <Loading
                                        style={{ color: '#B9BCBF', position: 'relative', top: -3, marginRight: 4 }}
                                        className="margin-right-4"
                                    />
                                )
                            }
                            <span className="height-24">{(workflowStatus === WorkflowStatus.Running || workflowStatus === WorkflowStatus.Pausing) ? i18n._('key-Workspace/WorkflowControl-Pause') : i18n._('key-Workspace/WorkflowControl-Run')}</span>
                        </Button>
                        <Button width="160px" type="default" onClick={() => handleMachine('stop')}>
                            <SvgIcon
                                name="WorkspaceStop"
                                type={['static']}
                                color="#FF4D4F"
                            />
                            <span className="height-24">{i18n._('key-Workspace/WorkflowControl-Stop')}</span>
                        </Button>
                    </div>
                )
            }
            {
                activeMachine && activeMachine.identifier === SnapmakerRayMachine.identifier && (
                    <div className="margin-top-8">
                        <Space direction="vertical">
                            <Alert
                                type="warning"
                                showIcon
                                message={i18n._('Keep the device attended while it is in use!')}
                            />
                            <Alert
                                type="info"
                                showIcon
                                message={i18n._('Press the button to pause/resume. Press and hold the button to stop.')}
                            />
                        </Space>
                    </div>
                )
            }
            {
                showStopComfirmModal && (
                    <StopJobConfirmModal
                        onClose={() => setShowStopComfirmModal(false)}
                        onConfirm={() => controlActions.onCallBackStop()}
                    />
                )
            }
        </div>
    );
};

export default JobStatusView;
