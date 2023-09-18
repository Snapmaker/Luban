import { ToolHeadType } from '@snapmaker/luban-platform';
import { Alert, Space } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Vector2 } from 'three';

import SocketEvent from '../../../../communication/socket-events';
import { RootState } from '../../../../flux/index.def';
import controller from '../../../../communication/socket-communication';
import i18n from '../../../../lib/i18n';
import log from '../../../../lib/log';
import { Button } from '../../../components/Buttons';
import { NumberInput as Input } from '../../../components/Input';
import Modal from '../../../components/Modal';
import Switch from '../../../components/Switch';


interface MachineNetworkModalProps {
    onClose?: () => void;
}

const MachineSettingsModal: React.FC<MachineNetworkModalProps> = (props) => {
    const { onClose = null } = props;

    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);

    // const dispatch = useDispatch();

    /**
     * Crosshair
     */
    const [crosshairOffset, setCrosshairOffset] = useState(new Vector2(0, 0));

    useEffect(() => {
        if (isConnected) {
            controller
                .emitEvent(SocketEvent.GetCrosshairOffset)
                .once(SocketEvent.GetCrosshairOffset, ({ err, offset }) => {
                    if (err) {
                        return;
                    }

                    setCrosshairOffset(new Vector2(offset.x, offset.y));
                });
        }
    }, [isConnected]);

    const machineSetCrosshairOffset = useCallback(async (offset: Vector2) => {
        return new Promise<boolean>((resolve) => {
            controller
                .emitEvent(SocketEvent.SetCrosshairOffset, { x: offset.x, y: offset.y })
                .once(SocketEvent.SetCrosshairOffset, ({ err }) => {
                    resolve(!err);
                });
        });
    }, []);

    /**
     * Fire Sensor
     */
    const [fireSensorSensitivity, setFireSensorSensitivity] = useState(0);

    useEffect(() => {
        if (isConnected) {
            controller
                .emitEvent(SocketEvent.GetFireSensorSensitivity)
                .once(SocketEvent.GetFireSensorSensitivity, ({ err, sensitivity }) => {
                    if (err) {
                        return;
                    }

                    setFireSensorSensitivity(sensitivity);
                });
        }
    }, [isConnected]);

    const machineSetFireSensorSensitivity = useCallback(async (sensitivity: number) => {
        return new Promise<boolean>((resolve) => {
            controller
                .emitEvent(SocketEvent.SetFireSensorSensitivity, { sensitivity })
                .once(SocketEvent.SetFireSensorSensitivity, () => {
                    resolve(true);
                });
        });
    }, []);

    /**
     * Enclosure door detection
     */
    const [doorDetectionEnabled, setDoorDetectionEnabled] = useState(false);
    const [doorDetectionPending, setDoorDetectionPending] = useState(false);

    const updateEnclosureInfo = useCallback(() => {
        controller
            .emitEvent(SocketEvent.GetEnclosureInfo)
            .once(SocketEvent.GetEnclosureInfo, (response: {
                err: number;
                enclosureInfo: {
                    status: boolean;
                    light: number;
                    fan: number;
                    doorDetectionSettings: Array<{ headType: ToolHeadType, enabled: boolean }>;
                }
            }) => {
                if (response.err) {
                    return;
                }

                const enclosureInfo = response.enclosureInfo;

                let enabled = false;
                for (const item of enclosureInfo.doorDetectionSettings) {
                    log.info('door detection setting:', item.headType, item.enabled);
                    if (item.headType === ToolHeadType.Laser) {
                        enabled = item.enabled;
                        break;
                    }
                }

                setDoorDetectionEnabled(enabled);
            });
    }, []);

    // Get once when mounted
    useEffect(() => {
        updateEnclosureInfo();
    }, [updateEnclosureInfo]);

    const machineSetEnclosureDoorDetection = useCallback(async (enabled: boolean) => {
        setDoorDetectionPending(true);

        return new Promise<boolean>((resolve) => {
            controller
                .emitEvent(SocketEvent.SetEnclosureDoorDetection, { enable: enabled })
                .once(SocketEvent.SetEnclosureDoorDetection, ({ err }) => {
                    if (err) {
                        log.info('Failed to set enclosure door detection.');
                        setDoorDetectionPending(false);
                        resolve(false);
                        return;
                    }

                    log.info('Set enclosure door detection successfully.');
                    setDoorDetectionPending(false);
                    resolve(true);
                });
        });
    }, []);

    const onSwitchDoorDetection = useCallback(async () => {
        const newEnabled = !doorDetectionEnabled;

        const success = await machineSetEnclosureDoorDetection(newEnabled);
        // set success, update info
        if (success) {
            setTimeout(updateEnclosureInfo, 100);
        }
    }, [
        updateEnclosureInfo, machineSetEnclosureDoorDetection,
        doorDetectionEnabled
    ]);


    /**
     * Save all at once.
     */
    const onSave = useCallback(async () => {
        // save offset
        await machineSetCrosshairOffset(crosshairOffset);

        // save fire sensor sensitivity
        await machineSetFireSensorSensitivity(fireSensorSensitivity);

        // close the modal on save
        onClose && onClose();
    }, [
        machineSetCrosshairOffset, crosshairOffset,
        machineSetFireSensorSensitivity, fireSensorSensitivity,

        onClose,
    ]);

    return (
        <Modal size="sm" onClose={props?.onClose}>
            <Modal.Header>
                {i18n._('Machine Settings')}
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
                        <Space size={12} direction="vertical">
                            <div
                                className={classNames(
                                    'sm-flex justify-space-between',
                                    'width-432',
                                )}
                            >
                                <span className="line-height-32">{i18n._('Crosshair Offset')}</span>
                                <Input
                                    suffix="mm"
                                    value={crosshairOffset.x}
                                    onChange={(value) => {
                                        crosshairOffset.x = value;
                                        setCrosshairOffset(crosshairOffset);
                                    }}
                                />
                                <Input
                                    suffix="mm"
                                    value={crosshairOffset.y}
                                    onChange={(value) => {
                                        crosshairOffset.y = value;
                                        setCrosshairOffset(crosshairOffset);
                                    }}
                                />
                            </div>
                            <div
                                className={classNames(
                                    'sm-flex justify-space-between',
                                    'width-432',
                                )}
                            >
                                <span className="line-height-32">{i18n._('Fire Sensor Sensitivity')} (0-4095)</span>
                                <Input
                                    suffix="mm"
                                    value={fireSensorSensitivity}
                                    max={4095}
                                    min={0}
                                    onChange={(value) => {
                                        setFireSensorSensitivity(value);
                                    }}
                                />
                            </div>
                            <div
                                className={classNames(
                                    'sm-flex justify-space-between',
                                    'width-432',
                                )}
                            >
                                <span className="line-height-32">{i18n._('Door Detection')}</span>
                                <Switch
                                    onClick={onSwitchDoorDetection}
                                    checked={doorDetectionEnabled}
                                    disabled={doorDetectionPending}
                                />
                            </div>
                        </Space>
                    )
                }
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="primary"
                    className="align-r"
                    width="96px"
                    onClick={onSave}
                    disabled={!isConnected}
                >
                    {i18n._('key-Project/Save-Save')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default MachineSettingsModal;
