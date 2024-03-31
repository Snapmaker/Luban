import React, { useEffect, useState } from 'react';
import { Switch } from 'antd';
import { useSelector } from 'react-redux';
import i18n from '../../../lib/i18n';
import controller from '../../../communication/socket-communication';
import SocketEvent from '../../../communication/socket-events';
import { MotorPowerMode } from '../../../constants';
import { RootState } from '../../../flux/index.def';

const MotorPowerHoldControl = () => {
    const { isConnected } = useSelector((state: RootState) => state.workspace);
    const [isHoldMode, setIsHoldMode] = useState(false);
    const turnOnHoldMotorPower = async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.SetMotorPowerMode, { setMotorPowerHoldMod: MotorPowerMode.STAYPOWER })
                .once(SocketEvent.SetMotorPowerMode, (result) => {
                    console.log('SetMotorPowerMode workspace');
                    resolve(result);
                });
        });
    };
    const turnOffHoldMotorPower = async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.SetMotorPowerMode, { setMotorPowerHoldMod: MotorPowerMode.SHUTAll })
                .once(SocketEvent.SetMotorPowerMode, (result) => {
                    console.log('SetMotorPowerMode workspace off');
                    resolve(result);
                });
        });
    };
    const getMotorPowerHoldMode = async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.SetMotorPowerMode, { setMotorPowerHoldMod: MotorPowerMode.GETCURRENTMODE })
                .once(SocketEvent.SetMotorPowerMode, (result) => {
                    console.log('SetMotorPowerMode workspace');
                    resolve(result.result);
                });
        });
    };

    const onChange = async (checked: boolean) => {
        console.log(`set ${checked}`);
        if (checked) {
            await turnOnHoldMotorPower();
        } else {
            await turnOffHoldMotorPower();
        }

        const res = await getMotorPowerHoldMode();
        console.log('get', res);
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
                {/* <Button
                    type="default"
                    priority="level-three"
                    width="96px"
                    className="display-inline"
                    onClick={turnOnHoldMotorPower}
                >
                    {i18n._('Turn On')}
                </Button>
                <Button
                    type="default"
                    priority="level-three"
                    width="96px"
                    className="display-inline margin-left-4"
                    onClick={turnOffHoldMotorPower}
                >
                    {i18n._('Turn Off')}
                </Button> */}
            </div>
        </div>
    );
};


export default MotorPowerHoldControl;
