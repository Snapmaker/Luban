import classNames from 'classnames';
import { noop } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import semver from 'semver';

import controller from '../../../../communication/socket-communication';
import SocketEvent from '../../../../communication/socket-events';
import { RootState } from '../../../../flux/index.def';
import i18n from '../../../../lib/i18n';
import log from '../../../../lib/log';
import { SnapmakerRayMachine } from '../../../../machines';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';
import { toast } from '../../../components/Toast';
import { makeSceneToast } from '../../../views/toasts/SceneToast';

interface FirmwareNetworkUpgradeModalProps {
    onClose?: () => void;
}

const FirmwareNetworkUpgradeModal: React.FC<FirmwareNetworkUpgradeModalProps> = (props) => {
    const { onClose = noop } = props;
    const isConnected: boolean = useSelector((state: RootState) => state.workspace.isConnected);

    const [firmwareVersion, setFirmwareVersion] = useState('');

    const [latestFirmwareVersion, setLatestFirmwareVersion] = useState('');
    const [latestFirmwareChangeLog, setLatestFirmwareChangeLog] = useState({
        features: [],
        improvements: [],
        bugs: [],
    });

    useEffect(() => {
        if (isConnected) {
            controller
                .emitEvent(SocketEvent.GetFirmwareVersion)
                .once(SocketEvent.GetFirmwareVersion, ({ version }) => {
                    setFirmwareVersion(version);
                });

            controller
                .emitEvent(SocketEvent.GetLatestFirmwareVersion, {
                    machineIdentifier: SnapmakerRayMachine.identifier,
                })
                .once(SocketEvent.GetLatestFirmwareVersion, ({ version, changeLog }) => {
                    setLatestFirmwareVersion(version);
                    setLatestFirmwareChangeLog(changeLog);
                });
        }
    }, [isConnected]);

    // Compare current version and latest version
    const isUpgradeAvailable = useMemo(() => {
        if (!firmwareVersion || !latestFirmwareVersion) {
            return false;
        }

        const v1Match = firmwareVersion.match(/V(\d+.\d+.\d+)/);
        if (!v1Match) return false;

        const v2Match = latestFirmwareVersion.match(/V(\d+.\d+.\d+)/);
        if (!v2Match) return false;

        const v1 = v1Match[1];
        const v2 = v2Match[1];

        return semver.lt(v1, v2);
    }, [firmwareVersion, latestFirmwareVersion]);

    const [isDownloading, setIsDownloading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);

    // Download firmware
    const download = useCallback(async () => {
        setIsDownloading(true);

        return new Promise<string>((resolve) => {
            controller
                .emitEvent(SocketEvent.DownloadLatestFirmware, {
                    machineIdentifier: SnapmakerRayMachine.identifier,
                })
                .once(SocketEvent.DownloadLatestFirmware, ({ err, filePath }) => {
                    setIsDownloading(false);
                    if (err) {
                        log.error(err);
                        resolve('');
                    } else {
                        resolve(filePath);
                    }
                });
        });
    }, []);

    // Upload firmware file
    const upload = useCallback(async (filePath: string) => {
        setIsUploading(true);

        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.CompressUploadFile, {
                    filePath: filePath,
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
    }, []);

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
        // TODO: download
        const filePath = await download();
        if (!filePath) {
            toast(makeSceneToast('info', i18n._('Failed to download firmware.')));
            return;
        }

        // Upload firmware to machine
        const uploadResult = await upload(filePath);
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
    }, [download, upload, upgrade, onClose]);

    return (
        <>
            {
                isUpgradeAvailable && (
                    <Modal size="sm" onClose={onClose}>
                        <Modal.Header>
                            {i18n._('Firmware Upgrade Available')}
                        </Modal.Header>
                        <Modal.Body className="width-432">
                            <div>
                                <div className="sm-flex">
                                    <span>{i18n._('Current firmware version')}:</span>
                                    <span className="margin-left-4">{firmwareVersion}</span>
                                </div>
                                <div className="sm-flex">
                                    <span>{i18n._('Latest firmware version')}:</span>
                                    <span className="margin-left-4">{latestFirmwareVersion}</span>
                                </div>
                                <div className="margin-top-16">
                                    <div
                                        className={classNames(
                                            'font-size-middle font-weight-middle',
                                            'margin-bottom-8',
                                        )}
                                    >
                                        {i18n._('Changelogs')}:
                                    </div>
                                    {
                                        latestFirmwareChangeLog.features.length > 0 && (
                                            <div>
                                                <p className="font-size-base color-black-2">{i18n._('New Features')}</p>
                                                <ul>
                                                    {
                                                        latestFirmwareChangeLog.features.map(desc => (
                                                            <li key={desc}>{desc}</li>
                                                        ))
                                                    }
                                                </ul>
                                            </div>
                                        )
                                    }
                                    {
                                        latestFirmwareChangeLog.improvements.length > 0 && (
                                            <div>
                                                <p className="font-size-base color-black-2">{i18n._('Improvements')}</p>
                                                <ul>
                                                    {
                                                        latestFirmwareChangeLog.improvements.map(desc => (
                                                            <li key={desc}>{desc}</li>
                                                        ))
                                                    }
                                                </ul>
                                            </div>
                                        )
                                    }
                                    {
                                        latestFirmwareChangeLog.bugs.length > 0 && (
                                            <div>
                                                <p className="font-size-base color-black-2">{i18n._('Bug fixes')}</p>
                                                <ul>
                                                    {
                                                        latestFirmwareChangeLog.bugs.map(desc => (
                                                            <li key={desc}>{desc}</li>
                                                        ))
                                                    }
                                                </ul>
                                            </div>
                                        )
                                    }
                                </div>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                type="primary"
                                className="align-r"
                                width="120px"
                                onClick={startUpgradeProcedure}
                                disabled={!isConnected || isDownloading || isUploading || isUpgrading}
                            >
                                {
                                    !isDownloading && !isUploading && !isUpgrading && i18n._('Upgrade')
                                }
                                {
                                    isDownloading && i18n._('Downloading')
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
                )
            }
        </>
    );
};

export default FirmwareNetworkUpgradeModal;
