import React, { useEffect, useState } from 'react';
// import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { map } from 'lodash';
// import { InputGroup } from 'react-bootstrap';
import { Button } from '../../components/Buttons';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';
import usePrevious from '../../../lib/hooks/previous';
import { actions as machineActions } from '../../../flux/machine';
import {
    ABSENT_OBJECT,
    CONNECTION_STATUS_CONNECTED,
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_IDLE,
    CONNECTION_TYPE_WIFI, HEAD_LASER, HEAD_PRINTING,
    IMAGE_WIFI_CONNECTED,
    IMAGE_WIFI_CONNECTING,
    // IMAGE_WIFI_ERROR,
    IMAGE_WIFI_WAITING,
    WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATUS_UNKNOWN
} from '../../../constants';
import widgetStyles from '../styles.styl';
import styles from './index.styl';
import PrintingState from './PrintingState';
import LaserState from './LaserState';
import ModalSmall from '../../components/Modal/ModalSmall';
import ModalSmallInput from '../../components/Modal/ModalSmallInput';
import { Server } from '../../../flux/machine/Server';

function WifiConnection() {
    const {
        servers,
        serverDiscovering,

        connectionType,
        connectionStatus,
        server,
        savedServerAddress,
        manualIp,
        // machine status
        headType, workflowStatus, isOpen, isConnected
    } = useSelector(state => state.machine);
    const [showConnectionMessage, setShowConnectionMessage] = useState(false);
    const [connectionMessage, setConnectionMessage] = useState({
        text: '',
        title: '',
        img: IMAGE_WIFI_WAITING,
        showCloseButton: false,
        onCancel: null,
        onConfirm: null
    });
    const [showManualWiFiModal, setShowManualWiFiModal] = useState(false);
    const [manualWiFi, setManualWiFi] = useState({
        text: '',
        title: '',
        label: '',
        img: IMAGE_WIFI_CONNECTED,
        showCloseButton: false,
        onCancel: null,
        onConfirm: null
    });
    const [serverState, setServerState] = useState(null);
    const [serverOpenState, setserverOpenState] = useState(null);
    const dispatch = useDispatch();
    const prevProps = usePrevious({
        connectionStatus
    });

    const actions = {
        onRefreshServers: () => {
            dispatch(machineActions.discover.discoverSnapmakerServers());
        },
        onChangeServerOption: (option) => {
            const serverFound = servers.find(v => v.name === option.value && v.address === option.address);
            if (serverFound) {
                dispatch(machineActions.connect.setSelectedServer(serverFound));
                setServerState(serverFound);
            }
        },
        openServer: () => {
            dispatch(machineActions.connect.setSelectedServer(serverState));
            dispatch(machineActions.openServer((err, data, text) => {
                if (err) {
                    actions.showWifiError(err, text);
                }
            }));
        },
        closeServer: () => {
            dispatch(machineActions.closeServer());
        },
        hideWifiConnectionMessage: () => {
            setShowConnectionMessage(false);
        },
        showWifiConnecting: () => {
            setConnectionMessage({
                text: i18n._('key_ui/widgets/Connection/WifiConnection_Confirm the Wi-Fi connection request on the Touchscreen.'),
                title: i18n._('key_ui/widgets/Connection/WifiConnection_Screen Authorization Needed'),
                img: IMAGE_WIFI_CONNECTING,
                showCloseButton: true,
                onCancel: null,
                onConfirm: null
            });
            setShowConnectionMessage(true);
        },
        showWifiConnected: () => {
            setConnectionMessage({
                text: '',
                title: i18n._('key_ui/widgets/Connection/WifiConnection_Connected'),
                img: 'WarningTipsSuccess',
                showCloseButton: false,
                iconColor: '#4CB518',
                onCancel: null,
                onConfirm: null
            });
            setShowConnectionMessage(true);
            setTimeout(() => {
                actions.hideWifiConnectionMessage();
            }, 1000);
        },
        showWifiDisconnected: () => {
            setConnectionMessage({
                text: i18n._(''),
                title: i18n._('key_ui/widgets/Connection/WifiConnection_Disconnected'),
                img: 'WarningTipsError',
                iconColor: '#FF4D4F',
                showCloseButton: false,
                onCancel: null,
                onConfirm: null
            });
            setShowConnectionMessage(true);
            setTimeout(() => {
                actions.hideWifiConnectionMessage();
            }, 1000);
        },
        showWifiError: (err, data) => {
            setConnectionMessage({
                text: i18n._(data || err.message),
                title: err.status ? i18n._(`Error ${err.status}`) : i18n._('key_ui/widgets/Connection/WifiConnection_Error'),
                img: 'WarningTipsError',
                iconColor: '#FF4D4F',
                showCloseButton: true,
                onCancel: null,
                onConfirm: null
            });
            setShowConnectionMessage(true);
        },
        onCloseWifiConnectionMessage: () => {
            actions.hideWifiConnectionMessage();
            actions.closeServer();
        },

        /**
         * Show manual Wi-Fi modal
         */
        showManualWiFiModal: () => {
            setManualWiFi({
                text: null,
                title: i18n._('key_ui/widgets/Connection/WifiConnection_Manual Connection'),
                label: i18n._('key_ui/widgets/Connection/WifiConnection_IP Address') ? `${i18n._('key_ui/widgets/Connection/WifiConnection_IP Address')}:` : '',
                // img: IMAGE_WIFI_WAITING,
                showCloseButton: true,
                inputtext: manualIp,
                onCancel: actions.onCloseManualWiFi,
                onConfirm: (text) => {
                    actions.onCloseManualWiFi();

                    dispatch(machineActions.connect.setManualIP(text));
                    const newServer = new Server('Manual', text);

                    // Try add new server
                    const _server = dispatch(machineActions.connect.addServer(newServer));

                    // set state server and then open it
                    setServerState(_server);
                    setserverOpenState(_server);
                }
            });
            setShowManualWiFiModal(true);
        },
        /**
         * Hide manual Wi-Fi modal
         */
        onCloseManualWiFi: () => {
            setShowManualWiFiModal(false);
        }
    };

    /**
     * Find server object in `servers` that matches `this.props.server`, and set it
     * as `this.state.server`. If no matches found, set the first object as server.
     * `this.state.server` is used to be displayed in in dropdown menu.
     *
     * @param _servers - list of server objects
     * @param selectedServer - selected server
     */
    function autoSetServer(_servers, selectedServer) {
        let find;
        if (selectedServer !== ABSENT_OBJECT) {
            find = _servers.find(v => v.name === selectedServer.name && v.address === selectedServer.address);
        } else {
            // If no server selected, we select server based on saved server address
            find = _servers.find(v => v.address === savedServerAddress);
        }

        if (find) {
            setServerState(find);
        } else if (_servers.length > 0) {
            // Default select first server
            const firstServer = _servers[0];
            setServerState(firstServer);
        }
    }

    useEffect(() => {
        // Discover servers on mounted
        actions.onRefreshServers();
    }, []);

    useEffect(() => {
        if (serverOpenState) {
            actions.openServer();
        }
    }, [serverOpenState]);

    useEffect(() => {
        autoSetServer(servers, server);
    }, [servers, server]);

    useEffect(() => {
        if (connectionType === CONNECTION_TYPE_WIFI) {
            if (prevProps) {
                if (prevProps.connectionStatus !== CONNECTION_STATUS_CONNECTING && connectionStatus === CONNECTION_STATUS_CONNECTING) {
                    actions.showWifiConnecting();
                }
                if (prevProps.connectionStatus !== CONNECTION_STATUS_CONNECTED && connectionStatus === CONNECTION_STATUS_CONNECTED) {
                    actions.showWifiConnected();
                }
                if (prevProps.connectionStatus !== CONNECTION_STATUS_IDLE && connectionStatus === CONNECTION_STATUS_IDLE) {
                    actions.showWifiDisconnected();
                }
            }
        }
    }, [connectionType, connectionStatus]);

    return (
        <div>
            <div className="sm-flex justify-space-between margin-bottom-16">
                {/** https://react-select.com/upgrade-guide#new-components-api **/}
                <Select
                    backspaceRemoves={false}
                    className={classNames('sm-flex-width sm-flex-order-negative')}
                    clearable={false}
                    size="256px"
                    name="port"
                    noResultsText={i18n._('key_ui/widgets/Connection/WifiConnection_No machines detected.')}
                    onChange={actions.onChangeServerOption}
                    disabled={isOpen}
                    options={map(servers, (s) => ({
                        value: s.name,
                        address: s.address,
                        label: `${s.name} (${s.address})`
                    }))}
                    placeholder={i18n._('key_ui/widgets/Connection/WifiConnection_Choose a machine')}
                    value={serverState ? serverState?.name : ''}
                />
                <div className="sm-flex-auto ">
                    <SvgIcon
                        className="border-default-black-5 margin-left-8 border-radius-left-8"
                        name={serverDiscovering ? 'Refresh' : 'Reset'}
                        title={i18n._('key_ui/widgets/Connection/WifiConnection_Refresh')}
                        onClick={actions.onRefreshServers}
                        disabled={isOpen}
                        size={24}
                        borderRadius={8}
                    />
                    <SvgIcon
                        className="border-default-black-5 border-radius-right-8"
                        name="Add"
                        title={i18n._('key_ui/widgets/Connection/WifiConnection_Add')}
                        disabled={isOpen}
                        size={24}
                        borderRadius={8}
                        onClick={actions.showManualWiFiModal}
                    />
                </div>
            </div>
            {isConnected && (
                <div className="margin-bottom-16">
                    <div
                        className={styles['connection-state']}
                    >
                        <span className={styles['connection-state-name']}>
                            {serverState?.name}
                        </span>
                        <span className={styles['connection-state-icon']}>
                            {workflowStatus === WORKFLOW_STATUS_UNKNOWN
                            && <i className="sm-icon-14 sm-icon-idle" />}
                            {workflowStatus === WORKFLOW_STATUS_IDLE
                            && <i className="sm-icon-14 sm-icon-idle" />}
                            {workflowStatus === WORKFLOW_STATUS_PAUSED
                            && <i className="sm-icon-14 sm-icon-paused" />}
                            {workflowStatus === WORKFLOW_STATUS_RUNNING
                            && <i className="sm-icon-14 sm-icon-running" />}
                        </span>
                    </div>
                    <div
                        className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])}
                        style={{
                            marginTop: '10px'
                        }}
                    />
                    {headType === HEAD_PRINTING && <PrintingState headType={headType} />}
                    {headType === HEAD_LASER && <LaserState headType={headType} />}
                </div>
            )}
            <div>
                {!isConnected && (
                    <Button
                        width="120px"
                        type="primary"
                        priority="level-two"
                        onClick={actions.openServer}
                        disabled={isOpen}
                    >
                        {i18n._('key_ui/widgets/Connection/WifiConnection_Connect')}
                    </Button>
                )}
                {isConnected && (
                    <Button
                        width="120px"
                        type="default"
                        priority="level-two"
                        onClick={actions.closeServer}
                    >
                        {i18n._('key_ui/widgets/Connection/WifiConnection_Disconnect')}
                    </Button>
                )}
            </div>
            {showConnectionMessage && (
                <ModalSmall
                    showCloseButton={connectionMessage.showCloseButton}
                    img={connectionMessage.img}
                    iconColor={connectionMessage?.iconColor}
                    text={connectionMessage.text}
                    title={connectionMessage.title}
                    onClose={actions.onCloseWifiConnectionMessage}
                    onCancel={connectionMessage.onCancel}
                    onConfirm={connectionMessage.onConfirm}
                />
            )}
            {showManualWiFiModal && (
                <ModalSmallInput
                    showCloseButton={manualWiFi.showCloseButton}
                    text={manualWiFi.text}
                    title={manualWiFi.title}
                    label={manualWiFi.label}
                    inputtext={manualWiFi.inputtext}
                    onClose={actions.onCloseManualWiFi}
                    onCancel={manualWiFi.onCancel}
                    onConfirm={manualWiFi.onConfirm}
                />
            )}
        </div>
    );
}
WifiConnection.propTypes = {
};

export default WifiConnection;
