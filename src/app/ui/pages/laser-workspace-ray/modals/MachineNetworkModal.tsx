import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { IPObtain, NetworkConfiguration, NetworkMode, NetworkStationState } from '@snapmaker/snapmaker-sacp-sdk/dist/models';
import { Alert, Input, Select, Space } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import SocketEvent from '../../../../communication/socket-events';
import { RootState } from '../../../../flux/index.def';
import controller from '../../../../communication/socket-communication';
import i18n from '../../../../lib/i18n';
import log from '../../../../lib/log';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';


enum NetworkStatus {
    NotConnected = 0,
    Connecting = 1,
    Connected = 2,
}
interface NetworkStatusBadgeProps {
    networkStatus: NetworkStatus;
}

const NetworkStatusBadge: React.FC<NetworkStatusBadgeProps> = (props) => {
    const { networkStatus } = props;

    const text = useMemo(() => {
        switch (networkStatus) {
            case NetworkStatus.Connecting:
                return i18n._('Connecting');
            case NetworkStatus.Connected:
                return i18n._('Connected');
            case NetworkStatus.NotConnected:
            default:
                return i18n._('Not Connected');
        }
    }, [networkStatus]);

    const color = useMemo(() => {
        switch (networkStatus) {
            case NetworkStatus.NotConnected:
                return '#FF5759'; // red-1
            case NetworkStatus.Connecting:
                return '#FFA940'; // orange-1
            case NetworkStatus.Connected:
                return '#4CB518'; // green-1
            default:
                return '#FF5759'; // red-1
        }
    }, [networkStatus]);

    return (
        <div className="sm-flex align-center padding-horizontal-8 background-grey-3 border-radius-12">
            <span className="margin-right-8 tooltip-message height-24">{text}</span>
            <span
                style={{
                    display: 'inline-block',
                    backgroundColor: color,
                    height: 6,
                    width: 6,
                    borderRadius: 3,
                }}
            />
        </div>
    );
};


interface MachineNetworkModalProps {
    onClose?: () => void;
}

/**
 * Configure Machine Network (Wi-Fi).
 */
