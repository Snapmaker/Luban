import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { map } from 'lodash';
// import { InputGroup } from 'react-bootstrap';
import { Button } from '../../components/Buttons';
import Checkbox from '../../components/Checkbox';
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
    CONNECTION_TYPE_WIFI,
    // HEAD_LASER, HEAD_PRINTING,
    IMAGE_WIFI_CONNECTED,
    IMAGE_WIFI_CONNECTING,
    // IMAGE_WIFI_ERROR,
    IMAGE_WIFI_WAITING,
    WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATUS_UNKNOWN,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    HEAD_PRINTING,
    HEAD_LASER,
    HEAD_CNC
} from '../../../constants';
// import widgetStyles from '../styles.styl';
import styles from './index.styl';
// import PrintingState from './PrintingState';
// import LaserState from './LaserState';
import ModalSmall from '../../components/Modal/ModalSmall';
import ModalSmallInput from '../../components/Modal/ModalSmallInput';
import { Server } from '../../../flux/machine/Server';
import { actions as workspaceActions } from '../../../flux/workspace';
// import { machineStore } from '../../../store/local-storage';

export const ModuleStatus = ({ moduleName, status }) => {
    return (
        <div className="sm-flex align-center padding-horizontal-8 background-grey-3 border-radius-12 margin-top-8 margin-right-8">
            <span className="margin-right-8 tooltip-message height-24">{moduleName}</span>
            <span style={{ display: 'inline-block', backgroundColor: status ? '#4CB518' : '#FFA940', height: 6, width: 6, borderRadius: 3 }} />
        </div>
    );
};
let timer = null;
function WifiConnection() {
    const {
        servers,
        serverDiscovering,

        connectionType,
        connectionStatus,
        connectionAuto,
        server,
        savedServerAddress,
        manualIp,
        // machine status headType,
        workflowStatus, isOpen, isConnected,
        moduleStatusList,
        airPurifier,
        // airPurifierStatus,
        heatedBedTemperature,
        laserCamera
    } = useSelector(state => state.machine);
    const {
        toolHead, headType, series
    } = useSelector(state => state?.workspace);
    const [savedServerAddressState, setSavedServerAddressState] = useState(savedServerAddress);
    const { emergencyStopButton: emergencyStopButtonStatus, airPurifier: airPurifierStatus, rotaryModule: rotaryModuleStatus, enclosure: enclosureStatus } = moduleStatusList;
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
    const [currentModuleStatusList, setCurrentModuleStatusList] = useState(null);
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
                setserverOpenState(null);
                if (data?.toolHead && data.toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                    dispatch(workspaceActions.updateMachineState({
                        headType: data.headType,
                        toolHead: data.toolHead,
                        series: series
                    }));
                }
            }));
        },
        closeServer: () => {
            dispatch(machineActions.closeServer());
            setSavedServerAddressState('');
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
        showWifiError: (err, data) => {
            setConnectionMessage({
                text: i18n._(data || err.message),
                title: err.status ? i18n._(`Error ${err.status}`) : i18n._('key-Workspace/Connection-Error'),
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
                title: i18n._('key-Workspace/Connection-Manual Connection'),
                label: i18n._('key-Workspace/Connection-IP Address') ? `${i18n._('key-Workspace/Connection-IP Address')}:` : '',
                // img: IMAGE_WIFI_WAITING,
                showCloseButton: true,
                inputtext: manualIp,
                onCancel: actions.onCloseManualWiFi,
                onConfirm: (text) => {
                    dispatch(machineActions.connect.setManualIP(text));
                    const newServer = new Server('Manual', text);

                    // Try add new server
                    const _server = dispatch(machineActions.connect.addServer(newServer));

                    // set state server and then open it
                    setServerState(_server);
                    setserverOpenState(_server);
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
            dispatch(machineActions.connect.setConnectionAuto(value));
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
        if (isConnected) {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        } else {
            if (connectionAuto) {
                if (!timer) {
                    timer = setInterval(() => actions.onRefreshServers(), 5000);
                }
            } else {
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

    useEffect(() => {
        if (serverState?.address === savedServerAddressState && connectionAuto) {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            actions.openServer();
        }
    }, [serverState, savedServerAddressState]);

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
            newModuleStatusList.push({
                key: `${headType}-${toolHead}`,
                status: true,
                moduleName: i18n._('key-Workspace/Connection-3dp')
            });
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
        }
        if (headType === HEAD_CNC) {
            newModuleStatusList.push({
                key: `${headType}-${toolHead}`,
                status: true,
                moduleName: i18n._('key-Workspace/Connection-CNC')
            });
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
        enclosureStatus, laserCamera
    ]);

    useEffect(() => {
        if (!isConnected) {
            setCurrentModuleStatusList(null);
        } else {
            setCurrentModuleStatusList(updateModuleStatusList);
        }
    }, [isConnected, updateModuleStatusList]);


    return (
        <div>
            {!isConnected && (
                <div className="sm-flex justify-space-between margin-bottom-16">
                    {/** https://react-select.com/upgrade-guide#new-components-api **/}
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
                            value: s.name,
                            address: s.address,
                            label: `${s.name} (${s.address})`
                        }))}
                        placeholder={i18n._('key-Workspace/Connection-Choose a machine')}
                        value={serverState ? serverState?.name : ''}
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
            {isConnected && (
                <div className="margin-bottom-16 margin-top-12">
                    <div
                        className={classNames(styles['connection-state'], 'padding-bottom-8', 'border-bottom-dashed-default')}
                    >
                        <span className="main-text-normal">
                            {`${serverState?.name} (${series.toUpperCase()})`}
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
                    {!!currentModuleStatusList && !!currentModuleStatusList.length && (
                        <div className={classNames('sm-flex', 'flex-wrap')}>
                            {currentModuleStatusList.map(item => (
                                <ModuleStatus key={item.moduleName} moduleName={item.moduleName} status={item.status} />
                            ))}
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
                {!isConnected && (
                    <Checkbox
                        checked={connectionAuto}
                        onChange={e => actions.handleAutoConnection(e?.target?.checked || false)}
                    >
                        <span className="display-inherit width-120 text-overflow-ellipsis">{i18n._('key-Workspace/Connection-Auto Connect')}</span>
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
WifiConnection.propTypes = {
};

ModuleStatus.propTypes = {
    moduleName: PropTypes.string,
    status: PropTypes.bool
};

export default WifiConnection;
