import { ToolHead, WorkflowStatus } from '@snapmaker/luban-platform';
import { includes, isNil } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { controller } from '../../../communication/socket-communication';
import SocketEvent from '../../../communication/socket-events';
import { LEVEL_TWO_POWER_LASER_FOR_SM2 } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { Button } from '../../components/Buttons';
import SvgIcon from '../../components/SvgIcon';
import Switch from '../../components/Switch';
import { toast } from '../../components/Toast';
import { makeSceneToast } from '../../views/toasts/SceneToast';
import WorkSpeed from './WorkSpeed';
import AttributeContainer from './components/AttributeContainer';
import { L2WLaserToolModule } from '../../../machines/snapmaker-2-toolheads';

interface LaserToolControlProps {
    withoutTips?: boolean
}
const LaserToolControl: React.FC<LaserToolControlProps> = (props) => {
    const { withoutTips } = props;
    const {
        isConnected,

        toolHead,

        workflowStatus,
        laserPower,
        headStatus,
    } = useSelector((state: RootState) => state.workspace);

    const activeTool: ToolHead = useSelector((state: RootState) => state.workspace.activeTool);
    const activeToolMetadata = activeTool.metadata;

    const [laserPowerOpen, setLaserPowerOpen] = useState<boolean>(headStatus);
    const [localLaserPower, setLocalLaserPower] = useState<number>(laserPower || 1);

    const isPrinting = useCallback(() => {
        return includes([
            WorkflowStatus.Running,
            WorkflowStatus.Pausing,
            WorkflowStatus.Paused,
        ], workflowStatus);
    }, [workflowStatus]);

    const onClickLaserPower = useCallback(() => {
        if (isPrinting()) {
            return;
        }

        if (laserPowerOpen) {
            controller
                .emitEvent(SocketEvent.TurnOffLaser)
                .once(SocketEvent.TurnOffLaser, ({ err }) => {
                    if (err) {
                        log.error(err);
                    }
                });
        } else {
            controller
                .emitEvent(SocketEvent.TurnOnTestLaser)
                .once(SocketEvent.TurnOnTestLaser, ({ err }) => {
                    if (err) {
                        log.error(err);
                    }
                });
        }

        setLaserPowerOpen(!laserPowerOpen);
    }, [isPrinting, laserPowerOpen]);

    const onSaveLaserPower = useCallback((value: number) => {
        controller.emitEvent(SocketEvent.SetLaserPower, {
            isPrinting: isPrinting(),
            laserPower: value,
            laserPowerOpen: laserPowerOpen
        });
        setLocalLaserPower(value);
    }, [isPrinting, laserPowerOpen]);

    useEffect(() => {
        if (isConnected) {
            if (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                setLocalLaserPower(1);
            }
        }
    }, [isConnected, toolHead]);

    useEffect(() => {
        if (!isNil(laserPower)) {
            setLocalLaserPower(laserPower);
        }
        setLaserPowerOpen(headStatus);
    }, [laserPower, headStatus]);

    const onClickTurnOnCrosshair = useCallback(() => {
        controller
            .emitEvent(SocketEvent.TurnOnCrosshair)
            .once(SocketEvent.TurnOnCrosshair, ({ err }) => {
                if (err) {
                    toast(makeSceneToast('info', i18n._('Failed to turn on crosshair.')));
                }
            });
    }, []);

    const onClickTurnOffCrosshair = useCallback(() => {
        controller
            .emitEvent(SocketEvent.TurnOffCrosshair)
            .once(SocketEvent.TurnOffCrosshair, ({ err }) => {
                if (err) {
                    toast(makeSceneToast('info', i18n._('Failed to turn off crosshair.')));
                }
            });
    }, []);

    const isPrintingValue = isPrinting();

    return (
        <div>
            {isPrintingValue && (
                <AttributeContainer
                    handleSubmit={(value) => {
                        onSaveLaserPower(value);
                    }}
                    initValue={localLaserPower}
                    title={i18n._('key-unused-Laser Power')}
                    suffix="%"
                    inputMax={100}
                    hasSlider
                    inputMin={0}
                    sliderMin={0}
                    sliderMax={100}
                >
                    <div className="width-44 sm-flex sm-flex-direction-c margin-left-16">
                        <span>{localLaserPower}%</span>
                    </div>
                </AttributeContainer>
            )}
            {isPrintingValue && <WorkSpeed />}

            {/* Turn On/Off laser */}
            {
                toolHead !== L2WLaserToolModule.identifier && !isPrintingValue && (
                    <div className="sm-flex justify-space-between margin-vertical-8">
                        <span>{i18n._('key-unused-Laser Power')}</span>
                        <Switch
                            className="sm-flex-auto"
                            onClick={onClickLaserPower}
                            checked={Boolean(laserPowerOpen)}
                        />
                    </div>
                )
            }

            {
                activeToolMetadata.supportCrosshair && (
                    <div className="sm-flex justify-space-between margin-vertical-8">
                        <span className="line-height-32">{i18n._('Crosshair')}</span>
                        <div className="sm-flex justify-flex-end">
                            <Button
                                type="default"
                                priority="level-three"
                                width="96px"
                                className="display-inline"
                                onClick={onClickTurnOnCrosshair}
                            >
                                {i18n._('Turn On')}
                            </Button>
                            <Button
                                type="default"
                                priority="level-three"
                                width="96px"
                                className="display-inline margin-left-4"
                                onClick={onClickTurnOffCrosshair}
                            >
                                {i18n._('Turn Off')}
                            </Button>
                        </div>
                    </div>
                )
            }

            {/* High Power Tips */}
            {
                !withoutTips && !isPrintingValue && (
                    <div className="sm-flex">
                        <SvgIcon
                            name="WarningTipsWarning"
                            color="#FFA940"
                            type={['static']}
                        />
                        <span>{i18n._('key-Workspace/Laser-high_power_tips')}</span>
                    </div>
                )
            }
        </div>
    );
};

export default LaserToolControl;
