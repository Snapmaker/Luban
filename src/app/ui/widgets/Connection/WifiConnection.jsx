import classNames from 'classnames';
import { map } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import {
    ABSENT_OBJECT,
    CONNECTION_STATUS_CONNECTED,
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_IDLE,
    CONNECTION_TYPE_WIFI,
    CUSTOM_SERVER_NAME,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    IMAGE_WIFI_CONNECTED,
    IMAGE_WIFI_CONNECTING,
    IMAGE_WIFI_WAITING,
    LEFT_EXTRUDER,
    PRINTING_MANAGER_TYPE_EXTRUDER,
    RIGHT_EXTRUDER,
    WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATUS_UNKNOWN,
} from '../../../constants';
import {
    findMachineByName,
    isDualExtruder,
    LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
} from '../../../constants/machines';
import { actions as machineActions } from '../../../flux/machine';
import { actions as workspaceActions } from '../../../flux/workspace';
import { Server } from '../../../flux/workspace/Server';
import { actions as printingActions } from '../../../flux/printing';
import usePrevious from '../../../lib/hooks/previous';
import i18n from '../../../lib/i18n';

import { Button } from '../../components/Buttons';
import Checkbox from '../../components/Checkbox';
import Modal from '../../components/Modal';
import ModalSmall from '../../components/Modal/ModalSmall';
import ModalSmallInput from '../../components/Modal/ModalSmallInput';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';

import MachineModuleStatusBadge from './components/MachineModuleStatusBadge';
import styles from './styles.styl';
import MismatchModal from './MismatchModal';


let timer = null;

