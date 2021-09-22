import React, { useEffect, useState } from 'react';
// import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import TipTrigger from '../../components/TipTrigger';
import Switch from '../../components/Switch';
import { actions as machineActions } from '../../../flux/machine';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';


function Enclosure() {
    const { server, isConnected, headType, connectionType, enclosureLight, enclosureFan } = useSelector(state => state.machine, shallowEqual);
    const [led, setLed] = useState(0);
    const [fan, setFan] = useState(0);
    const [isLedReady, setIsLedReady] = useState(true);
    const [isFanReady, setIsFanReady] = useState(true);
    const [isDoorEnabled, setIsDoorEnabled] = useState(true);
    const dispatch = useDispatch();

    const actions = {
        onHandleLed: async () => {
            let _led;
            if (led === 0) {
                _led = 100;
            } else {
                _led = 0;
            }
            if (connectionType === 'wifi') {
                server.setEnclosureLight(_led, (errMsg, res) => {
                    if (errMsg) {
                        log.error(errMsg);
                        return;
                    }
                    if (res) {
                        setLed(res.led);
                    }
                });
            } else {
                await dispatch(machineActions.executeGcode(`M1010 S3 P${_led};`, null));
                setIsLedReady(false);
            }
        },
        onHandleCoolingFans: async () => {
            let _fan;
            if (fan === 0) {
                _fan = 100;
            } else {
                _fan = 0;
            }
            if (connectionType === 'wifi') {
                server.setEnclosureFan(_fan, (errMsg, res) => {
                    if (errMsg) {
                        log.error(errMsg);
                        return;
                    }
                    if (res) {
                        setFan(res.fan);
                    }
                });
            } else {
                await dispatch(machineActions.executeGcode(`M1010 S4 P${_fan};`, null));
                setIsFanReady(false);
            }
        },
        onHandleDoorEnabled: () => {
            server.setDoorDetection(!isDoorEnabled, (errMsg, res) => {
                if (errMsg) {
                    log.error(errMsg);
                    return;
                }
                if (res) {
                    setIsDoorEnabled(res.isDoorEnabled);
                }
            });
        }
    };

    useEffect(() => {
        if (isConnected && connectionType === 'wifi') {
            server.getEnclosureStatus((errMsg, res) => {
                if (errMsg) {
                    log.warn(errMsg);
                } else {
                    setLed(res.led);
                    setFan(res.fan);
                    setIsDoorEnabled(res.isDoorEnabled);
                }
            });
        }
    }, []);

    useEffect(() => {
        if (connectionType === 'serial') {
            setLed(enclosureLight);
            setIsLedReady(true);
        }
    }, [enclosureLight]);

    useEffect(() => {
        if (connectionType === 'serial') {
            setFan(enclosureFan);
            setIsFanReady(true);
        }
    }, [enclosureFan]);

    useEffect(() => {
        if (isConnected && connectionType === 'wifi') {
            server.getEnclosureStatus((errMsg, res) => {
                if (errMsg) {
                    log.warn(errMsg);
                } else {
                    setLed(res.led);
                    setFan(res.fan);
                    setIsDoorEnabled(res.isDoorEnabled);
                }
            });
        }
    }, [isConnected]);

    return (
        <div>
            <div className="margin-bottom-8">
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key_ui/widgets/Enclosure/Enclosure_LED Strips')}</span>
                    <Switch
                        onClick={actions.onHandleLed}
                        checked={Boolean(led)}
                        disabled={(connectionType === 'serial' && !isLedReady) || !isConnected}
                    />
                </div>
                <div className="sm-flex justify-space-between margin-vertical-8 ">
                    <span>{i18n._('key_ui/widgets/Enclosure/Enclosure_Exhaust Fan')}</span>
                    <Switch
                        onClick={actions.onHandleCoolingFans}
                        checked={Boolean(fan)}
                        disabled={(connectionType === 'serial' && !isFanReady) || !isConnected}
                    />
                </div>
                { (isConnected && connectionType === 'wifi' && headType !== '3dp') && (
                    <TipTrigger
                        title={i18n._('key_ui/widgets/Enclosure/Enclosure_Door Detection')}
                        content={(
                            <div>
                                <p>{i18n._('key_ui/widgets/Enclosure/Enclosure_If you disable the Door Detection feature, your job will not pause when one of both of the enclosure panels is/are opened.')}</p>
                            </div>
                        )}
                    >
                        <div className="sm-flex justify-space-between margin-vertical-8 ">
                            <span>{i18n._('key_ui/widgets/Enclosure/Enclosure_Door Detection')}</span>
                            <Switch
                                onClick={actions.onHandleDoorEnabled}
                                checked={isDoorEnabled}
                                disabled={(connectionType === 'serial' && !isFanReady) || !isConnected}
                            />
                        </div>
                    </TipTrigger>
                )}
            </div>
        </div>
    );
}
Enclosure.propTypes = {
};

export default Enclosure;
