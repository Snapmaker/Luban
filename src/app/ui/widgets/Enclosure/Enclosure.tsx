import { isUndefined } from 'lodash';
import React, { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';

import SocketEvent from '../../../communication/socket-events';
import { RootState } from '../../../flux/index.def';
import { controller } from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import Switch from '../../components/Switch';

const Enclosure: React.FC = () => {
    const { isConnected } = useSelector((state: RootState) => state.workspace);

    const {
        enclosureLight,
        enclosureFan,
        isDoorEnabled: doorEnabled,
    } = useSelector((state: RootState) => state.workspace, shallowEqual);

    const [isLedReady, setIsLedReady] = useState(true);
    const [isFanReady, setIsFanReady] = useState(true);
    const [isDoorEnabled, setIsDoorEnabled] = useState(isUndefined(doorEnabled) ? true : doorEnabled);

    const actions = {
        onHandleLed: async () => {
            const _led = enclosureLight === 0 ? 100 : 0;
            setIsLedReady(false);
            controller.emitEvent(SocketEvent.SetEnclosureLight, {
                value: _led
            });
        },
        onHandleCoolingFans: async () => {
            const _fan = enclosureFan === 0 ? 100 : 0;
            setIsFanReady(false);
            controller.emitEvent(SocketEvent.SetEnclosureFan, {
                value: _fan
            });
        },
        onHandleDoorEnabled: () => {
            controller
                .emitEvent(SocketEvent.SetEnclosureDoorDetection, {
                    enable: !isDoorEnabled
                })
                .once(SocketEvent.SetEnclosureDoorDetection, ({ msg, data }) => {
                    if (msg) {
                        log.error(msg);
                        return;
                    }
                    if (data) {
                        setIsDoorEnabled(data.isDoorEnabled);
                    }
                });
        }
    };

    useEffect(() => {
        setIsLedReady(true);
    }, [enclosureLight]);

    useEffect(() => {
        setIsFanReady(true);
    }, [enclosureFan]);

    useEffect(() => {
        setIsDoorEnabled(isUndefined(doorEnabled) ? true : doorEnabled);
    }, [doorEnabled]);

    return (
        <div>
            <div className="margin-bottom-8">
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-Workspace/Enclosure-LED Strips')}</span>
                    <Switch
                        onClick={actions.onHandleLed}
                        checked={Boolean(enclosureLight)}
                        disabled={(!isLedReady) || !isConnected}
                    />
                </div>
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-Workspace/Enclosure-Exhaust Fan')}</span>
                    <Switch
                        onClick={actions.onHandleCoolingFans}
                        checked={Boolean(enclosureFan)}
                        disabled={(!isFanReady) || !isConnected}
                    />
                </div>
                {/* Disable adjustment for door detection
                {(isConnected && connectionType === 'wifi' && headType !== '3dp') && (
                    <TipTrigger
                        title={i18n._('key-Workspace/Enclosure-Door Detection')}
                        content={(
                            <div>
                                <p>{i18n._('key-Workspace/Enclosure-If you disable the Door Detection feature,
 your job will not pause when one of both of the enclosure panels is/are opened.')}</p>
                            </div>
                        )}
                    >
                        <div className="sm-flex justify-space-between margin-vertical-8 ">
                            <span>{i18n._('key-Workspace/Enclosure-Door Detection')}</span>
                            <Switch
                                onClick={actions.onHandleDoorEnabled}
                                checked={isDoorEnabled}
                                disabled={(!isDoorEnabledReady) || !isConnected}
                            />
                        </div>
                    </TipTrigger>
                )}
                */}
            </div>
        </div>
    );
};

export default Enclosure;
