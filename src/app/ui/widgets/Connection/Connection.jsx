import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI, PROTOCOL_TEXT } from '../../../constants';
import { MACHINE_SERIES } from '../../../constants/machines';
import { actions as machineActions } from '../../../flux/machine';
import { controller } from '../../../lib/controller';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';
import Notifications from '../../components/Notifications';

import SerialConnection from './SerialConnection';
import WifiConnection from './WifiConnection';


function Connection({ widgetId, widgetActions }) {
    const dispatch = useDispatch();
    const { widgets } = useSelector(state => state.widget);

    const dataSource = widgets[widgetId].dataSource;
    const { connectionType, isConnected, series, isHomed } = useSelector(state => state.machine);

    const [alertMessage, setAlertMessage] = useState('');
    const [showHomeReminder, setShowHomeReminder] = useState(false);
    const [homing, setHoming] = useState(false);

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

    useEffect(() => {
        controller.subscribeDiscover(!isConnected);
        return () => {
            controller.subscribeDiscover(false);
        };
    }, [isConnected]);

    const isOriginal = series === MACHINE_SERIES.ORIGINAL.value;

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
                )
            }
            {
                connectionType === CONNECTION_TYPE_SERIAL && (
                    <SerialConnection dataSource={dataSource} />
                )
            }
            {
                connectionType === CONNECTION_TYPE_WIFI && (
                    <WifiConnection />
                )
            }

            {/* Go Home Dialog */}
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
