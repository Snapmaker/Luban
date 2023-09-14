import type { Machine } from '@snapmaker/luban-platform';
import { WorkflowStatus } from '@snapmaker/luban-platform';
import classNames from 'classnames';
import { includes, map } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import {
    CONNECTION_STATUS_CONNECTED,
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_IDLE,
    CONNECTION_STATUS_REQUIRE_AUTH,
    CUSTOM_SERVER_NAME,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    IMAGE_WIFI_CONNECTED,
    IMAGE_WIFI_CONNECTING,
    IMAGE_WIFI_WAITING,
} from '../../../constants';
import {
    LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    findMachineByName,
    isDualExtruder
} from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { actions as workspaceActions } from '../../../flux/workspace';
import { MachineAgent } from '../../../flux/workspace/MachineAgent';
import connectActions from '../../../flux/workspace/actions-connect';
import discoverActions from '../../../flux/workspace/actions-discover';
import { ConnectionType } from '../../../flux/workspace/state';
import usePrevious from '../../../lib/hooks/previous';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { L20WLaserToolModule, L40WLaserToolModule } from '../../../machines/snapmaker-2-toolheads';
import { Button } from '../../components/Buttons';
import ModalSmall from '../../components/Modal/ModalSmall';
import ModalSmallInput from '../../components/Modal/ModalSmallInput';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import useThrottle from '../../utils/useThrottle';
import MachineModuleStatusBadge from './components/MachineModuleStatusBadge';
import LaserLockModal from './modals/LaserLockModal';
import MismatchModal from './modals/MismatchModal';
import MismatchNozzleModal from './modals/MismatchNozzleModal';
import styles from './styles.styl';


const ICON_COLOR_GREEN = '#4CB518';
const ICON_COLOR_RED = '#FF4D4F';

interface ConnectionMessage {
    text: string;
    title: string;
    img: string;
    iconColor: string;
    showCloseButton: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    onClose: () => void;
}

const useConnectionMessages = (): [
    (show: boolean) => void,
    (message: ConnectionMessage) => void,
    () => React.ReactElement,
] => {
    const [showMessage, setShowMessage] = useState(false);

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

    const renderMessage: () => React.ReactElement = useCallback(() => {
        if (!showMessage) {
            return null;
        }

        return (
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
        );
    }, [showMessage, connectionMessage]);

    return [
        setShowMessage,
        setConnectionMessage,
        renderMessage,
    ];
};


interface ModuleBriefStatus {
    moduleName: string;
    status: boolean;
}

