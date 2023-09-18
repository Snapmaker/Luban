import { WorkflowStatus } from '@snapmaker/luban-platform';
import { includes, isNil } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import SocketEvent from '../../../communication/socket-events';
import { LEVEL_TWO_POWER_LASER_FOR_SM2 } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { controller } from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import SvgIcon from '../../components/SvgIcon';
import Switch from '../../components/Switch';
import WorkSpeed from './WorkSpeed';
import AttributeContainer from './components/AttributeContainer';


const LaserToolControl: React.FC = () => {
    const {
        isConnected,

        toolHead,

        workflowStatus,
        laserPower,
        headStatus,
    } = useSelector((state: RootState) => state.workspace);

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

        controller.emitEvent(SocketEvent.SwitchLaserPower, {
            isSM2: toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2,
            laserPower: 1,
            laserPowerOpen: laserPowerOpen,
        });

        setLaserPowerOpen(!laserPowerOpen);
    }, [isPrinting, laserPowerOpen, toolHead]);

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

            {!isPrintingValue && (
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-unused-Laser Power')}</span>

                    <Switch
                        className="sm-flex-auto"
                        onClick={onClickLaserPower}
                        checked={Boolean(laserPowerOpen)}
                    />
                </div>
            )}
            {!isPrintingValue && (
                <div className="sm-flex">
                    <SvgIcon
                        name="WarningTipsWarning"
                        color="#FFA940"
                        type={['static']}
                    />
                    <span>{i18n._('key-Workspace/Laser-high_power_tips')}</span>
                </div>
            )}
        </div>
    );
};

export default LaserToolControl;
