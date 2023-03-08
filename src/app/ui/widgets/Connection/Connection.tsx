import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI, PROTOCOL_TEXT } from '../../../constants';
import { MACHINE_SERIES } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { actions as workspaceActions } from '../../../flux/workspace';
import { ConnectionType } from '../../../flux/workspace/state';
import { controller } from '../../../lib/controller';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';
import Notifications from '../../components/Notifications';

import SerialConnection from './SerialConnection';
import WifiConnection from './WifiConnection';

declare interface WidgetActions {
    setTitle: (title: string) => void;
}

export declare interface ConnectionProps {
    widgetId: string;
    widgetActions: WidgetActions;
}


const Connection: React.FC<ConnectionProps> = ({ widgetId, widgetActions }) => {
    const dispatch = useDispatch();
    const { widgets } = useSelector((state: RootState) => state.widget);

    const dataSource = widgets[widgetId].dataSource;
    const {
        connectionType,
        isConnected,
    } = useSelector((state: RootState) => state.workspace);

    const {
        machineIdentifier,

        isHomed,
    } = useSelector((state: RootState) => state.workspace);

    const [alertMessage, setAlertMessage] = useState('');
    const [showHomeReminder, setShowHomeReminder] = useState(false);
    const [homing, setHoming] = useState(false);

    const actions = {
        clearAlert: () => {
            setAlertMessage('');
        },
        clickHomeModalOk: () => {
            dispatch(workspaceActions.executeGcodeAutoHome());
            setHoming(true);
        }
    };

    // Set title
    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Connection-Connection'));
    }, [dispatch, widgetActions]);

    // Switch to Wi-Fi connect
    const onSelectTabWifi = useCallback(() => {
        dispatch(workspaceActions.connect.setConnectionType(ConnectionType.WiFi));
    }, [dispatch]);

    // Switch to serial port connect
    const onSelectTabSerial = useCallback(() => {
        dispatch(workspaceActions.connect.setConnectionType(ConnectionType.Serial));
    }, [dispatch]);

    useEffect(() => {
        if (!isHomed && isConnected) {
            if (dataSource === PROTOCOL_TEXT) {
                setShowHomeReminder(true);
            }
        } else {
            setHoming(false);
            if (dataSource === PROTOCOL_TEXT) {
                setShowHomeReminder(false);
            }
        }
    }, [isHomed, isConnected]);

    // Subscribe to discover machines
    // We disable this function temporarily for refactoring
    useEffect(() => {
        controller.subscribeDiscover(!isConnected);

        return () => {
            controller.subscribeDiscover(false);
        };
    }, [isConnected]);

    const isOriginal = machineIdentifier === MACHINE_SERIES.ORIGINAL.identifier;

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
                    <WifiConnection />
                )
            }
            {
                connectionType === ConnectionType.Serial && (
                    <SerialConnection dataSource={dataSource} />
                )
            }

            {/* Go Home Dialog */}
            {
                showHomeReminder && isConnected && !isOriginal && isHomed !== null && !isHomed && (
                    <Modal disableOverlay size="sm" closable={false}>
                        <Modal.Header>
                            {i18n._('key-Workspace/Connection-Go Home')}
                        </Modal.Header>
                        <Modal.Body>
                            <div>
                                {i18n._('key-Workspace/Connection-To continue, the machine needs to return to the start position of the X, Y, and Z axes.')}
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                loading={homing}
                                priority="level-two"
                                className="align-r"
                                width="96px"
                                onClick={actions.clickHomeModalOk}
                            >
                                {!homing && (
                                    <span>{i18n._('key-Workspace/Connection-OK')}</span>
                                )}
                            </Button>
                        </Modal.Footer>
                    </Modal>
                )
            }
        </div>
    );
};

export default Connection;