const MachineNetworkModal: React.FC<MachineNetworkModalProps> = (props) => {
    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);

    // Current network
    const [currentNetwork, setCurrentNetwork] = useState('');
    const [currentNetworkIP, setCurrentNetworkIP] = useState('');

    const networkStatus: NetworkStatus = useMemo(() => {
        if (currentNetwork && currentNetworkIP) {
            return NetworkStatus.Connected;
        }
        if (currentNetwork && !currentNetworkIP) {
            return NetworkStatus.Connecting;
        }

        return NetworkStatus.NotConnected;
    }, [currentNetwork, currentNetworkIP]);

    const loadCurrentNetwork = useCallback(async () => {
        return new Promise<boolean>((resolve) => {
            controller
                .emitEvent(SocketEvent.GetMachineNetworkConfiguration)
                .once(SocketEvent.GetMachineNetworkConfiguration, (networkConfiguration: NetworkConfiguration) => {
                    if (networkConfiguration.networkMode === NetworkMode.Station) {
                        setCurrentNetwork(networkConfiguration.stationSSID);

                        controller
                            .emitEvent(SocketEvent.GetMachineNetworkStationState)
                            .once(SocketEvent.GetMachineNetworkStationState, (networkStationState: NetworkStationState) => {
                                if (networkStationState.stationState === 3) {
                                    setCurrentNetworkIP(networkStationState.stationIP);
                                    resolve(true);
                                } else {
                                    setCurrentNetworkIP('');
                                    resolve(false);
                                }
                            });
                    } else {
                        // other network mode not supported currently
                        setCurrentNetwork('');
                        setCurrentNetworkIP('');
                        resolve(false);
                    }
                });
        });
    }, []);

    const checkCurrentNetwork = useCallback(async () => {
        let count = 0;
        while (true) {
            if (count === 5) {
                setCurrentNetwork('');
                setCurrentNetworkIP('');
                return;
            }

            count++;

            const success = await loadCurrentNetwork();
            if (success) {
                return;
            }

            // wait 3 seconds
            await new Promise<void>((resolve) => setTimeout(() => resolve(), 3000));
        }
    }, [loadCurrentNetwork]);

    useEffect(() => {
        if (isConnected) {
            checkCurrentNetwork();
        }
    }, [isConnected, checkCurrentNetwork]);

    // Network options
    const [networkOptions, setNetworkOptions] = useState([]);
    const [networkLoading, setNetworkLoading] = useState(false);

    useEffect(() => {
        if (isConnected) {
            setNetworkLoading(true);

            controller
                .emitEvent(SocketEvent.ListWiFiNetworks)
                .once(SocketEvent.ListWiFiNetworks, (networks: string[]) => {
                    const options = networks.map((network: string) => ({
                        value: network,
                        label: network,
                    }));
                    setNetworkLoading(false);
                    setNetworkOptions(options);
                });
        }
    }, [isConnected]);

    // selected SSID
    const [selectedNetwork, setSelecetdNetwork] = useState('');

    const [selectedNetworkPassword, setSelectedNetworkPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = React.useState(false);

    useEffect(() => {
        if (!selectedNetwork && networkOptions.length > 0) {
            setSelecetdNetwork(networkOptions[0].value);
        }
    }, [selectedNetwork, networkOptions]);

    const onChangeSelectedNetwork = useCallback((networkOption) => {
        setSelecetdNetwork(networkOption);
    }, []);

    const onChangePassword = useCallback((e) => {
        setSelectedNetworkPassword(e.target.value);
    }, []);

    // Set machine network configuration
    const setMachineNetworkConfiguration = useCallback(() => {
        log.info(`Connect machine to ${selectedNetwork}...`);

        controller
            .emitEvent(SocketEvent.SetMachineNetworkConfiguration, {
                networkMode: NetworkMode.Station,
                stationIPObtain: IPObtain.DHCP,
                stationSSID: selectedNetwork,
                stationPassword: selectedNetworkPassword,
                stationIP: '0.0.0.0',
            });

        // update current network
        setCurrentNetwork(selectedNetwork);
        setCurrentNetworkIP('');

        // check current network 1s later
        setTimeout(checkCurrentNetwork, 1000);
    }, [selectedNetwork, selectedNetworkPassword, checkCurrentNetwork]);

    return (
        <Modal size="sm" onClose={props?.onClose}>
            <Modal.Header>
                {i18n._('key-Workspace/MainToolBar-Machine Network')}
            </Modal.Header>
            <Modal.Body className="width-432">
                {
                    !isConnected && (
                        <Alert
                            type="error"
                            message={i18n._('key-Workspace/Machine not connected, please connect to the machine first.')}
                        />
                    )
                }
                {
                    isConnected && (
                        <div>
                            <div>
                                <span>{i18n._('Machine Network')}</span>
                            </div>
                            <div className="sm-flex margin-top-8">
                                <span className="margin-right-8">
                                    <NetworkStatusBadge networkStatus={networkStatus} />
                                </span>
                                {
                                    currentNetwork && currentNetworkIP && (
                                        <>
                                            <span className="margin-right-4">{currentNetwork}</span>
                                            <span>({currentNetworkIP})</span>
                                        </>
                                    )
                                }
                            </div>
                        </div>
                    )
                }
                {
                    isConnected && (
                        <div
                            className={
                                classNames('width-percent-100', 'sm-flex', {
                                    'margin-top-16': isConnected,
                                })
                            }
                        >
                            <Space direction="vertical" size={16} className="sm-flex-width">
                                <div className="width-320">
                                    <p>{i18n._('Wi-Fi Name')}</p>
                                    <Select
                                        style={{ width: '100%' }}
                                        disabled={!isConnected}
                                        loading={networkLoading}
                                        options={networkOptions}
                                        value={selectedNetwork}
                                        onChange={onChangeSelectedNetwork}
                                    />
                                </div>
                                <div className="width-320">
                                    <p>{i18n._('Password')}</p>
                                    <Input.Password
                                        width={300}
                                        disabled={!isConnected}
                                        minLength={8}
                                        value={selectedNetworkPassword}
                                        onChange={onChangePassword}
                                        placeholder={i18n._('key-Workspace/Input password')}
                                        iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                                        visibilityToggle={{ visible: passwordVisible, onVisibleChange: setPasswordVisible }}
                                    />
                                </div>
                            </Space>
                        </div>
                    )
                }
            </Modal.Body>
            <Modal.Footer>
                {
                    isConnected && (
                        <Button
                            type="primary"
                            className="align-r"
                            width="120px"
                            onClick={setMachineNetworkConfiguration}
                            disabled={networkStatus === NetworkStatus.Connecting}
                            loading={networkStatus === NetworkStatus.Connecting}
                        >
                            {networkStatus !== NetworkStatus.Connecting && i18n._('key-Common/Config')}
                        </Button>
                    )
                }
                {
                    !isConnected && (
                        <Button
                            type="primary"
                            className="align-r"
                            width="120px"
                            onClick={props?.onClose}
                        >
                            {i18n._('key-App/Update-OK')}
                        </Button>
                    )
                }
            </Modal.Footer>
        </Modal>
    );
};

export default MachineNetworkModal;
