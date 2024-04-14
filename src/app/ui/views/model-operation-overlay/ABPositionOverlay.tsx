import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { includes, isNull, isUndefined } from 'lodash';
import { WorkflowStatus } from '@snapmaker/luban-platform';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';
import ConnectionControl from '../../widgets/ConnectionControl/index';
import { RootState } from '../../../flux/index.def';
import { actions as laserActions } from '../../../flux/laser/index';
import { actions as workspaceActions } from '../../../flux/workspace';
import LaserToolControl from '../../widgets/ConnectionToolControl/LaserToolControl';
import { MachineAgent } from '../../../flux/workspace/MachineAgent';
import controller from '../../../communication/socket-communication';
import SocketEvent from '../../../communication/socket-events';
import { SnapmakerRayMachine } from '../../../machines';
import { actions as editorActions } from '../../../flux/editor';
import { HEAD_LASER, MotorPowerMode } from '../../../constants';
import HomeTipModal from '../../widgets/RaySetOriginWidget/modals/HomeTipModal';

interface ABPositionOverlayProps {
    onClose: () => void;
}

const ABPositionOverlay: React.FC<ABPositionOverlayProps> = (props) => {
    const { size, activeMachine } = useSelector((state: RootState) => state.machine);
    const { tmpAPosition, tmpBPosition, materials } = useSelector((state: RootState) => state.laser);
    const {
        workPosition,
        originOffset,
        isHomed,
        isConnected,
        headType,
        machineIdentifier,
        workflowStatus
    } = useSelector((state: RootState) => state.workspace);
    const server: MachineAgent = useSelector((state: RootState) => state.workspace.server);
    const dispatch = useDispatch();
    const [isConnectedRay, setIsConnectedRay] = useState(false);
    const canABPosition = useCallback(() => {
        return isConnected && machineIdentifier === activeMachine.identifier && headType === HEAD_LASER && WorkflowStatus.Idle === workflowStatus;
    }, [isConnected, machineIdentifier, activeMachine, headType, workflowStatus]);

    // Home Tip Modal state
    const [showHomeTip, setShowHomeTip] = useState(false);

    // Motor Holder Mode
    const turnOnHoldMotorPower = async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.SetMotorPowerMode, { setMotorPowerHoldMod: MotorPowerMode.STAYPOWER })
                .once(SocketEvent.SetMotorPowerMode, (result) => {
                    resolve(result);
                });
        });
    };
    useEffect(() => {
        if (!machineIdentifier) {
            setIsConnectedRay(false);
            return;
        }
        setIsConnectedRay(includes([SnapmakerRayMachine.identifier], machineIdentifier));
    }, [machineIdentifier]);

    useEffect(() => {
        if (isHomed) {
            return;
        }
        console.log('isHomed', isHomed);
        setShowHomeTip(true);
    }, [isHomed]);
    const goHome = useCallback(async () => {
        return dispatch(workspaceActions.executeGcode('$H')) as unknown as Promise<void>;
    }, [dispatch]);

    const setControlPanelCoordinateMethod = () => {
        turnOnHoldMotorPower();
        goHome();
    };


    const setSvgBackground = () => {
        const isNoSet = (v) => (isUndefined(v) || Number.isNaN(v) || isNull(v));
        const notSetA = isNoSet(tmpAPosition.y) || (!materials.isRotate && isNoSet(tmpAPosition.x)) || (materials.isRotate && isNoSet(tmpAPosition.b));
        const notSetB = isNoSet(tmpBPosition.y) || (!materials.isRotate && isNoSet(tmpBPosition.x)) || (materials.isRotate && isNoSet(tmpBPosition.b));
        if (notSetA || notSetB) {
            dispatch(laserActions.removeBackgroundImage());
            return;
        }

        dispatch(editorActions.updateState(HEAD_LASER, {
            useABPosition: true
        }));
        dispatch(laserActions.setBackgroundImage('', size.x, size.y, 0, 0, { APosition: tmpAPosition, BPosition: tmpBPosition }));


        const { x, y, } = originOffset;
        const machinePositionX = (Math.round((parseFloat(workPosition.x) - x) * 1000) / 1000);
        const machinePositionY = (Math.round((parseFloat(workPosition.y) - y) * 1000) / 1000);
        // const machinePositionZ = (Math.round((parseFloat(workPosition.z) - z) * 1000) / 1000);
        // const machinePositionB = (Math.round((parseFloat(workPosition.b) - b) * 1000) / 1000);
        server.setWorkOrigin(machinePositionX, machinePositionY);
        dispatch(laserActions.updateAPosition(tmpAPosition));
        dispatch(laserActions.updateBPosition(tmpBPosition));
    };
    const settingDone = () => {
        props.onClose();
        setSvgBackground();
    };

    const widgetActions = {
        setTitle: function () { return null; }
    };
    const numberformat = (value) => (typeof value === 'undefined' ? '--' : value);

    return (
        <>
            <div className={classNames(
                styles['ab-position-overlay'],
                'width-360 position-absolute margin-left-72',
                'border-default-grey-1 border-radius-8 background-color-white',
            )}
            >
                <div className={classNames(styles['overlay-title-font'], 'border-bottom-normal padding-vertical-8 padding-horizontal-16')}>
                    {i18n._('key-CncLaser/MainToolBar-A-B Position')}
                </div>
                <div className="justify-space-between padding-vertical-16 padding-horizontal-16">

                    {isConnectedRay
                    && (<Alert className="width-percent-100 border-radius-8" message="Use the control panel to position points A and B on the machine. Please do not move the print head manually." type="warning" showIcon />
                    )}
                    <div className={classNames(styles['abposition-grid-container'])}>
                        <div className={classNames(styles['abposition-grid-item'], styles['abposition-point'])}>A</div>
                        <div className={classNames(styles['abposition-grid-item'])}>
                            <span className={classNames(styles['abposition-number'])}>{numberformat(tmpAPosition.x)}</span><br />
                            <span className={classNames(styles['abposition-unit'])}>mm</span>
                        </div>
                        <div className={classNames(styles['abposition-grid-item'])}>
                            <span className={classNames(styles['abposition-number'])}>{numberformat(tmpAPosition.y)}</span><br />
                            <span className={classNames(styles['abposition-unit'])}>mm</span>
                        </div>
                        <div className={classNames(styles['abposition-grid-item'], styles['abposition-point'])}>B</div>
                        <div className={classNames(styles['abposition-grid-item'])}>
                            <span className={classNames(styles['abposition-number'])}>{numberformat(tmpBPosition.x)}</span><br />
                            <span className={classNames(styles['abposition-unit'])}>mm</span>
                        </div>
                        <div className={classNames(styles['abposition-grid-item'])}>
                            <span className={classNames(styles['abposition-number'])}>{numberformat(tmpBPosition.y)}</span><br />
                            <span className={classNames(styles['abposition-unit'])}>mm</span>
                        </div>
                    </div>
                    {canABPosition() && <LaserToolControl withoutTips />}
                    <div className="">
                        <ConnectionControl canABPosition={canABPosition()} widgetId="control" widgetActions={widgetActions} isNotInWorkspace />
                    </div>
                </div>
                <div className="background-grey-3 padding-vertical-8 sm-flex padding-horizontal-16 justify-space-between border-radius-bottom-8 sm-flex justify-flex-end">

                    <Button
                        type="default"
                        priority="level-two"
                        className={classNames('border-radius-8', 'margin-right-8')}
                        width="96px"
                        onClick={() => props.onClose()}
                    >
                        {i18n._('key-Modal/Common-Cancel')}
                    </Button>
                    <Button
                        className={classNames(styles['ab-position-done-btn'])}
                        onClick={settingDone}
                        priority="level-two"
                        width="96px"
                        type="primary"
                        disabled={!canABPosition()}
                    >
                        {i18n._('key-Modal/Common-Done')}
                    </Button>
                </div>
            </div>
            {/* Go Home tip */
                isConnectedRay && showHomeTip && (
                    <HomeTipModal
                        onClose={() => { setShowHomeTip(false); props.onClose(); }}
                        onOk={() => {
                            setControlPanelCoordinateMethod();
                            setShowHomeTip(false);
                        }}
                    />
                )
            }
        </>
    );
};

export default ABPositionOverlay;
