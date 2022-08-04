import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '../../components/Buttons';

import {
    CONNECTION_TYPE_SERIAL,
    CONNECTION_TYPE_WIFI,
    EXPERIMENTAL_WIFI_CONTROL,
    MACHINE_SERIES,
    PROTOCOL_TEXT
} from '../../../constants';
import i18n from '../../../lib/i18n';
import Notifications from '../../components/Notifications';
import Modal from '../../components/Modal';

import SerialConnection from './SerialConnection';
import WifiConnection from './WifiConnection';
import { actions as machineActions } from '../../../flux/machine';


function Connection({ widgetId, widgetActions }) {
    const { widgets } = useSelector(state => state.widget);
    const dataSource = widgets[widgetId].dataSource;
    const { connectionType, isConnected, series, isHomed } = useSelector(state => state.machine);
    const [alertMessage, setAlertMessage] = useState('');
    const [showHomeReminder, setShowHomeReminder] = useState(false);
    const [homing, setHoming] = useState(false);
    const dispatch = useDispatch();

    const actions = {
        clearAlert: () => {
            setAlertMessage('');
        },
        onSelectTabSerial: () => {
            dispatch(machineActions.connect.setConnectionType(CONNECTION_TYPE_SERIAL));
        },
        onSelectTabWifi: () => {
            dispatch(machineActions.connect.setConnectionType(CONNECTION_TYPE_WIFI));
        },
        openHomeModal: () => {
            setShowHomeReminder(true);
        },
        closeHomeModal: () => {
            setShowHomeReminder(false);
        },
        clickHomeModalOk: () => {
            dispatch(machineActions.executeGcodeAutoHome());
            // setShowHomeReminder(false);
            setHoming(true);
        }
    };

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Connection-Connection'));
    }, []);

    useEffect(() => {
        if (!isHomed && isConnected) {
            if (dataSource === PROTOCOL_TEXT) {
                actions.openHomeModal();
            }
        } else {
            setHoming(false);
            if (dataSource === PROTOCOL_TEXT) {
                actions.closeHomeModal();
            }
        }
    }, [isHomed, isConnected]);

    const isOriginal = series === MACHINE_SERIES.ORIGINAL.value;
    return (
        <div>
            {alertMessage && (
                <Notifications bsStyle="danger" onDismiss={actions.clearAlert}>
                    {alertMessage}
                </Notifications>
            )}

            {EXPERIMENTAL_WIFI_CONTROL && !isConnected && (
                <div className={classNames('sm-tabs', 'margin-vertical-16')}>
                    <button
                        type="button"
                        className={classNames('sm-tab', { 'sm-selected font-weight-bold': (connectionType === CONNECTION_TYPE_SERIAL) })}
                        onClick={actions.onSelectTabSerial}
                        disabled={isConnected}
                    >
                        {i18n._('key-Workspace/Connection-Serial Port')}
                    </button>
                    <button
                        type="button"
                        className={classNames('sm-tab', { 'sm-selected font-weight-bold': (connectionType === CONNECTION_TYPE_WIFI) })}
                        onClick={actions.onSelectTabWifi}
                        disabled={isConnected}
                    >
                        {i18n._('key-Workspace/Connection-Wi-Fi')}
                    </button>
                </div>
            )}
            {!EXPERIMENTAL_WIFI_CONTROL && (
                <p>{i18n._('key-Workspace/Connection-Serial Port')}</p>
            )}
            {connectionType === CONNECTION_TYPE_SERIAL && (
                <SerialConnection dataSource={dataSource} />
            )}
            {connectionType === CONNECTION_TYPE_WIFI && (
                <WifiConnection />
            )}
            {isConnected && showHomeReminder && !isOriginal && isHomed !== null && !isHomed && (
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
            )}
        </div>
    );
}
Connection.propTypes = {
    widgetId: PropTypes.string.isRequired,
    widgetActions: PropTypes.object.isRequired
};

export default Connection;
