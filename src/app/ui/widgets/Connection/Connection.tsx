import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI } from '../../../constants';
import { RootState } from '../../../flux/index.def';
import connectActions from '../../../flux/workspace/actions-connect';
import { ConnectionType } from '../../../flux/workspace/state';
import { controller } from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import Notifications from '../../components/Notifications';
import GoHomeModal from './modals/GoHomeModal';
import SelectMachineModal from './modals/SelectMachineModal';
import NetworkConnection from './NetworkConnection';
import SerialConnection from './SerialConnection';


/**
 * Connection Widget.
 *
 * 1. Select either network or serial port to connect to the machine.
 * 2. Display machine basic status.
 * 3. Display operation to do when machine connected (e.g. Go Home).
 */
const Connection: React.FC = () => {
    const dispatch = useDispatch();

    const {
        connectionType,
        isConnected,
    } = useSelector((state: RootState) => state.workspace);

    const [alertMessage, setAlertMessage] = useState('');

    const actions = {
        clearAlert: () => {
            setAlertMessage('');
        },
    };

    // Switch to Wi-Fi connect
    const onSelectTabWifi = useCallback(() => {
        dispatch(connectActions.setConnectionType(ConnectionType.WiFi));
    }, [dispatch]);

    // Switch to serial port connect
    const onSelectTabSerial = useCallback(() => {
        dispatch(connectActions.setConnectionType(ConnectionType.Serial));
    }, [dispatch]);

    // Subscribe to discover machines
    // We disable this function temporarily for refactoring
    useEffect(() => {
        if (!isConnected) {
            controller.subscribeDiscover(connectionType, true);
        }

        return () => {
            controller.subscribeDiscover(connectionType, false);
        };
    }, [isConnected, connectionType]);

    return (
        <div>
            {
                alertMessage && (
                    <Notifications bsStyle="danger" onDismiss={actions.clearAlert}>
                        {alertMessage}
                    </Notifications>
                )
            }
            {
                !isConnected && (
                    <div className={classNames('sm-tabs', 'margin-vertical-16')}>
                        <button
                            type="button"
                            className={classNames('sm-tab', { 'sm-selected font-weight-bold': (connectionType === CONNECTION_TYPE_WIFI) })}
                            onClick={onSelectTabWifi}
                            disabled={isConnected}
                        >
                            {i18n._('key-Workspace/Connection-Wi-Fi')}
                        </button>

                        <button
                            type="button"
                            className={classNames('sm-tab', { 'sm-selected font-weight-bold': (connectionType === CONNECTION_TYPE_SERIAL) })}
                            onClick={onSelectTabSerial}
                            disabled={isConnected}
                        >
                            {i18n._('key-Workspace/Connection-Serial Port')}
                        </button>
                    </div>
                )
            }
            {
                connectionType === ConnectionType.WiFi && (
                    <NetworkConnection />
                )
            }
            {
                connectionType === ConnectionType.Serial && (
                    <SerialConnection />
                )
            }

            {/* Select machine and tool head if not detected */}
            <SelectMachineModal />

            {/* Go Home Modal */}
            <GoHomeModal />
        </div>
    );
};

export default Connection;
