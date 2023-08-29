import { Alert, Space } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Vector2 } from 'three';

import ControllerEvent from '../../../../connection/controller-events';
import { RootState } from '../../../../flux/index.def';
import controller from '../../../../lib/controller';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import { NumberInput as Input } from '../../../components/Input';
import Modal from '../../../components/Modal';


interface MachineNetworkModalProps {
    onClose?: () => void;
}

const MachineSettingsModal: React.FC<MachineNetworkModalProps> = (props) => {
    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);

    // const dispatch = useDispatch();

    /**
     * Crosshair
     */
    const [crosshairOffset, setCrosshairOffset] = useState(new Vector2(0, 0));

    useEffect(() => {
        if (isConnected) {
            controller
                .emitEvent(ControllerEvent.GetCrosshairOffset)
                .once(ControllerEvent.GetCrosshairOffset, ({ err, offset }) => {
                    if (err) {
                        return;
                    }

                    console.log('offset =', offset);
                    setCrosshairOffset(new Vector2(offset.x, offset.y));
                });
        }
    }, [isConnected]);

    /**
     * Fire Sensor
     */
    const [fireSensorSensitivity, setFireSensorSensitivity] = useState(0);

    useEffect(() => {
        if (isConnected) {
            controller
                .emitEvent(ControllerEvent.GetFireSensorSensitivity)
                .once(ControllerEvent.GetFireSensorSensitivity, ({ err, sensitivity }) => {
                    if (err) {
                        return;
                    }

                    setFireSensorSensitivity(sensitivity);
                });
        }
    }, [isConnected]);

    const machineSetFireSensorSensivitity = useCallback(async (sensitivity: number) => {
        return new Promise<boolean>((resolve) => {
            controller
                .emitEvent(ControllerEvent.SetFireSensorSensitivity, { sensitivity })
                .once(ControllerEvent.SetFireSensorSensitivity, () => {
                    resolve(true);
                });
        });
    }, []);

    /**
     * Save all at once.
     */
    const onSave = useCallback(async () => {
        await machineSetFireSensorSensivitity(fireSensorSensitivity);
    }, [
        machineSetFireSensorSensivitity, fireSensorSensitivity,
    ]);

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
                                    'width-400',
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
