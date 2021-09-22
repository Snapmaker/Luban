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
            setShowHomeReminder(false);
        }
    };

    useEffect(() => {
        widgetActions.setTitle(i18n._('key_ui/widgets/Connection/Connection_Connection'));
    }, []);

    useEffect(() => {
        if (!isHomed) {
            if (dataSource === PROTOCOL_TEXT) {
                actions.openHomeModal();
            }
        } else {
            if (dataSource === PROTOCOL_TEXT) {
                actions.closeHomeModal();
            }
        }
    }, [isHomed]);

    const isOriginal = series === MACHINE_SERIES.ORIGINAL.value;
    return (
        <div className="padding-bottom-16">
            {alertMessage && (
                <Notifications bsStyle="danger" onDismiss={actions.clearAlert}>
                    {alertMessage}
                </Notifications>
            )}

            {EXPERIMENTAL_WIFI_CONTROL && (
                <div className={classNames('sm-tabs', 'margin-vertical-16')}>
                    <button
                        type="button"
                        className={classNames('sm-tab', { 'sm-selected font-weight-bold': (connectionType === CONNECTION_TYPE_SERIAL) })}
                        onClick={actions.onSelectTabSerial}
                        disabled={isConnected}
                    >
                        {i18n._('key_ui/widgets/Connection/Connection_Serial Port')}
                    </button>
                    <button
                        type="button"
                        className={classNames('sm-tab', { 'sm-selected font-weight-bold': (connectionType === CONNECTION_TYPE_WIFI) })}
                        onClick={actions.onSelectTabWifi}
                        disabled={isConnected}
                    >
                        {i18n._('key_ui/widgets/Connection/Connection_Wi-Fi')}
                    </button>
                </div>
            )}
            {!EXPERIMENTAL_WIFI_CONTROL && (
                <p>{i18n._('key_ui/widgets/Connection/Connection_Serial Port')}</p>
            )}
            {connectionType === CONNECTION_TYPE_SERIAL && (
                <SerialConnection dataSource={dataSource} />
            )}
            {connectionType === CONNECTION_TYPE_WIFI && (
                <WifiConnection />
            )}
            {isConnected && showHomeReminder && !isOriginal && isHomed !== null && !isHomed && (
                <Modal disableOverlay size="sm" showCloseButton={false}>
                    <Modal.Header>
                        {i18n._('key_ui/widgets/Connection/Connection_Go Home')}
                    </Modal.Header>
                    <Modal.Body>
                        <div>
                            {i18n._('key_ui/widgets/Connection/Connection_To continue, the machine needs to return to the start position of the X, Y, and Z axes.')}
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            priority="level-two"
                            className="align-r"
                            width="96px"
                            onClick={actions.clickHomeModalOk}
                        >
                            {i18n._('key_ui/widgets/Connection/Connection_OK')}
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