const NetworkConnection: React.FC = () => {
    // connection
    const machineAgents = useSelector((state: RootState) => state.workspace.machineAgents) as MachineAgent[];

    const {
        machineDiscovering,
    } = useSelector((state: RootState) => state.workspace, shallowEqual);

    const dispatch = useDispatch();
    const onRefreshServers = useCallback(() => {
        dispatch(discoverActions.discoverNetworkedMachines());
    }, [dispatch]);

    const {
        savedServerAddress,
        savedServerName,
        manualIp,

        connectionType,
        connectionStatus,

        isOpen,
        isConnected,
    } = useSelector((state: RootState) => state.workspace, shallowEqual);

    const server: MachineAgent = useSelector((state: RootState) => state.workspace.server);

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
    const [
        setShowMessage,

        setConnectionMessage,
        renderMessage,
    ] = useConnectionMessages();

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
    const [selectedAgent, setSelectedAgent] = useState<MachineAgent | null>(null);
    const prevProps = usePrevious({
        connectionStatus
    });


    /**
     * Force close server.
     */
    const forceCloseServer = useCallback(() => {
        if (server) {
            dispatch(connectActions.disconnect(server, { force: true }));
        }
    }, [dispatch, server]);

    /**
     * Show Connection On-going.
     */
    const showRequireAuthMessage = useCallback(() => {
        setConnectionMessage({
            text: i18n._('key-Workspace/Connection-Confirm the Wi-Fi connection request on the Touchscreen.'),
            title: i18n._('key-Workspace/Connection-Screen Authorization Needed'),
            img: IMAGE_WIFI_CONNECTING,
            iconColor: ICON_COLOR_GREEN,
            onCancel: null,
            onConfirm: null,
            showCloseButton: true,
            onClose: () => {
                setShowMessage(false);

                forceCloseServer();
            },
        });
        setShowMessage(true);
    }, [forceCloseServer, setShowMessage, setConnectionMessage]);

    /**
     * Show Connection On-going.
     */
    const showConnectingMessage = useCallback(() => {
        setConnectionMessage({
            title: i18n._('Connecting'),
            text: i18n._('Connecting to the machine...'),
            img: 'WarningTipsTips',
            iconColor: ICON_COLOR_GREEN,
            onCancel: null,
            onConfirm: null,
            showCloseButton: true,
            onClose: () => {
                setShowMessage(false);

                forceCloseServer();
            },
        });
        setShowMessage(true);
    }, [forceCloseServer, setShowMessage, setConnectionMessage]);

    /**
     * Show Connection success message.
     */
    const showConnectionSuccessMessage = useCallback(() => {
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
        setShowMessage(true);
        setTimeout(() => {
            setShowMessage(false);
        }, 1000);
    }, [setShowMessage, setConnectionMessage]);

    /**
     * Show Connection disconnected message.
     */
    const showDisconnectMessage = useCallback(() => {
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
        setShowMessage(true);

        setTimeout(() => {
            setShowMessage(false);
        }, 1000);
    }, [setShowMessage, setConnectionMessage]);

    /**
     * Show Connection Error.
     */
    const showConnectionErrorMessage = useCallback((code: number | string, msg: string) => {
        let actualText = '';
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
                setShowMessage(false);
            },
        });
        setShowMessage(true);
    }, [setConnectionMessage, setShowMessage]);

    /**
     * Connect to machine.
     */
    const connect = useCallback(async () => {
        if (!selectedAgent) {
            return;
        }

        // connect to agent
        try {
            const { code, msg } = await dispatch(
                connectActions.connect(selectedAgent)
            ) as unknown as { code: number | string; msg: string; };

            if (msg) {
                // connection failed, clear saved state.
                showConnectionErrorMessage(code, msg);
            }
        } catch (e) {
            // connection cancelled
            log.info(e);
        }
    }, [dispatch, selectedAgent, showConnectionErrorMessage]);

    /**
     * Disconnect from machine
     */
    const disconnect = useCallback(() => {
        if (server) {
            dispatch(connectActions.disconnect(server));
        }
    }, [dispatch, server]);

    const onClickConnect = useThrottle(connect, 100);
    const onClickDisconnect = useThrottle(disconnect, 100);

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
                const newServer = MachineAgent.createManualAgent({
                    name: CUSTOM_SERVER_NAME,
                    address: text,
                });

                // Try add new server
                // TODO: refactor this
                const verifiedAgent: MachineAgent = dispatch(discoverActions.addAgent(newServer)) as unknown as MachineAgent;

                // set state server and then open it
                setSelectedAgent(verifiedAgent);

                // trigger connect
                // connect();
                // onClickConnect();
            }
        });
        setShowManualWiFiModal(true);
    }, [dispatch, manualIp, onCloseManualWiFi]);

    const onChangeAgentOption = useCallback((option) => {
        const found = machineAgents.find(v => v.name === option.name && v.address === option.address);
        if (found) {
            // dispatch(workspaceActions.connect.setSelectedServer(serverFound));
            setSelectedAgent(found);
        }
    }, [machineAgents]);

    /**
     * Find agent object in `agents` that matches `selected`, and set it
     * as `selectedAgent`.
     */
    const autoSetServer = useCallback((agents: MachineAgent[], selected: MachineAgent | null) => {
        let find: MachineAgent | undefined;
        if (selected) {
            find = agents.find(_server => _server.name === selected.name
                && _server.address === selected.address);
        }

        if (!find) {
            find = agents.find(v => v.address === savedServerAddress);
        }

        if (!find) {
            find = agents.find(v => v.name === savedServerName);
        }

        if (!find) {
            // Default select first server
            find = agents[0];
        }

        if (find && find !== selected) {
            setSelectedAgent(find);
        }
    }, [savedServerAddress, savedServerName]);

    useEffect(() => {
        autoSetServer(machineAgents, selectedAgent);
    }, [autoSetServer, machineAgents, selectedAgent]);

    // connection status changed, display corresponding dialog
    useEffect(() => {
        if (connectionType !== ConnectionType.WiFi) {
            return;
        }

        if (prevProps) {
            // -> Connecting
            if (prevProps.connectionStatus !== CONNECTION_STATUS_CONNECTING && connectionStatus === CONNECTION_STATUS_CONNECTING) {
                showConnectingMessage();
            }

            if (prevProps.connectionStatus !== CONNECTION_STATUS_REQUIRE_AUTH && connectionStatus === CONNECTION_STATUS_REQUIRE_AUTH) {
                showRequireAuthMessage();
            }

            // -> Connected
            if (prevProps.connectionStatus !== CONNECTION_STATUS_CONNECTED && connectionStatus === CONNECTION_STATUS_CONNECTED) {
                showConnectionSuccessMessage();
            }

            // -> IDLE, Disconnected
            if (prevProps.connectionStatus !== CONNECTION_STATUS_IDLE && connectionStatus === CONNECTION_STATUS_IDLE) {
                showDisconnectMessage();
            }
        }
    }, [
        prevProps,
        connectionType,
        connectionStatus,
        showConnectingMessage,
        showRequireAuthMessage,
        showConnectionSuccessMessage,
        showDisconnectMessage
    ]);

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
            if (toolHead) {
                switch (toolHead) {
                    case LEVEL_TWO_POWER_LASER_FOR_SM2: {
                        newModuleStatusList.push({
                            status: true,
                            moduleName: i18n._('key-Workspace/Connection-Laser-10W')
                        });
                        break;
                    }
                    case L20WLaserToolModule.identifier: {
                        newModuleStatusList.push({
                            status: true,
                            moduleName: i18n._('20W Laser Module')
                        });
                        break;
                    }
                    case L40WLaserToolModule.identifier: {
                        newModuleStatusList.push({
                            status: true,
                            moduleName: i18n._('40W Laser Module')
                        });
                        break;
                    }
                    default: {
                        newModuleStatusList.push({
                            status: true,
                            moduleName: i18n._('key-Workspace/Connection-Laser')
                        });
                        break;
                    }
                }
            }

            if (laserCamera) {
                newModuleStatusList.push({
                    moduleName: i18n._('key-Workspace/Connection-Laser camera'),
                    status: laserCamera
                });
            }
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
                            onChange={onChangeAgentOption}
                            disabled={isOpen}
                            options={map(machineAgents, (s) => ({
                                value: `${s.name}@${s.address}`,
                                name: s.name,
                                address: s.address,
                                label: `${s.name} (${s.address})`
                            }))}
                            placeholder={i18n._('key-Workspace/Connection-Choose a machine')}
                            value={`${selectedAgent?.name}@${selectedAgent?.address}`}
                        />
                        <div className="sm-flex-auto margin-left-4">
                            <SvgIcon
                                className={classNames(
                                    'border-default-black-5 border-radius-left-8',
                                    'margin-right-4'
                                )}
                                name={machineDiscovering ? 'Refresh' : 'Reset'}
                                title={i18n._('key-Workspace/Connection-Refresh')}
                                onClick={onRefreshServers}
                                disabled={isOpen || machineDiscovering}
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
                                {
                                    includes([WorkflowStatus.Unknown, WorkflowStatus.Idle], workflowStatus)
                                    && <i className="sm-icon-14 sm-icon-idle" />
                                }
                                {
                                    includes([WorkflowStatus.Paused, WorkflowStatus.Pausing], workflowStatus)
                                    && <i className="sm-icon-14 sm-icon-paused" />
                                }
                                {
                                    includes([WorkflowStatus.Running], workflowStatus)
                                    && <i className="sm-icon-14 sm-icon-running" />
                                }
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
                            onClick={onClickConnect}
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
                            onClick={onClickDisconnect}
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
                headType === HEAD_LASER && (
                    <LaserLockModal />
                )
            }
            {/* Connection Message */}
            {
                renderMessage()
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
