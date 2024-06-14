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
import { HEAD_LASER, MotorPowerMode, SetupCoordinateMethod } from '../../../constants';
import HomeTipModal from '../../widgets/RaySetOriginWidget/modals/HomeTipModal';
import SvgIcon from '../../components/SvgIcon';
import { L20WLaserToolModule, L2WLaserToolModule, L40WLaserToolModule } from '../../../machines/snapmaker-2-toolheads';
import { JobOffsetMode } from '../../../constants/coordinate';

interface ABPositionOverlayProps {
    onClose: () => void;
}

const ABPositionOverlay: React.FC<ABPositionOverlayProps> = (props) => {
    const { size, activeMachine } = useSelector((state: RootState) => state.machine);
    const { tmpAPosition, tmpBPosition, materials } = useSelector((state: RootState) => state.laser);
    const jobOffsetMode: JobOffsetMode = useSelector((state: RootState) => state.laser.jobOffsetMode);
    const {
        workPosition,
        originOffset,
        isHomed,
        isConnected,
        headType,
        machineIdentifier,
        workflowStatus,
        isRotate,
        isRayNewVersion,
        toolHead: worksapceToolHead
    } = useSelector((state: RootState) => state.workspace);
    const server: MachineAgent = useSelector((state: RootState) => state.workspace.server);
    const dispatch = useDispatch();
    const [isConnectedRay, setIsConnectedRay] = useState(false);
    const [isShowTip, setIsShowTip] = useState(true);
    const canABPosition = useCallback(() => {
        const isSupportedHead = includes([L2WLaserToolModule.identifier, L20WLaserToolModule.identifier, L40WLaserToolModule.identifier], worksapceToolHead);
        const isCrosshairJobOffsetMode = includes([JobOffsetMode.Crosshair], jobOffsetMode);

        console.log('canABPosition', (isConnected
            && machineIdentifier === activeMachine.identifier
            && headType === HEAD_LASER
            && isSupportedHead && WorkflowStatus.Idle === workflowStatus
            && (isConnectedRay ? isCrosshairJobOffsetMode : true)
            && (isConnectedRay ? isRayNewVersion : true)
        ));
        console.log('canABPosition = ', isConnected,
            machineIdentifier === activeMachine.identifier,
            headType === HEAD_LASER,
            isSupportedHead && WorkflowStatus.Idle === workflowStatus,
            (isConnectedRay ? isCrosshairJobOffsetMode : true),
            (isConnectedRay ? isRayNewVersion : true),);
        // Scenarios where AB Position can be enabled:
        // 1. The machine is connected.
        // 2. The connected machine must be consistent with the machine setting in the software.
        // 3. Only 20W, 40W, and 2W laser modules support AB Position functionality; other modules do not have a red crosshair.
        // 4. In Ray machines, only the JobOffsetMode set to "Crosshair" can be used.
        // To-do:
        // The "laserSpot" mode is currently unavailable due to some bugs(firmware). The laser on/off sacp interface of the Ray machine is
        // different from other machines and requires firmware debugging to be corrected.
        // 5. AB Position is only available for Ray machines with a firmware version greater than 1.6.8.
        return (isConnected
            && machineIdentifier === activeMachine.identifier
            && headType === HEAD_LASER
            && isSupportedHead && WorkflowStatus.Idle === workflowStatus
            && (isConnectedRay ? isCrosshairJobOffsetMode : true)
            && (isConnectedRay ? isRayNewVersion : true)
        );
    }, [isConnected, machineIdentifier, activeMachine, headType, workflowStatus, isConnectedRay, isRayNewVersion, worksapceToolHead, jobOffsetMode]);

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
        console.log('isConnectedRay', includes([SnapmakerRayMachine.identifier], machineIdentifier), machineIdentifier, SnapmakerRayMachine.identifier);
    }, [machineIdentifier]);

    useEffect(() => {
        console.log('+++++++++++++++', isHomed, isConnectedRay && !isRayNewVersion);
        if (isConnectedRay ? !isRayNewVersion : false) {
            setShowHomeTip(false);
            return;
        }
        if (isHomed || !isConnected || !canABPosition()) {
            setShowHomeTip(false);
            return;
        }
        setShowHomeTip(true);
    }, [isHomed, isConnected, isConnectedRay, isRayNewVersion, canABPosition]);
    const goHome = useCallback(async () => {
        return dispatch(workspaceActions.executeGcode('$H')) as unknown as Promise<void>;
    }, [dispatch]);

    const setControlPanelCoordinateMethod = () => {
        dispatch(workspaceActions.updateState({ setupCoordinateMethod: SetupCoordinateMethod.ByControlPanel }));
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


    const renderTips = () => {
        let text = '';
        if (isConnectedRay) {
            text = i18n._('Use the control panel to position points A and B on the machine. Please do not move the print head manually.');
        } else {
            return '';
        }

        if (includes([JobOffsetMode.LaserSpot], jobOffsetMode)) {
            text = i18n._('When using the Laser Spot Job Offset Mode, the AB Position feature is currently not supported.');
        }

        console.log('rendertips:', isConnectedRay, text, includes([JobOffsetMode.LaserSpot], jobOffsetMode));

        return (
            <>
                <div className="sm-flex height-32 justify-space-between">
                    <span className={classNames(styles['ab-position-remind'])}>{i18n._('Warm reminder')}</span>
                    <div>
                        <SvgIcon
                            key="DropdownLine"
                            disabled={false}
                            name="DropdownLine"
                            type={['static']}
                            onClick={() => setIsShowTip(!isShowTip)}
                            className={classNames(
                                isShowTip ? '' : 'rotate180'
                            )}
                        />
                    </div>
                </div>
                {isShowTip && <Alert className="width-percent-100 border-radius-8" message={text} type="warning" showIcon />}
            </>
        );
    };

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
                <div className={classNames(styles['ab-position-overlay-content'], 'justify-space-between', 'padding-vertical-16', 'padding-horizontal-16')}>
                    {renderTips()}
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
                    {canABPosition() && <LaserToolControl withoutTips isConnectedRay={isConnectedRay} />}
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
                        {i18n._('Close')}
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
                !isRotate && isConnectedRay && showHomeTip && (
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
