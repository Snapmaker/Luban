import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Progress } from 'antd';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import { formatDuration } from '../GCode/GCode';
import { Button } from '../../components/Buttons';
import SvgIcon from '../../components/SvgIcon';

const Text = ({ name, value }) => {
    return (
        <div className="margin-top-8">
            <span className="unit-text margin-right-8">{name}</span>
            <span className="main-text-normal">{value}</span>
        </div>
    );
};
Text.propTypes = {
    name: PropTypes.string,
    value: PropTypes.string
};

const WorkingProgress = ({ widgetActions, controlActions }) => {
    const { isConnected, workflowStatus, gcodePrintingInfo: { progress, fileName, elapsedTime, remainingTime, total, sent } } = useSelector(state => state.machine);
    useEffect(() => {
        widgetActions.setTitle(i18n._('Working'));
    }, []);
    useEffect(() => {
        if (isConnected && (workflowStatus === 'running' || workflowStatus === 'paused')) {
            widgetActions.setDisplay(true);
        } else {
            widgetActions.setDisplay(false);
        }
    }, [isConnected, workflowStatus]);
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
            <div className="sm-flex justify-space-between align-center margin-top-16 margin-bottom-16">
                <div>
                    <Text name={i18n._('File')} value={fileName || i18n._('Unknow')} />
                    <Text name={i18n._('Elapsed Time')} value={formatDuration(elapsedTime, false)} />
                    <Text name={i18n._('Remaining Time')} value={formatDuration(remainingTime, false)} />
                    <Text name={i18n._('GCode Line')} value={`${sent} / ${total}`} />
                </div>
                <Progress percent={Math.floor(progress * 100)} type="circle" width={88} />
            </div>
            <div className="sm-flex justify-space-between align-center">
                <Button width="160px" type="default" onClick={() => handleMachine(workflowStatus === 'running' ? 'pause' : 'run')}>
                    <SvgIcon
                        name={workflowStatus === 'running' ? 'WorkspaceSuspend' : 'WorkspacePlay'}
                        type={['static']}
                        color={workflowStatus === 'running' ? '#FFA940' : '#4CB518'}
                    />
                    <span className="height-24">{workflowStatus === 'running' ? i18n._('Pause') : i18n._('Resume')}</span>
                </Button>
                <Button width="160px" type="default" onClick={() => handleMachine('stop')}>
                    <SvgIcon
                        name="WorkspaceStop"
                        type={['static']}
                        color="#FF4D4F"
                    />
                    <span className="height-24">{i18n._('Stop')}</span>
                </Button>
            </div>
        </div>
    );
};

WorkingProgress.propTypes = {
    widgetActions: PropTypes.object.isRequired,
    controlActions: PropTypes.object
};
export default WorkingProgress;
