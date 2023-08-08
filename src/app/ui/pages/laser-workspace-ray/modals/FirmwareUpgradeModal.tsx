import { Tooltip } from 'antd';
import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';

import ControllerEvent from '../../../../connection/controller-events';
import { RootState } from '../../../../flux/index.def';
import controller from '../../../../lib/controller';
import downloadManager from '../../../../lib/download-mananger';
import i18n from '../../../../lib/i18n';
import log from '../../../../lib/log';
import { Button } from '../../../components/Buttons';
import { TextInput } from '../../../components/Input';
import Modal from '../../../components/Modal';
import SvgIcon from '../../../components/SvgIcon';
import { toast } from '../../../components/Toast';
import { makeSceneToast } from '../../../views/toasts/SceneToast';


interface FirmwareUpgradeModalProps {
    onClose?: () => void;
}

const FirmwareUpgradeModal: React.FC<FirmwareUpgradeModalProps> = (props) => {
    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);

    const [selectedFilePath, setSelectedFile] = useState('');

    /**
     * Select target file.
     *
     * Note: selection dialog only works on electron
     */
    const onSelectFile = useCallback(() => {
        downloadManager.emit('select-file');

        // eslint-disable-next-line no-unused-vars
        downloadManager.on('select-file-success', (event, data) => {
            const { canceled, filePaths } = data;
            if (canceled) return;

            if (filePaths.length > 0) {
                setSelectedFile(filePaths[0]);
            }
        });
    }, []);

    const [isUpgrading, setIsUpgrading] = useState(false);

    // Upload firmware file
    const upload = useCallback(async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(ControllerEvent.UploadFile, {
                    filePath: selectedFilePath,
                    targetFilename: 'firmware.bin',
                })
                .once(ControllerEvent.UploadFile, ({ err, text }) => {
                    if (err) {
                        log.error(err);
                        log.error(`Reason: ${text}`);
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                });
        });
    }, [selectedFilePath]);

    const upgrade = useCallback(async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(ControllerEvent.UpgradeFirmware, {
                    filename: 'firmware.bin',
                })
                .once(ControllerEvent.UpgradeFirmware, (err) => {
                    if (err) {
                        log.error('Failed to upgrade.');
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                });
        });
    }, []);

    // Start to upgrade fimmware
    const startUpgradeProcedure = useCallback(async () => {
        setIsUpgrading(true);

        // Upload firmware to machine
        const uploadResult = await upload();
        if (!uploadResult) {
            setIsUpgrading(false);
            toast(makeSceneToast('info', i18n._('Failed to upgrade firmware.')));
            return;
        }

        const upgradeResult = await upgrade();
        if (!upgradeResult) {
            setIsUpgrading(false);
            toast(makeSceneToast('info', i18n._('Failed to upgrade firmware.')));
            return;
        }

        toast(makeSceneToast('info', i18n._('Upgraded firmware successfully.')));
        setIsUpgrading(false);
    }, [upload, upgrade]);


    return (
        <Modal size="sm" onClose={props?.onClose}>
            <Modal.Header>
                {i18n._('Machine Firmware')}
            </Modal.Header>
            <Modal.Body className="width-400">
                <div className="sm-flex">
                    <Tooltip
                        title={selectedFilePath}
                    >
                        <TextInput
                            size="300px"
                            value={selectedFilePath}
                        />
                    </Tooltip>
                    <div className="margin-left-8">
                        <SvgIcon
                            type={['hoverSpecial', 'pressSpecial']}
                            name="ToolbarOpen"
                            size={31}
                            color="#545659"
                            onClick={onSelectFile}
                        />
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="primary"
                    className="align-r"
                    width="96px"
                    onClick={startUpgradeProcedure}
                    disabled={!isConnected || isUpgrading}
                >
                    {
                        !isUpgrading && i18n._('Upgrade')
                    }
                    {
                        isUpgrading && i18n._('Upgrading')
                    }
                </Button>
            </Modal.Footer>
        </Modal>
    );
};


export default FirmwareUpgradeModal;

