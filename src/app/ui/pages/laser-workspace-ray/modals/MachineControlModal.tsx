import { Alert, Space } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import ControllerEvent from '../../../../connection/controller-events';
import { RootState } from '../../../../flux/index.def';
import controller from '../../../../lib/controller';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';
import Switch from '../../../components/Switch';

const EnclosureSection: React.FC = () => {
    const [lightIntensity, setLightIntensity] = useState(0);
    const [lightPending, setLightPending] = useState(true);

    const [fanStrength, setFanStrength] = useState(0);
    const [fanPending, setFanPending] = useState(true);

    const updateEnclosureInfo = useCallback(() => {
        controller
            .emitEvent(ControllerEvent.GetEnclosureInfo)
            .once(ControllerEvent.GetEnclosureInfo, (response: {
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
                // TODO:
                console.log('enclosureInfo =', enclosureInfo);

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
            .emitEvent(ControllerEvent.SetEnclosureLight, { value: newIntensity })
            .once(ControllerEvent.SetEnclosureLight, ({ err }) => {
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
            .emitEvent(ControllerEvent.SetEnclosureLight, { value: newFanStrength })
            .once(ControllerEvent.SetEnclosureFan, ({ err }) => {
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

const FilterSection: React.FC = () => {
    const lightIntensity = 0;
    const lightPending = false;

    return (
        <div className="width-432">
            <div className="font-size-middle font-weight-middle">{i18n._('Enclosure')}</div>
            <div className="margin-top-8">
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-Workspace/Enclosure-LED Strips')}</span>
                    <Switch
                        onClick={null}
                        checked={Boolean(lightIntensity)}
                        disabled={lightPending}
                    />
                </div>
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
                {i18n._('Machine Log')}
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
                    (true || isConnected) && (
                        <div>
                            <Space direction="vertical" size={8}>
                                <EnclosureSection />
                                <FilterSection />
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
