import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Progress } from 'antd';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import { formatDuration } from '../GCode/GCode';
import { Button } from '../../components/Buttons';
import SvgIcon from '../../components/SvgIcon';

const Text = ({ name, value }) => {
    return (
        <div className="margin-top-8 sm-flex align-c">
            <span className="unit-text margin-right-8 text-overflow-ellipsis display-inline align-l">{name}</span>
            <span className="main-text-normal text-overflow-ellipsis display-inline width-112 align-l">{value}</span>
        </div>
    );
};
Text.propTypes = {
    name: PropTypes.string,
    value: PropTypes.string
};

const WorkingProgress = ({ widgetActions, controlActions }) => {
    const {
        isConnected, workflowStatus,
        gcodePrintingInfo: { progress, elapsedTime, remainingTime, total, sent },
        connectionType, workflowState
    } = useSelector(state => state.machine);
    const gcodeFile = useSelector(state => state.workspace.gcodeFile);
    const fileName = gcodeFile?.renderGcodeFileName ?? gcodeFile?.name;
    const [currentWorkflowStatus, setCurrentWorkflowStatus] = useState(null);
    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Workprogress-Working'));
    }, []);
    useEffect(() => {
        const newCurrent = connectionType === 'wifi' ? workflowStatus : workflowState;
        setCurrentWorkflowStatus(newCurrent);
    }, [workflowState, workflowStatus, connectionType]);
    useEffect(() => {
        if (
            isConnected
            && (currentWorkflowStatus === 'running' || currentWorkflowStatus === 'paused' || (total !== 0 && sent >= total))
        ) {
            widgetActions.setDisplay(true);
        } else {
            widgetActions.setDisplay(false);
        }
    }, [isConnected, currentWorkflowStatus, sent, total]);
    const handleMachine = (type) => {
        switch (type) {
            case 'run':
                controlActions.onCallBackRun();
                break;
            case 'pause':
                controlActions.onCallBackPause();
                break;
            case 'stop':
                controlActions.onCallBackStop();
                break;
            default:
                break;
        }
    };

    return (
        <div>
            <div className="sm-flex justify-space-between align-center margin-top-8">
                <div>
                    <Text name={i18n._('key-Workspace/Workprogress-File')} value={fileName || i18n._('key-Workspace/Workprogress-Unknow')} />
                    <Text name={i18n._('key-Workspace/Workprogress-Elapsed Time')} value={formatDuration(elapsedTime, false)} />
                    <Text name={i18n._('key-Workspace/Workprogress-Remaining Time')} value={formatDuration(remainingTime, false)} />
                    <Text name={i18n._('key-Workspace/Workprogress-GCode Line')} value={`${sent} / ${total}`} />
                </div>
                <Progress percent={Math.floor(progress ? progress * 100 : (sent / total) * 100)} type="circle" width={88} />
            </div>
            {!(sent >= total && total !== 0) && (
                <div className="sm-flex justify-space-between align-center margin-top-16">
                    <Button width="160px" type="default" onClick={() => handleMachine(currentWorkflowStatus === 'running' ? 'pause' : 'run')}>
                        <SvgIcon
                            name={currentWorkflowStatus === 'running' ? 'WorkspaceSuspend' : 'WorkspacePlay'}
                            type={['static']}
                            color={currentWorkflowStatus === 'running' ? '#FFA940' : '#4CB518'}
                        />
                        <span className="height-24">{currentWorkflowStatus === 'running' ? i18n._('key-Workspace/WorkflowControl-Pause') : i18n._('key-Workspace/WorkflowControl-Run')}</span>
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
            )}
        </div>
    );
};

WorkingProgress.propTypes = {
    widgetActions: PropTypes.object.isRequired,
    controlActions: PropTypes.object
};
export default WorkingProgress;
