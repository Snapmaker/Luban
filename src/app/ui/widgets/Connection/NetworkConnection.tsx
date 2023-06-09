import classNames from 'classnames';
import { map } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import type { Machine } from '@snapmaker/luban-platform';

import {
    CONNECTION_STATUS_CONNECTED,
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_IDLE,
    CUSTOM_SERVER_NAME,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    IMAGE_WIFI_CONNECTED,
    IMAGE_WIFI_CONNECTING,
    IMAGE_WIFI_WAITING,
    WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATUS_UNKNOWN
} from '../../../constants';
import {
    findMachineByName,
    isDualExtruder,
    LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2
} from '../../../constants/machines';
import { actions as workspaceActions } from '../../../flux/workspace';
import { Server } from '../../../flux/workspace/Server';
import usePrevious from '../../../lib/hooks/previous';
import i18n from '../../../lib/i18n';

import { Button } from '../../components/Buttons';
import ModalSmall from '../../components/Modal/ModalSmall';
import ModalSmallInput from '../../components/Modal/ModalSmallInput';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';

import { RootState } from '../../../flux/index.def';
import { ConnectionType } from '../../../flux/workspace/state';
import MachineModuleStatusBadge from './components/MachineModuleStatusBadge';
import MismatchModal from './modals/MismatchModal';
import MismatchNozzleModal from './modals/MismatchNozzleModal';
import styles from './styles.styl';




const ICON_COLOR_GREEN = '#4CB518';
const ICON_COLOR_RED = '#FF4D4F';


interface ModuleBriefStatus {
    moduleName: string;
    status: boolean;
}

