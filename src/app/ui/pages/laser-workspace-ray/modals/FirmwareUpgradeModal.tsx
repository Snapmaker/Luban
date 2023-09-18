import { Alert, Tooltip } from 'antd';
import { noop } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import SocketEvent from '../../../../communication/socket-events';
import { RootState } from '../../../../flux/index.def';
import controller from '../../../../communication/socket-communication';
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
    const { onClose = noop } = props;
    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);

    const [firmwareVersion, setFirmwareVersion] = useState('');

    useEffect(() => {
        if (isConnected) {
            controller
                .emitEvent(SocketEvent.GetFirmwareVersion)
                .once(SocketEvent.GetFirmwareVersion, ({ version }) => {
                    setFirmwareVersion(version);
                });
        }
    }, [isConnected]);

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

    const [isUploading, setIsUploading] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);

    // Upload firmware file
    const upload = useCallback(async () => {
        setIsUploading(true);

        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.CompressUploadFile, {
                    filePath: selectedFilePath,
                    targetFilename: '/update.bin',
                })
                .once(SocketEvent.CompressUploadFile, ({ err, text }) => {
                    setIsUploading(false);

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
        setIsUpgrading(true);
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.UpgradeFirmware, {
                    filename: '/update.bin',
                })
                .once(SocketEvent.UpgradeFirmware, ({ err }) => {
                    setIsUpgrading(false);
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
        // Upload firmware to machine
        const uploadResult = await upload();
        if (!uploadResult) {
            toast(makeSceneToast('info', i18n._('Failed to upgrade firmware.')));
            return;
        }

        const upgradeResult = await upgrade();
        if (!upgradeResult) {
            toast(makeSceneToast('info', i18n._('Failed to upgrade firmware.')));
            return;
        }

        // success
        toast(makeSceneToast('info', i18n._('Upgraded firmware successfully.')));

        // Once upgrade successful, the machine will be disconnected.
        // close the modal, let users to re-connect.
        onClose();
    }, [upload, upgrade, onClose]);


    return (
        <Modal size="sm" onClose={onClose}>
            <Modal.Header>
                {i18n._('Machine Firmware')}
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
                            <div className="sm-flex">
                                <span>{i18n._('Current firmware version')}:</span>
                                <span className="margin-left-4">{firmwareVersion}</span>
                            </div>
                            <div className="sm-flex margin-top-16">
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
                        </div>
                    )
                }
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="primary"
                    className="align-r"
                    width="96px"
                    onClick={startUpgradeProcedure}
                    disabled={!isConnected || isUploading || isUpgrading}
                >
                    {
                        !isUploading && !isUpgrading && i18n._('Upgrade')
                    }
                    {
                        isUploading && i18n._('Uploading')
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

