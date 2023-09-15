import { Alert, Space } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import SocketEvent from '../../../../../communication/socket-events';
import { SPEED_LOW, SPEED_MEDIUM, SPEED_HIGH } from '../../../../../constants';
import { RootState } from '../../../../../flux/index.def';
import controller from '../../../../../communication/socket-communication';
import i18n from '../../../../../lib/i18n';
import { Button } from '../../../../components/Buttons';
import Modal from '../../../../components/Modal';
import Switch from '../../../../components/Switch';
import styles from './styles.styl';


const EnclosureSection: React.FC = () => {
    const [lightIntensity, setLightIntensity] = useState(0);
    const [lightPending, setLightPending] = useState(true);

    const [fanStrength, setFanStrength] = useState(0);
    const [fanPending, setFanPending] = useState(true);

    const updateEnclosureInfo = useCallback(() => {
        controller
            .emitEvent(SocketEvent.GetEnclosureInfo)
            .once(SocketEvent.GetEnclosureInfo, (response: {
                err: number;
                enclosureInfo: {
                    status: boolean;
                    light: number;
                    fan: number;
                }
            }) => {
                if (response.err) {
                    return;
                }

                const enclosureInfo = response.enclosureInfo;

                setLightIntensity(enclosureInfo.light);
                setLightPending(false);

                setFanStrength(enclosureInfo.fan);
                setFanPending(false);
            });
    }, []);

    useEffect(() => {
        updateEnclosureInfo();
    }, [updateEnclosureInfo]);

    /**
     * Switch enclosure light.
     *
     * Intensity:
     * - 0 -> 100
     * - 100 -> 0
     */
    const onSwitchLight = useCallback(() => {
        setLightPending(true);

        const newIntensity = lightIntensity === 0 ? 100 : 0;
        controller
            .emitEvent(SocketEvent.SetEnclosureLight, { value: newIntensity })
            .once(SocketEvent.SetEnclosureLight, ({ err }) => {
                if (err) {
                    setLightPending(false);
                    return;
                }

                setLightPending(false);
                // set success, update info
                setTimeout(updateEnclosureInfo, 100);
            });
    }, [lightIntensity, updateEnclosureInfo]);

    /**
     * Switch enclosure fan.
     *
     * Strength:
     * - 0 -> 100
     * - 100 -> 0
     */
    const onSwitchFan = useCallback(() => {
        setFanPending(true);

        const newFanStrength = fanStrength === 0 ? 100 : 0;
        controller
            .emitEvent(SocketEvent.SetEnclosureFan, { value: newFanStrength })
            .once(SocketEvent.SetEnclosureFan, ({ err }) => {
                if (err) {
                    setFanPending(false);
                    return;
                }

                setFanPending(false);
                setTimeout(updateEnclosureInfo, 100);
            });
    }, [fanStrength, updateEnclosureInfo]);

    return (
        <div className="width-432">
            <div className="font-size-middle font-weight-middle">{i18n._('Enclosure')}</div>
            <div className="margin-top-8">
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-Workspace/Enclosure-LED Strips')}</span>
                    <Switch
                        onClick={onSwitchLight}
                        checked={Boolean(lightIntensity)}
                        disabled={lightPending}
                    />
                </div>
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-Workspace/Enclosure-Exhaust Fan')}</span>
                    <Switch
                        onClick={onSwitchFan}
                        checked={Boolean(fanStrength)}
                        disabled={fanPending}
                    />
                </div>
            </div>
        </div>
    );
};