function CheckingNozzleSize() {
    const { toolHead } = useSelector(state => state?.workspace);
    const { nozzleSizeList, isConnected } = useSelector(state => state?.machine);
    const extruderLDefinition = useSelector(
        (state) => state?.printing?.extruderLDefinition
    );
    const extruderRDefinition = useSelector(
        (state) => state?.printing?.extruderRDefinition
    );
    const leftDiameter = extruderLDefinition?.settings
        ?.machine_nozzle_size?.default_value;
    const rightDiameter = extruderRDefinition?.settings
        ?.machine_nozzle_size?.default_value;
    const [showNozzleModal, setshowNozzleModal] = useState(false);
    const dispatch = useDispatch();

    function hideNozzleModal() {
        setshowNozzleModal(false);
    }

    function setDiameter(direction, value) {
        const def = direction === LEFT_EXTRUDER
            ? extruderLDefinition
            : extruderRDefinition;
        // def.settings.machine_nozzle_size.default_value = value;
        dispatch(
            printingActions.updateCurrentDefinition({
                definitionModel: def,
                managerDisplayType: PRINTING_MANAGER_TYPE_EXTRUDER,
                direction,
                changedSettingArray: [
                    ['machine_nozzle_size', value],
                ],
            })
        );
    }

    useEffect(() => {
        if (isConnected) {
            if (isDualExtruder(toolHead)
                && ((nozzleSizeList[0] && leftDiameter && nozzleSizeList[0] !== leftDiameter)
                    || nozzleSizeList[1] && rightDiameter && (nozzleSizeList[1] !== rightDiameter))) {
                if (nozzleSizeList[0] !== leftDiameter) {
                    setDiameter(LEFT_EXTRUDER, nozzleSizeList[0]);
                }
                if (nozzleSizeList[1] !== rightDiameter) {
                    setDiameter(RIGHT_EXTRUDER, nozzleSizeList[1]);
                }
                setshowNozzleModal(true);
            } else if (toolHead === SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2 && nozzleSizeList[0] && leftDiameter && nozzleSizeList[0] !== leftDiameter) {
                setDiameter(LEFT_EXTRUDER, nozzleSizeList[0]);
                setshowNozzleModal(true);
            }
        }
    }, [isConnected, toolHead, nozzleSizeList]);

    return (
        <div>
            {showNozzleModal && (
                <Modal
                    showCloseButton
                    onClose={hideNozzleModal}
                    style={{
                        borderRadius: '8px'
                    }}
                >
                    <Modal.Header>
                        {i18n._('key-Workspace/Mismatch-Synchronize_Nozzle_Diameter')}
                    </Modal.Header>
                    <Modal.Body style={{
                        maxWidth: '432px'
                    }}
                    >
                        {i18n._('key-Workspace/Mismatch-The configured Nozzle Diameter ({{diameterInfo}}) is inconsistent with that of the connected machine ({{connectedDameterInfo}}). Luban has updated the configuration to be consistent with the machine nozzle.',
                            {
                                diameterInfo: isDualExtruder(toolHead) ? `L: ${leftDiameter}mm; R: ${rightDiameter}mm` : `L: ${leftDiameter}mm`,
                                connectedDameterInfo: isDualExtruder(toolHead) ? `L: ${nozzleSizeList[0]}mm; R: ${nozzleSizeList[1]}mm` : `L: ${nozzleSizeList[0]}mm`,
                            })}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            priority="level-two"
                            className="margin-left-8"
                            width="96px"
                            onClick={hideNozzleModal}
                        >
                            {i18n._('key-Modal/Common-Confirm')}
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}
        </div>
    );
}

function WifiConnection() {
    const dispatch = useDispatch();

    const {
        connectionType,
        connectionStatus,
        connectionAuto,
        server,
        savedServerAddress,
        savedServerName,
        // savedServerAddressIsAuto,
        savedServerToken,
        manualIp,
        // machine status headType,
        workflowStatus, isOpen, isConnected,
        moduleStatusList,
        airPurifier,
        // airPurifierStatus,
        heatedBedTemperature,
        laserCamera,
    } = useSelector(state => state.machine, shallowEqual);

    const {
        serverDiscovering,
        servers,
    } = useSelector(state => state.workspace, shallowEqual);

    const {
        toolHead, headType, series
    } = useSelector(state => state?.workspace);

    // const [savedServerAddressState, setSavedServerAddressState] = useState(savedServerAddress);
    const { emergencyStopButton: emergencyStopButtonStatus, airPurifier: airPurifierStatus, rotaryModule: rotaryModuleStatus, enclosure: enclosureStatus } = moduleStatusList;

    // Show connection modal
    const [showConnectionMessage, setShowConnectionMessage] = useState(false);
    const [connectionMessage, setConnectionMessage] = useState({
        text: '',
        title: '',
        img: IMAGE_WIFI_WAITING,
        showCloseButton: false,
        onCancel: null,
        onConfirm: null
    });

    // Show manual connection modal, user can input IP address of printer
    const [showManualWiFiModal, setShowManualWiFiModal] = useState(false);

    // const [showMismatchModal, setShowMismatchModal] = useState(false);
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
    const [serverOpenState, setServerOpenState] = useState(null);
    const [currentModuleStatusList, setCurrentModuleStatusList] = useState([]);
    const prevProps = usePrevious({
        connectionStatus
    });

    const actions = {
        onRefreshServers: () => {
            dispatch(machineActions.discover.discoverSnapmakerServers());
        },
        onChangeServerOption: (option) => {
            const serverFound = servers.find(v => v.name === option.name && v.address === option.address);
            if (serverFound) {
                dispatch(workspaceActions.connect.setSelectedServer(serverFound));
                setServerState(serverFound);
            }
        },
        openServer: () => {
            dispatch(workspaceActions.connect.setSelectedServer(serverState));

            if (serverState.address === savedServerAddress) {
                serverState.setToken(savedServerToken);
            } else if (serverState.name === savedServerName) {
                // In case server address is re-allocated, check for saved server name
                serverState.setToken(savedServerToken);
            }

            serverState.openServer(({ msg, text, code }) => {
                if (msg) {
                    // connection failed, clear saved state.
                    actions.showWifiError(msg, text, code);
                    // setSavedServerAddressState('');
                }

                // Clear open state
                setServerOpenState(null);
            });
        },
        closeServer: () => {
            server.closeServer && server.closeServer();
            // setSavedServerAddressState('');
        },
        closeServerImproper: () => {
            server.closeServerImproper();
            // setSavedServerAddressState('');

            setServerOpenState(null);
        },
        hideWifiConnectionMessage: () => {
            setShowConnectionMessage(false);
        },
        showWifiConnecting: () => {
            setConnectionMessage({
                text: i18n._('key-Workspace/Connection-Confirm the Wi-Fi connection request on the Touchscreen.'),
                title: i18n._('key-Workspace/Connection-Screen Authorization Needed'),
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
                title: i18n._('key-Workspace/Connection-Connected'),
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
                title: i18n._('key-Workspace/Connection-Disconnected'),
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
        showWifiError: (msg, text, code) => {
            let actualText = text;
            switch (code) {
                case 'EHOSTDOWN':
                case 'ENETUNREACH':
                case 'EADDRNOTAVAIL':
                case 'ECONNABORTED':
                    actualText = i18n._('key-Workspace/Connection-Connection timed out. Please check your network settings.');
                    break;
                case 403:
                    actualText = i18n._('key-Workspace/Connection-Connection failed. The machine has been connected to other device.');
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
                title: i18n._('key-Workspace/Connection-Error'),
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

            if (connectionStatus === CONNECTION_STATUS_CONNECTING) {
                actions.closeServerImproper();
            }
        },

        /**
         * Show manual Wi-Fi modal
         */
        showManualWiFiModal: () => {
            setManualWiFi({
                text: null,
                title: i18n._('key-Workspace/Connection-Manual Connection'),
                label: i18n._('key-Workspace/Connection-IP Address') ? `${i18n._('key-Workspace/Connection-IP Address')}:` : '',
                // img: IMAGE_WIFI_WAITING,
                showCloseButton: true,
                inputtext: manualIp,
                onCancel: actions.onCloseManualWiFi,
                onConfirm: (text) => {
                    dispatch(workspaceActions.connect.setManualIP(text));
                    const newServer = new Server({
                        name: CUSTOM_SERVER_NAME,
                        address: text,
                        addByUser: true,
                    });

                    // Try add new server
                    const verifiedServer = dispatch(workspaceActions.connect.addServer(newServer));

                    // set state server and then open it
                    setServerState(verifiedServer);
                    setServerOpenState(verifiedServer);
                    actions.onCloseManualWiFi();
                }
            });
            setShowManualWiFiModal(true);
        },
        /**
         * Hide manual Wi-Fi modal
         */
        onCloseManualWiFi: () => {
            setShowManualWiFiModal(false);
        },
        handleAutoConnection: (value) => {
            dispatch(workspaceActions.connect.setConnectionAuto(value));
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

        if (find) {
            setServerState(find);
        }
    }

    useEffect(() => {
        if (isConnected) {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        } else {
            if (!connectionAuto) {
                autoSetServer(servers, server);
                if (timer) {
                    clearInterval(timer);
                    timer = null;
                }
            }
        }
    }, [connectionAuto, isConnected]);

    useEffect(() => {
        if (serverOpenState) {
            actions.openServer();
        }
    }, [serverOpenState]);

    useEffect(() => {
        autoSetServer(servers, server);
    }, [JSON.stringify(servers), server]);

    /*
    // Auto connect
    useEffect(() => {
        if (serverState?.address === savedServerAddressState && connectionAuto && !isConnected && savedServerAddressIsAuto) {
            if (serverOpenState) {
                return;
            }
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            actions.openServer();
        }
    }, [serverState, savedServerAddressState, savedServerAddressIsAuto, serverOpenState]);
    */

    // connection status changed, display corresponding dialog
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

    const updateModuleStatusList = useMemo(() => {
        const newModuleStatusList = [];
        if (headType === HEAD_PRINTING) {
            if (isDualExtruder(toolHead)) {
                newModuleStatusList.push({
                    key: 'headtype',
                    moduleName: i18n._('key-App/Settings/MachineSettings-Dual Extruder Toolhead'),
                    status: true
                });
            } else {
                newModuleStatusList.push({
                    key: 'headtype',
                    moduleName: i18n._('key-App/Settings/MachineSettings-Single Extruder Toolhead'),
                    status: true
                });
            }
            newModuleStatusList.push({
                key: 'heatedBed',
                moduleName: i18n._('key-Workspace/Connection-Heated bed'),
                status: heatedBedTemperature > 0
            });
        }
        if (headType === HEAD_LASER) {
            if (toolHead && toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                newModuleStatusList.push({
                    key: `${headType}-${toolHead}`,
                    status: true,
                    moduleName: i18n._('key-Workspace/Connection-10W Laser')
                });
            } else {
                newModuleStatusList.push({
                    key: `${headType}-${toolHead}`,
                    status: true,
                    moduleName: i18n._('key-Workspace/Connection-laser')
                });
            }
            newModuleStatusList.push({
                key: 'laserCamera',
                moduleName: i18n._('key-Workspace/Connection-Laser camera'),
                status: laserCamera
            });
        }
        if (headType === HEAD_CNC) {
            if (toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2) {
                newModuleStatusList.push({
                    key: 'headtype',
                    moduleName: i18n._('key-Workspace/High CNC'),
                    status: true
                });
            } else {
                newModuleStatusList.push({
                    key: 'headtype',
                    moduleName: i18n._('key-Workspace/Connection-CNC'),
                    status: true
                });
            }
        }
        Object.keys(moduleStatusList).forEach((key) => {
            if (moduleStatusList[key]) {
                newModuleStatusList.push({
                    key,
                    moduleName: i18n._(`key-Workspace/Connection-${key}`),
                    status: moduleStatusList[key]
                });
            } else {
                if (key === 'airPurifier' && airPurifier) {
                    newModuleStatusList.push({
                        key,
                        moduleName: i18n._('key-Workspace/Connection-airPurifier'),
                        status: moduleStatusList[key]
                    });
                }
            }
        });
        return newModuleStatusList;
    }, [
        airPurifier, heatedBedTemperature, headType, toolHead,
        emergencyStopButtonStatus, airPurifierStatus, rotaryModuleStatus,
        enclosureStatus, laserCamera, toolHead
    ]);

    useEffect(() => {
        if (!isConnected) {
            setCurrentModuleStatusList([]);
        } else {
            setCurrentModuleStatusList(updateModuleStatusList);
        }
    }, [isConnected, updateModuleStatusList]);

    const machine = series && findMachineByName(series) || {};

    return (
        <div>
            {!isConnected && (
                <div className="sm-flex justify-space-between margin-bottom-16">
                    <Select
                        backspaceRemoves={false}
                        className={classNames('sm-flex-width sm-flex-order-negative')}
                        clearable={false}
                        size="256px"
                        name="port"
                        noResultsText={i18n._('key-Workspace/Connection-No machines detected.')}
                        onChange={actions.onChangeServerOption}
                        disabled={isOpen}
                        options={map(servers, (s) => ({
                            value: `${s.name}@${s.address}`,
                            name: s.name,
                            address: s.address,
                            label: `${s.name} (${s.address})`
                        }))}
                        placeholder={i18n._('key-Workspace/Connection-Choose a machine')}
                        value={`${serverState?.name}@${serverState?.address}`}
                    />
                    <div className="sm-flex-auto ">
                        <SvgIcon
                            className="border-default-black-5 margin-left-8 border-radius-left-8"
                            name={serverDiscovering ? 'Refresh' : 'Reset'}
                            title={i18n._('key-Workspace/Connection-Refresh')}
                            onClick={actions.onRefreshServers}
                            disabled={isOpen}
                            size={24}
                            borderRadius={8}
                        />
                        <SvgIcon
                            className="border-default-black-5 border-radius-right-8"
                            name="Add"
                            title={i18n._('key-Workspace/Connection-Add')}
                            disabled={isOpen}
                            size={24}
                            borderRadius={8}
                            onClick={actions.showManualWiFiModal}
                        />
                    </div>
                </div>
            )}
            {/* Mismatch Modal */}
            <MismatchModal />
            {headType === HEAD_PRINTING && (
                <CheckingNozzleSize />
            )}
            {isConnected && series && (
                <div className="margin-bottom-16 margin-top-12">
                    <div
                        className={classNames(styles['connection-state'], 'padding-bottom-8', 'border-bottom-dashed-default')}
                    >
                        <span className="main-text-normal max-width-304 text-overflow-ellipsis display-inline">
                            {`${serverState?.name} (${machine.fullName})`}
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
                    {!!currentModuleStatusList && !!currentModuleStatusList.length && (
                        <div className="sm-flex sm-flex-wrap">
                            {
                                currentModuleStatusList.map(item => (
                                    <MachineModuleStatusBadge
                                        key={item.moduleName}
                                        moduleName={item.moduleName}
                                        status={item.status}
                                    />
                                ))
                            }
                        </div>
                    )}
                </div>
            )}
            <div className="sm-flex align-flex-end">
                {!isConnected && (
                    <Button
                        className="margin-right-8"
                        width="120px"
                        type="primary"
                        priority="level-two"
                        onClick={actions.openServer}
                        disabled={isOpen}
                    >
                        {i18n._('key-Workspace/Connection-Connect')}
                    </Button>
                )}
                {false && !isConnected && (
                    <Checkbox
                        checked={connectionAuto}
                        onChange={e => actions.handleAutoConnection(e?.target?.checked || false)}
                    >
                        <span className="display-inherit max-width-120 width-percent-100 text-overflow-ellipsis">{i18n._('key-Workspace/Connection-Auto Connect')}</span>
                    </Checkbox>
                )}
                {isConnected && (
                    <Button
                        width="120px"
                        type="default"
                        priority="level-two"
                        onClick={actions.closeServer}
                    >
                        {i18n._('key-Workspace/Connection-Disconnect')}
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

WifiConnection.propTypes = {};

export default WifiConnection;
