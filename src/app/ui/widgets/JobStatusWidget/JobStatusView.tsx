import { Progress } from 'antd';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_PAUSING, WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_STOPPING, WROKFLOW_STATUS_RESUMING } from '../../../constants';
import { RootState } from '../../../flux/index.def';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import SvgIcon from '../../components/SvgIcon';
import { formatDuration } from '../GCode/GCode';
import Loading from './Loading';
import StopJobConfirmModal from './modals/StopJobConfirmModal';

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

    const {
        isConnected,
        workflowStatus,
        gcodePrintingInfo: { progress, elapsedTime, remainingTime, total, sent, printStatus },
        gcodeFileName
    } = useSelector((state: RootState) => state.workspace);
    const fileName = gcodeFileName;
    const [isPausing, setIsPausing] = useState(false);
    const [showStopComfirmModal, setShowStopComfirmModal] = useState(false);

    useEffect(() => {
        if (
            isConnected
            && (workflowStatus === WORKFLOW_STATUS_RUNNING || workflowStatus === WORKFLOW_STATUS_PAUSED
                || workflowStatus === WORKFLOW_STATUS_PAUSING || workflowStatus === WORKFLOW_STATUS_STOPPING
                || workflowStatus === WROKFLOW_STATUS_RESUMING || (total > 0 && sent >= total))
        ) {
            setDisplay(true);
        } else {
            setDisplay(false);
        }
    }, [setDisplay, isConnected, workflowStatus, sent, total]);

    useEffect(() => {
        if (workflowStatus !== WORKFLOW_STATUS_PAUSING && workflowStatus !== WROKFLOW_STATUS_RESUMING) {
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
            console.error(e);
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
                printStatus !== COMPLETE_STATUS && (
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
                            <span className="height-24">{(workflowStatus === WORKFLOW_STATUS_RUNNING || workflowStatus === WORKFLOW_STATUS_PAUSING) ? i18n._('key-Workspace/WorkflowControl-Pause') : i18n._('key-Workspace/WorkflowControl-Run')}</span>
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