const NetworkConnection: React.FC = () => {
    const dispatch = useDispatch();

    // connection
    const {
        serverDiscovering,
        servers,

        savedServerAddress,
        savedServerName,
        savedServerToken,
        manualIp,

        connectionType,
        connectionStatus,

        server,

        isOpen,
        isConnected,
    } = useSelector((state: RootState) => state.workspace, shallowEqual);

    // connected machine
    const {
        machineIdentifier,
        headType,
        toolHead,
    } = useSelector((state: RootState) => state.workspace, shallowEqual);

    // machine state
    const {
        workflowStatus,
        moduleList,
        moduleStatusList,
        airPurifier,
        heatedBedTemperature,
        laserCamera,
    } = useSelector((state: RootState) => state.workspace, shallowEqual);

    // const [savedServerAddressState, setSavedServerAddressState] = useState(savedServerAddress);
    const {
        emergencyStopButton: emergencyStopButtonStatus,
        airPurifier: airPurifierStatus,
        rotaryModule: rotaryModuleStatus,
        enclosure: enclosureStatus
    } = moduleStatusList;

    // Show connection modal
    const [showConnectionMessage, setShowConnectionMessage] = useState(false);
    const [connectionMessage, setConnectionMessage] = useState({
        text: '',
        title: '',
        img: IMAGE_WIFI_WAITING,
        iconColor: ICON_COLOR_GREEN,
        showCloseButton: false,
        onCancel: null,
        onConfirm: null,
        onClose: null,
    });

    // Show manual connection modal, user can input IP address of printer
    const [showManualWiFiModal, setShowManualWiFiModal] = useState(false);

    // const [showMismatchModal, setShowMismatchModal] = useState(false);
    const [manualWiFi, setManualWiFi] = useState({
        text: '',
        inputtext: '',
        title: '',
        label: '',
        img: IMAGE_WIFI_CONNECTED,
        showCloseButton: false,
        onCancel: null,
        onConfirm: null
    });
    const [selectedServer, setSelectedServer] = useState<Server | null>(null);
    const [serverOpenState, setServerOpenState] = useState(null);
    const prevProps = usePrevious({
        connectionStatus
    });

    const onRefreshServers = useCallback(() => {
        dispatch(workspaceActions.discover.discoverSnapmakerServers());
    }, [dispatch]);

    /**
     * Force close server.
     */
    const forceCloseServer = useCallback(() => {
        if (server) {
            server.closeServerImproper();
        }

        setServerOpenState(null);
    }, [server]);

    /**
     * Show Connection On-going.
     */
    const showWifiConnecting = useCallback(() => {
        setConnectionMessage({
            text: i18n._('key-Workspace/Connection-Confirm the Wi-Fi connection request on the Touchscreen.'),
            title: i18n._('key-Workspace/Connection-Screen Authorization Needed'),
            img: IMAGE_WIFI_CONNECTING,
            iconColor: ICON_COLOR_GREEN,
            onCancel: null,
            onConfirm: null,
            showCloseButton: true,
            onClose: () => {
                setShowConnectionMessage(false);

                forceCloseServer();
            },
        });
        setShowConnectionMessage(true);
    }, [forceCloseServer]);

    /**
     * Show Connection established.
     */
    const showWifiConnected = useCallback(() => {
        setConnectionMessage({
            text: '',
            title: i18n._('key-Workspace/Connection-Connected'),
            img: 'WarningTipsSuccess',
            iconColor: ICON_COLOR_GREEN,
            onCancel: null,
            onConfirm: null,
            showCloseButton: false,
            onClose: null,
        });
        setShowConnectionMessage(true);
        setTimeout(() => {
            setShowConnectionMessage(false);
        }, 1000);
    }, []);

    /**
     * Show Connection disconnected.
     */
    const showWifiDisconnected = useCallback(() => {
        setConnectionMessage({
            text: i18n._(''),
            title: i18n._('key-Workspace/Connection-Disconnected'),
            img: 'WarningTipsError',
            iconColor: ICON_COLOR_RED,
            onCancel: null,
            onConfirm: null,
            showCloseButton: false,
            onClose: null,
        });
        setShowConnectionMessage(true);
        setTimeout(() => {
            setShowConnectionMessage(false);
        }, 1000);
    }, []);

    /**
     * Show Connection Error.
     */
    const showWifiError = useCallback((msg: string, text: string, code: number | string) => {
        let actualText = text;
        switch (code) {
            case 'EHOSTDOWN':
            case 'ENETUNREACH':
            case 'EADDRNOTAVAIL':
            case 'ECONNABORTED':
                actualText = i18n._('key-Workspace/Connection-Connection timed out. Please check your network settings.');
                break;
            case 403:
                actualText = i18n._('key-Workspace/Connection-Reason: The machine may be using an older version of firmware or may have other devices connected.');
                break;
            case 404:
            case 'ECONNRESET':
            case 'ENOTFOUND':
            case 'EACCES':
                actualText = i18n._('key-Workspace/Connection-Connection failed. The target machine actively refused your connection.  Please check if the input IP address is correct.');
                break;
            default:
                if (msg) {
                    actualText = i18n._(msg);
                }
        }
        setConnectionMessage({
            text: actualText,
            title: i18n._('key-Workspace/Connection-Connection Failed'),
            img: 'WarningTipsError',
            iconColor: ICON_COLOR_RED,
            onCancel: null,
            onConfirm: null,
            showCloseButton: true,
            onClose: () => {
                setShowConnectionMessage(false);
            },
        });
        setShowConnectionMessage(true);
    }, []);

    //
    // Open server
    //
    const openServer = useCallback(() => {
        if (!selectedServer) {
            return;
        }

        // update redux state
        dispatch(workspaceActions.connect.setSelectedServer(selectedServer));

        if (selectedServer.address === savedServerAddress) {
            selectedServer.setToken(savedServerToken);
        } else if (selectedServer.name === savedServerName) {
            // In case server address is re-allocated, check for saved server name
            selectedServer.setToken(savedServerToken);
        }

        selectedServer.openServer(({ msg, text, code }) => {
            if (msg) {
                // connection failed, clear saved state.
                showWifiError(msg, text, code);
                // setSavedServerAddressState('');
            }

            // Clear open state
            setServerOpenState(null);
        });
    }, [selectedServer, showWifiError]);

    const closeServer = useCallback(() => {
        if (server) {
            server.closeServer();
        }
    }, [server]);

    useEffect(() => {
        // Once serverOpenState is not null, trigger open
        if (serverOpenState) {
            openServer();
        }
    }, [serverOpenState]);

    /**
    * Hide manual Wi-Fi modal
    */
    const onCloseManualWiFi = useCallback(() => {
        setShowManualWiFiModal(false);
    }, []);

    /**
     * Show manual Wi-Fi modal
     */
    const onShowManualWiFiModal = useCallback(() => {
        setManualWiFi({
            text: null,
            title: i18n._('key-Workspace/Connection-Manual Connection'),
            label: i18n._('key-Workspace/Connection-IP Address') ? `${i18n._('key-Workspace/Connection-IP Address')}:` : '',
            // img: IMAGE_WIFI_WAITING,
            img: undefined,
            showCloseButton: true,
            inputtext: manualIp,
            onCancel: onCloseManualWiFi,
            onConfirm: (text) => {
                onCloseManualWiFi();

                dispatch(workspaceActions.connect.setManualIP(text));
                const newServer = new Server({
                    name: CUSTOM_SERVER_NAME,
                    address: text,
                    addByUser: true,
                });

                // Try add new server
                const verifiedServer = dispatch(workspaceActions.connect.addServer(newServer));

                // set state server and then open it
                setSelectedServer(verifiedServer);
                // setServerOpenState(verifiedServer);
                openServer();
            }
        });
        setShowManualWiFiModal(true);
    }, [dispatch, manualIp, onCloseManualWiFi]);

    const onChangeServerOption = useCallback((option) => {
        const serverFound = servers.find(v => v.name === option.name && v.address === option.address);
        if (serverFound) {
            // dispatch(workspaceActions.connect.setSelectedServer(serverFound));
            setSelectedServer(serverFound);
        }
    }, [servers]);

    /**
     * Find server object in `servers` that matches `this.props.server`, and set it
     * as `this.state.server`. If no matches found, set the first object as server.
     * `this.state.server` is used to be displayed in in dropdown menu.
     */
    const autoSetServer = useCallback((_servers: Server[], _selectedServer: Server | null) => {
        let find: Server | undefined;
        if (_selectedServer) {
            find = _servers.find(_server => _server.name === _selectedServer.name
                && _server.address === _selectedServer.address);
        }

        if (!find) {
            find = _servers.find(v => v.address === savedServerAddress);
        }

        if (!find) {
            find = _servers.find(v => v.name === savedServerName);
        }

        if (!find) {
            // Default select first server
            find = _servers[0];
        }

        if (find && find !== selectedServer) {
            setSelectedServer(find);
        }
    }, [savedServerAddress, savedServerName]);

    // servers changed
    useEffect(() => {
        autoSetServer(servers, selectedServer);
    }, [autoSetServer, servers, selectedServer]);

    // connection status changed, display corresponding dialog
    useEffect(() => {
        if (connectionType !== ConnectionType.WiFi) {
            return;
        }

        if (prevProps) {
            if (prevProps.connectionStatus !== CONNECTION_STATUS_CONNECTING && connectionStatus === CONNECTION_STATUS_CONNECTING) {
                showWifiConnecting();
            }
            if (prevProps.connectionStatus !== CONNECTION_STATUS_CONNECTED && connectionStatus === CONNECTION_STATUS_CONNECTED) {
                showWifiConnected();
            }
            if (prevProps.connectionStatus !== CONNECTION_STATUS_IDLE && connectionStatus === CONNECTION_STATUS_IDLE) {
                showWifiDisconnected();
            }
        }
    }, [connectionType, connectionStatus, showWifiConnecting, showWifiConnected, showWifiDisconnected]);

    // Machine
    const connectedMachine = useMemo<Machine | null>(() => {
        return findMachineByName(machineIdentifier);
    }, [machineIdentifier]);

    // Module status
    const moduleBriefStatusList = useMemo(() => {
        if (!isConnected) {
            return [];
        }

        const newModuleStatusList: ModuleBriefStatus[] = [];
        if (headType === HEAD_PRINTING) {
            if (isDualExtruder(toolHead)) {
                newModuleStatusList.push({
                    moduleName: i18n._('key-App/Settings/MachineSettings-Dual Extruder Toolhead'),
                    status: true
                });
            } else {
                newModuleStatusList.push({
                    moduleName: i18n._('key-App/Settings/MachineSettings-Single Extruder Toolhead'),
                    status: true
                });
            }
            newModuleStatusList.push({
                moduleName: i18n._('key-Workspace/Connection-Heated bed'),
                status: heatedBedTemperature > 0
            });
        }
        if (headType === HEAD_LASER) {
            if (toolHead && toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                newModuleStatusList.push({
                    status: true,
                    moduleName: i18n._('key-Workspace/Connection-Laser-10W')
                });
            } else {
                newModuleStatusList.push({
                    status: true,
                    moduleName: i18n._('key-Workspace/Connection-Laser')
                });
            }
            newModuleStatusList.push({
                moduleName: i18n._('key-Workspace/Connection-Laser camera'),
                status: laserCamera
            });
        }
        if (headType === HEAD_CNC) {
            if (toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2) {
                newModuleStatusList.push({
                    moduleName: i18n._('key-Workspace/High CNC'),
                    status: true
                });
            } else {
                newModuleStatusList.push({
                    moduleName: i18n._('key-Workspace/Connection-CNC'),
                    status: true
                });
            }
        }

        Object.keys(moduleStatusList).forEach((key) => {
            if (moduleStatusList[key]) {
                newModuleStatusList.push({
                    moduleName: i18n._(`key-Workspace/Connection-${key}`),
                    status: moduleStatusList[key]
                });
            } else {
                // compatible code
                if (key === 'airPurifier' && airPurifier) {
                    newModuleStatusList.push({
                        moduleName: i18n._('key-Workspace/Connection-airPurifier'),
                        status: moduleStatusList[key]
                    });
                }
            }
        });

        for (const moduleInfo of moduleList) {
            if (moduleInfo.moduleId === 519) {
                newModuleStatusList.push({
                    moduleName: i18n._('key-Workspace/Connection-Quick Swap Kit'),
                    status: moduleInfo.status,
                });
            }
        }

        return newModuleStatusList;
    }, [
        isConnected,
        moduleList,
        moduleStatusList,
        heatedBedTemperature,
        headType,
        toolHead,
        emergencyStopButtonStatus,
        airPurifier,
        airPurifierStatus,
        rotaryModuleStatus,
        enclosureStatus,
        laserCamera,
    ]);

    return (
        <div>
            {
                !isConnected && (
                    <div className="sm-flex justify-space-between margin-bottom-16">
                        <Select
                            backspaceRemoves={false}
                            className={classNames('sm-flex-width sm-flex-order-negative')}
                            clearable={false}
                            size="252px"
                            name="port"
                            noResultsText={i18n._('key-Workspace/Connection-No machines detected.')}
                            onChange={onChangeServerOption}
                            disabled={isOpen}
                            options={map(servers, (s) => ({
                                value: `${s.name}@${s.address}`,
                                name: s.name,
                                address: s.address,
                                label: `${s.name} (${s.address})`
                            }))}
                            placeholder={i18n._('key-Workspace/Connection-Choose a machine')}
                            value={`${selectedServer?.name}@${selectedServer?.address}`}
                        />
                        <div className="sm-flex-auto margin-left-4">
                            <SvgIcon
                                className={classNames(
                                    'border-default-black-5 border-radius-left-8',
                                    'margin-right-4'
                                )}
                                name={serverDiscovering ? 'Refresh' : 'Reset'}
                                title={i18n._('key-Workspace/Connection-Refresh')}
                                onClick={onRefreshServers}
                                disabled={isOpen}
                                size={24}
                                borderRadius={8}
                            />
                            <SvgIcon
                                className={classNames(
                                    'border-default-black-5 border-radius-left-8',
                                    // className="border-default-black-5 border-radius-right-8"
                                )}
                                name="Add"
                                title={i18n._('key-Workspace/Connection-Add')}
                                disabled={isOpen}
                                size={24}
                                borderRadius={8}
                                onClick={onShowManualWiFiModal}
                            />
                        </div>
                    </div>
                )
            }
            {
                isConnected && server && connectedMachine && (
                    <div className="margin-bottom-16 margin-top-12">
                        <div
                            className={classNames(styles['connection-state'], 'padding-bottom-8', 'border-bottom-dashed-default')}
                        >
                            <span className="main-text-normal max-width-304 text-overflow-ellipsis display-inline">
                                {`${server?.name} (${connectedMachine.fullName})`}
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
                        {/* Render status badge for each machine module */}
                        {
                            moduleBriefStatusList.length > 0 && (
                                <div className="sm-flex sm-flex-wrap">
                                    {
                                        moduleBriefStatusList.map(item => (
                                            <MachineModuleStatusBadge
                                                key={item.moduleName}
                                                moduleName={item.moduleName}
                                                status={item.status}
                                            />
                                        ))
                                    }
                                </div>
                            )
                        }
                    </div>
                )
            }
            <div className="sm-flex align-flex-end">
                {
                    !isConnected && (
                        <Button
                            className="margin-right-8"
                            width="120px"
                            type="primary"
                            priority="level-two"
                            onClick={openServer}
                            disabled={isOpen}
                        >
                            {i18n._('key-Workspace/Connection-Connect')}
                        </Button>
                    )
                }
                {
                    isConnected && (
                        <Button
                            width="120px"
                            type="default"
                            priority="level-two"
                            onClick={closeServer}
                        >
                            {i18n._('key-Workspace/Connection-Disconnect')}
                        </Button>
                    )
                }
            </div>
            {/* Mismatch Modal */}
            <MismatchModal />
            {/* Mismatch Nozzle Size Modal */}
            {
                headType === HEAD_PRINTING && (
                    <MismatchNozzleModal />
                )
            }
            {
                showConnectionMessage && (
                    <ModalSmall
                        showCloseButton={connectionMessage.showCloseButton}
                        img={connectionMessage.img}
                        iconColor={connectionMessage?.iconColor}
                        text={connectionMessage.text}
                        title={connectionMessage.title}
                        onClose={connectionMessage.onClose}
                        onCancel={connectionMessage.onCancel}
                        onConfirm={connectionMessage.onConfirm}
                    />
                )
            }
            {
                showManualWiFiModal && (
                    <ModalSmallInput
                        showCloseButton={manualWiFi.showCloseButton}
                        text={manualWiFi.text}
                        title={manualWiFi.title}
                        label={manualWiFi.label}
                        inputtext={manualWiFi.inputtext}
                        onClose={onCloseManualWiFi}
                        onCancel={manualWiFi.onCancel}
                        onConfirm={manualWiFi.onConfirm}
                    />
                )
            }
        </div>
    );
};

export default NetworkConnection;
