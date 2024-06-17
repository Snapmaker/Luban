import React, { useEffect, useState } from 'react';
import { Switch } from 'antd';
import { useSelector } from 'react-redux';
import i18n from '../../../lib/i18n';
import controller from '../../../communication/socket-communication';
import SocketEvent from '../../../communication/socket-events';
import { MotorPowerMode } from '../../../constants';
import { RootState } from '../../../flux/index.def';

// not used for now
// a wiget that control MotorPowerHoldMode(just for Ray control mode)
const MotorPowerHoldControl = () => {
    const { isConnected } = useSelector((state: RootState) => state.workspace);
    const [isHoldMode, setIsHoldMode] = useState(false);
    const turnOnHoldMotorPower = async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.SetMotorPowerMode, { setMotorPowerHoldMod: MotorPowerMode.STAYPOWER })
                .once(SocketEvent.SetMotorPowerMode, (result) => {
                    resolve(result);
                });
        });
    };
    const turnOffHoldMotorPower = async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.SetMotorPowerMode, { setMotorPowerHoldMod: MotorPowerMode.SHUTAll })
                .once(SocketEvent.SetMotorPowerMode, (result) => {
                    resolve(result);
                });
        });
    };
    const getMotorPowerHoldMode = async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.SetMotorPowerMode, { setMotorPowerHoldMod: MotorPowerMode.GETCURRENTMODE })
                .once(SocketEvent.SetMotorPowerMode, (result) => {
                    resolve(result.result);
                });
        });
    };

    const onChange = async (checked: boolean) => {
        if (checked) {
            await turnOnHoldMotorPower();
        } else {
            await turnOffHoldMotorPower();
        }

        const res = await getMotorPowerHoldMode();
        setIsHoldMode(res === MotorPowerMode.STAYPOWER);
    };

    useEffect(async () => {
        if (!isConnected) return;
        const res = await getMotorPowerHoldMode();
        setIsHoldMode(res === MotorPowerMode.STAYPOWER);
    }, [isConnected]);

    return isConnected && (
        <div className="sm-flex justify-space-between margin-vertical-8">
            <span className="line-height-32">{i18n._('Motor Power Hold')}</span>
            <div className="sm-flex justify-flex-end">
                <Switch
                    priority="level-three"
                    className="display-inline"
                    checked={isHoldMode}
                    onChange={onChange}
                    disabled={false}
                />
            </div>
        </div>
    );
};


export default MotorPowerHoldControl;