const AirPurifierSection: React.FC = () => {
    const [enabled, setEnabled] = useState(false);
    const [filterLife, setFilterLife] = useState(0); // 0-2
    const [fanStrength, setFanStrength] = useState(0); // 1-3

    const updateAirPurifierInfo = useCallback(() => {
        controller
            .emitEvent(SocketEvent.GetAirPurifierInfo)
            .once(SocketEvent.GetAirPurifierInfo, (response: {
                err: number;
                airPurifierInfo: {
                    status: number;
                    enabled: boolean;
                    life: number; // 0-2
                    strength: number; // 1-3
                }
            }) => {
                if (response.err) {
                    return;
                }

                const airPurifierInfo = response.airPurifierInfo;

                setEnabled(airPurifierInfo.enabled);
                setFilterLife(airPurifierInfo.life);
                setFanStrength(airPurifierInfo.strength);
            });
    }, []);

    useEffect(() => {
        updateAirPurifierInfo();
    }, [updateAirPurifierInfo]);

    /**
     * Switch Filter on and off.
     */
    const onSwitchFilter = useCallback(() => {
        const newEnabled = !enabled;
        controller
            .emitEvent(SocketEvent.SetAirPurifierSwitch, { enable: newEnabled })
            .once(SocketEvent.SetAirPurifierSwitch, ({ err }) => {
                if (err) {
                    return;
                }

                setTimeout(updateAirPurifierInfo, 500); // air purifier is slower
            });
    }, [enabled, updateAirPurifierInfo]);

    /**
     * Set strength.
     *
     * works only when air purifier is enabled.
     */
    const setAirPurifierFanStrength = useCallback((strength: number) => {
        if (!enabled) {
            return;
        }

        controller
            .emitEvent(SocketEvent.SetAirPurifierStrength, { value: strength })
            .once(SocketEvent.SetAirPurifierStrength, ({ err }) => {
                if (err) {
                    return;
                }

                setTimeout(updateAirPurifierInfo, 500); // air purifier is slower
            });
    }, [enabled, updateAirPurifierInfo]);

    return (
        <div className="width-432">
            <div className="font-size-middle font-weight-middle">{i18n._('key-Workspace/Purifier-Air Purifier')}</div>
            <div className="margin-top-8">
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-Workspace/Purifier-Switch')}</span>
                    <Switch
                        onClick={onSwitchFilter}
                        checked={enabled}
                    />
                </div>
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span className="max-width-132 text-overflow-ellipsis line-height-32">{i18n._('key-Workspace/Purifier-Fan Speed')}</span>
                    <span
                        className={classNames(
                            'border-radius-8',
                            styles['btn-3btns'],
                            {
                                [styles['disabled-btns']]: !enabled
                            }
                        )}
                    >
                        <button
                            type="button"
                            className={classNames(
                                (fanStrength === SPEED_LOW) ? styles.active : styles.passive,
                            )}
                            onClick={() => setAirPurifierFanStrength(SPEED_LOW)}
                        >
                            {i18n._('key-Workspace/Purifier-Low')}
                        </button>
                        <button
                            type="button"
                            className={classNames(
                                (fanStrength === SPEED_MEDIUM) ? styles.active : styles.passive,
                            )}
                            onClick={() => setAirPurifierFanStrength(SPEED_MEDIUM)}
                        >
                            {i18n._('key-Workspace/Purifier-Medium')}
                        </button>
                        <button
                            type="button"
                            className={classNames(
                                (fanStrength === SPEED_HIGH) ? styles.active : styles.passive,
                            )}
                            onClick={() => setAirPurifierFanStrength(SPEED_HIGH)}
                        >
                            {i18n._('key-Workspace/Purifier-High')}
                        </button>
                    </span>
                </div>
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-Workspace/Purifier-Filter Life')}</span>
                    <span
                        className={classNames(
                            'border-radius-8',
                            styles['life-length'],
                        )}
                    >
                        <span
                            className={classNames(
                                'space',
                                {
                                    [styles.active]: filterLife >= 0
                                }
                            )}
                        />
                        <span
                            className={classNames(
                                'space',
                                {
                                    [styles.active]: filterLife >= 1
                                }
                            )}
                        />
                        <span
                            className={classNames(
                                'space',
                                {
                                    [styles.active]: filterLife >= 2
                                }
                            )}
                        />
                    </span>
                </div>
                {
                    filterLife === 0 && (
                        <div className="margin-top-8">
                            <Alert type="warning" showIcon message={i18n._('key-Workspace/Purifier-You should replace the filter cartridge.')} />
                        </div>
                    )
                }
            </div>
        </div>
    );
};

interface MachineControlModalProps {
    onClose?: () => void;
}

const MachineControlModal: React.FC<MachineControlModalProps> = (props) => {
    const { onClose = null } = props;

    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);

    return (
        <Modal size="sm" onClose={props?.onClose}>
            <Modal.Header>
                {i18n._('Machine Control')}
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
                            <Space direction="vertical" size={8}>
                                <EnclosureSection />
                                <AirPurifierSection />
                            </Space>
                        </div>
                    )
                }
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="primary"
                    className="align-r"
                    width="96px"
                    onClick={onClose}
                >
                    {i18n._('Close')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default MachineControlModal;
