import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Progress } from 'antd';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import { formatDuration } from '../GCode/GCode';
import { Button } from '../../components/Buttons';
import SvgIcon from '../../components/SvgIcon';
import Modal from '../../components/Modal';
import Loading from './Loading';
import { WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_PAUSING, WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_STOPPING, WROKFLOW_STATUS_RESUMING } from '../../../constants';

const COMPLETE_STATUS = 'Complete';
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

const StopConfirmModal = (props) => {
    return (
        <Modal
            centered
            visible
            onClose={() => { props.onClose(); }}
        >
            <Modal.Header>
                {i18n._('key-Workspace/Workprogress-StopJobConfirmModal title')}
            </Modal.Header>
            <Modal.Body>
                {props.children}
                {i18n._('key-Workspace/Workprogress-StopJobConfirmModal body')}
            </Modal.Body>
            <Modal.Footer>
                <Button
                    className="margin-right-8"
                    priority="level-two"
                    type="default"
                    width="96px"
                    onClick={() => { props.onClose(); }}
                >
                    <div className="align-c">{i18n._('key-Workspace/Workprogress-StopJobConfirmModal Cancel')}</div>
                </Button>
                <Button
                    priority="level-two"
                    type="primary"
                    width="96px"
                    onClick={() => { props.onConfirm(); props.onClose(); }}
                >
                    <div className="align-c">{i18n._('key-Workspace/Workprogress-StopJobConfirmModal Yes')}</div>
                </Button>
            </Modal.Footer>
        </Modal>
    );
};
StopConfirmModal.propTypes = {
    children: PropTypes.array,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
};


const WorkingProgress = ({ widgetActions, controlActions }) => {
    const {
        isConnected, workflowStatus,
        gcodePrintingInfo: { progress, elapsedTime, estimatedTime, total, sent, printStatus },
        gcodeFileName
    } = useSelector(state => state.machine);
    const fileName = gcodeFileName;
    const [currentWorkflowStatus, setCurrentWorkflowStatus] = useState(null);
    const [isPausing, setIsPausing] = useState(false);
    const [showStopComfirmModal, setShowStopComfirmModal] = useState(false);

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Workprogress-Working'));
    }, []);
    useEffect(() => {
        // const newCurrent = connectionType === 'wifi' ? workflowStatus : workflowState;
        setCurrentWorkflowStatus(workflowStatus);
    }, [workflowStatus]);
    useEffect(() => {
        if (
            isConnected
            && (currentWorkflowStatus === WORKFLOW_STATUS_RUNNING || currentWorkflowStatus === WORKFLOW_STATUS_PAUSED
                || currentWorkflowStatus === WORKFLOW_STATUS_PAUSING || currentWorkflowStatus === WORKFLOW_STATUS_STOPPING
                || currentWorkflowStatus === WROKFLOW_STATUS_RESUMING || (total !== 0 && sent >= total))
        ) {
            widgetActions.setDisplay(true);
        } else {
            widgetActions.setDisplay(false);
        }
    }, [isConnected, currentWorkflowStatus, sent, total, widgetActions]);

    useEffect(() => {
        console.log({ currentWorkflowStatus, isPausing });
        if (currentWorkflowStatus !== WORKFLOW_STATUS_PAUSING && currentWorkflowStatus !== WROKFLOW_STATUS_RESUMING) {
            setIsPausing(false);
        } else {
            setIsPausing(true);
        }
    }, [currentWorkflowStatus]);

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
                    <Text name={i18n._('key-Workspace/Workprogress-Remaining Time')} value={formatDuration(estimatedTime, false)} />
                    <Text name={i18n._('key-Workspace/Workprogress-GCode Line')} value={`${sent} / ${total}`} />
                </div>
                <Progress percent={actualProgress} type="circle" width={88} />
            </div>
            {printStatus !== COMPLETE_STATUS && (
                <div className="sm-flex justify-space-between align-center margin-top-16">
                    <Button width="160px" type="default" onClick={() => handleMachine(currentWorkflowStatus === 'running' ? 'pause' : 'run')}>
                        {!isPausing && (
                            <SvgIcon
                                // TODO: pause translation animation
                                name={currentWorkflowStatus === 'running' ? 'WorkspaceSuspend' : 'WorkspacePlay'}
                                type={['static']}
                                color={currentWorkflowStatus === 'running' ? '#FFA940' : '#4CB518'}
                            />
                        )}
                        {isPausing && (
                            <Loading
                                style={{ color: '#B9BCBF', position: 'relative', top: -3, marginRight: 4 }}
                                className="margin-right-4"
                            />
                        )}
                        <span className="height-24">{(currentWorkflowStatus === WORKFLOW_STATUS_RUNNING || currentWorkflowStatus === WORKFLOW_STATUS_PAUSING) ? i18n._('key-Workspace/WorkflowControl-Pause') : i18n._('key-Workspace/WorkflowControl-Run')}</span>
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
            {showStopComfirmModal && (
                <StopConfirmModal onClose={() => { setShowStopComfirmModal(false); console.log('on close'); }} onConfirm={() => { controlActions.onCallBackStop(); }} />
            )}
        </div>
    );
};

WorkingProgress.propTypes = {
    widgetActions: PropTypes.object.isRequired,
    controlActions: PropTypes.object
};
export default WorkingProgress;
