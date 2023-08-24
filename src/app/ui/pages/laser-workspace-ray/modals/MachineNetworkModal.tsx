import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { IPObtain, NetworkConfiguration, NetworkMode, NetworkStationState } from '@snapmaker/snapmaker-sacp-sdk/dist/models';
import { Alert, Input, Select, Space } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import ControllerEvent from '../../../../connection/controller-events';
import { RootState } from '../../../../flux/index.def';
import controller from '../../../../lib/controller';
import i18n from '../../../../lib/i18n';
import log from '../../../../lib/log';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';
import useMountedState from '../../../utils/useMountedState';

interface MachineNetworkModalProps {
    onClose?: () => void;
}

/**
 * Configure Machine Network (Wi-Fi).
 */
const MachineNetworkModal: React.FC<MachineNetworkModalProps> = (props) => {
    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);
    const isMounted = useMountedState();


    // Current network
    const [currentNetworkLoading, setCurrentNetworkLoading] = useState(false);
    const [currentNetwork, setCurrentNetwork] = useState('');
    const [currentNetworkIP, setCurrentNetworkIP] = useState('');

    const loadCurrentNetwork = useCallback(() => {
        setCurrentNetworkLoading(true);

        controller
            .emitEvent(ControllerEvent.GetMachineNetworkConfiguration)
            .once(ControllerEvent.GetMachineNetworkConfiguration, (networkConfiguration: NetworkConfiguration) => {
                setCurrentNetworkLoading(false);
                if (networkConfiguration.networkMode === NetworkMode.Station) {
                    setCurrentNetwork(networkConfiguration.stationSSID);

                    controller
                        .emitEvent(ControllerEvent.GetMachineNetworkStationState)
                        .once(ControllerEvent.GetMachineNetworkStationState, (networkStationState: NetworkStationState) => {
                            if (networkStationState.stationState === 3) {
                                setCurrentNetworkIP(networkStationState.stationIP);
                            } else {
                                setCurrentNetworkIP('');
                            }
                        });
                } else {
                    // other network mode not supported currently
                    setCurrentNetwork('');
                    setCurrentNetworkIP('');
                }
            });

        setTimeout(() => {
            if (isMounted()) {
                setCurrentNetworkLoading(false);
            }
        }, 2000);
    }, [isMounted]);

    const checkCurrentNetwork = useCallback((count = 5) => {
        if (count === 0) {
            return;
        }

        loadCurrentNetwork();

        // try again in 3 seconds
        setTimeout(() => checkCurrentNetwork(count - 1), 3000);
    }, [loadCurrentNetwork]);

    useEffect(() => {
        if (isConnected) {
            loadCurrentNetwork();
        }
    }, [isConnected, loadCurrentNetwork]);

    // Network options
    const [networkOptions, setNetworkOptions] = useState([]);
    const [networkLoading, setNetworkLoading] = useState(false);

    useEffect(() => {
        if (isConnected) {
            setNetworkLoading(true);

            controller
                .emitEvent(ControllerEvent.ListWiFiNetworks)
                .once(ControllerEvent.ListWiFiNetworks, (networks: string[]) => {
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
            .emitEvent(ControllerEvent.SetMachineNetworkConfiguration, {
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
            <Modal.Body className="width-400">
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
                            <p>
                                <span className="margin-right-4">{i18n._('Machine Network')}:</span>
                                {
                                    currentNetwork && (
                                        <>
                                            <span className="margin-right-4">{currentNetwork}</span>
                                            {
                                                currentNetworkIP && (
                                                    <span>({currentNetworkIP})</span>
                                                )
                                            }
                                            {
                                                !currentNetworkIP && currentNetworkLoading && (
                                                    <span>({i18n._('Loading...')})</span>
                                                )
                                            }
                                            {
                                                !currentNetworkIP && !currentNetworkLoading && !currentNetworkIP && (
                                                    <span>({i18n._('Not Connected')})</span>
                                                )
                                            }
                                        </>
                                    )
                                }
                                {
                                    !currentNetwork && currentNetworkLoading && (
                                        <span>{i18n._('Loading...')}</span>
                                    )
                                }
                                {
                                    !currentNetwork && !currentNetworkLoading && (
                                        <span>{i18n._('Not Configured')}</span>
                                    )
                                }
                            </p>
                        </div>
                    )
                }
                {
                    isConnected && (
                        <div
                            className={
                                classNames('width-percent-100', 'sm-flex', {
                                    'margin-top-16': !isConnected,
                                })
                            }
                        >
                            <Space direction="vertical" size={16} className="sm-flex-width">
                                <div className="width-320">
                                    <p>Network:</p>
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
                                    <p>Password:</p>
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
                            width="96px"
                            onClick={setMachineNetworkConfiguration}
                            disabled={!isConnected}
                        >
                            {i18n._('key-Common/Config')}
                        </Button>
                    )
                }
                {
                    !isConnected && (
                        <Button
                            type="primary"
                            className="align-r"
                            width="96px"
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
