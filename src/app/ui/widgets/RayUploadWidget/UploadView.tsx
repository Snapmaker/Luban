import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { includes } from 'lodash';

import { WorkflowStatus } from '@snapmaker/luban-platform';
import { JobOffsetMode } from '../../../constants/coordinate';
import SocketEvent from '../../../communication/socket-events';
import { RootState } from '../../../flux/index.def';
import controller from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { Button } from '../../components/Buttons';
import modalSmallHOC, { ModalSmallHOC } from '../../components/Modal/modal-small';
import gcodeActions, { GCodeFileObject } from '../../../flux/workspace/actions-gcode';
import styles from './styles.styl';
import { getRunBoundayCode } from '../RaySetOriginWidget/SetOriginView';

export type LoadGcodeOptions = {
    renderImmediately?: boolean;
};

enum UploadFileModalType {
    None,
    Progress,
    Compressing,
    Decompressing,
}

const UploadView: React.FC = () => {
    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);

    const workflowStatus = useSelector((state: RootState) => state.workspace.workflowStatus);
    // const activeGcodeFile = useSelector((state: RootState) => state.workspace.activeGcodeFile);

    const isWorking = includes([
        WorkflowStatus.Running, WorkflowStatus.Pausing, WorkflowStatus.Paused, WorkflowStatus.Stopping, WorkflowStatus.Resuming
    ], workflowStatus);

    const boundingBox = useSelector((state: RootState) => state.workspace.boundingBox);
    const jobOffsetMode: JobOffsetMode = useSelector((state: RootState) => state.laser.jobOffsetMode);

    const gcodeFile = useSelector((state: RootState) => state.workspace.gcodeFile);

    const [isUploading, setIsUploading] = useState(false);
    const [fileUploadProgress, setFileUploadProgress] = useState(0);
    const [fileUploadIsCompressing, setFileUploadIsCompressing] = useState(false);
    const [fileUploadIsDecompressing, setFileUploadIsDecompressing] = useState(false);

    useEffect(() => {
        const onProgress = ({ progress }) => {
            if (isUploading) {
                setFileUploadProgress(progress);
                setFileUploadIsCompressing(false);
                setFileUploadIsDecompressing(false);
            }
        };
        const onCompressing = () => {
            if (isUploading) {
                setFileUploadProgress(0);
                setFileUploadIsCompressing(true);
                setFileUploadIsDecompressing(false);
            }
        };
        const onDecompressing = () => {
            if (isUploading) {
                setFileUploadProgress(0);
                setFileUploadIsCompressing(false);
                setFileUploadIsDecompressing(true);
            }
        };

        controller.on(SocketEvent.UploadFileProgress, onProgress);
        controller.on(SocketEvent.UploadFileCompressing, onCompressing);
        controller.on(SocketEvent.UploadFileDecompressing, onDecompressing);

        return () => {
            controller.off(SocketEvent.UploadFileProgress, onProgress);
            controller.off(SocketEvent.UploadFileCompressing, onCompressing);
            controller.off(SocketEvent.UploadFileDecompressing, onDecompressing);
        };
    }, [isUploading]);

    const [uploadFileModalType, setUploadFileModalType] = useState<UploadFileModalType>(UploadFileModalType.None);

    useEffect(() => {
        if (fileUploadIsCompressing) {
            setUploadFileModalType(UploadFileModalType.Compressing);
        } else if (fileUploadIsDecompressing) {
            setUploadFileModalType(UploadFileModalType.Decompressing);
        } else if (fileUploadProgress > 0) {
            setUploadFileModalType(UploadFileModalType.Progress);
        } else {
            setUploadFileModalType(UploadFileModalType.None);
        }
    }, [fileUploadProgress, fileUploadIsCompressing, fileUploadIsDecompressing]);

    const dispatch = useDispatch();

    const uploadBoundary = useCallback(async () => {
        if (!boundingBox) {
            return false;
        }

        log.info('Run Boundary... bbox =', boundingBox);

        const gcode = getRunBoundayCode(boundingBox, jobOffsetMode);

        const blob = new Blob([gcode], { type: 'text/plain' });
        const file = new File([blob], 'boundary.nc');

        const gcodeFileObject: GCodeFileObject = await dispatch(gcodeActions.uploadGcodeFile(file));

        return new Promise<boolean>((resolve) => {
            controller
                .emitEvent(SocketEvent.CompressUploadFile, {
                    filePath: gcodeFileObject.uploadName,
                    targetFilename: 'boundary.nc',
                })
                .once(SocketEvent.CompressUploadFile, ({ err, text }) => {
                    if (err) {
                        log.error('Unable to upload G-code to execute.');
                        log.error(err);
                        log.error(`Reason: ${text}`);
                        resolve(false);
                        return;
                    }

                    log.info('Uploaded boundary G-code.');
                    resolve(true);
                });
        });
    }, [dispatch, boundingBox, jobOffsetMode]);

    const uploadJob = useCallback(async () => {
        if (!gcodeFile) {
            return false;
        }

        setIsUploading(true);

        return new Promise<boolean>((resolve) => {
            controller
                .emitEvent(SocketEvent.CompressUploadFile, {
                    filePath: gcodeFile.uploadName,
                    targetFilename: 'ray.nc',
                })
                .once(SocketEvent.CompressUploadFile, ({ err, text }) => {
                    setIsUploading(false);

                    setFileUploadProgress(0);
                    setFileUploadIsCompressing(false);
                    setFileUploadIsDecompressing(false);

                    // Deal with send result
                    if (err) {
                        log.error(err);
                        log.error(`Reason: ${text}`);
                        modalSmallHOC({
                            title: i18n._('key-Workspace/WifiTransport-Failed to send file.'),
                            text: text,
                            iconColor: '#FF4D4F',
                            img: 'WarningTipsError'
                        });
                        resolve(false);
                    } else {
                        modalSmallHOC({
                            title: i18n._('key-Workspace/WifiTransport-File sent successfully.'),
                            text: i18n._('File was successfully sent. Please long press the button on the machine to start the job. If the enclosure is installed, the enclosure door needs to be closed.'),
                            iconColor: '#4CB518',
                            img: 'WarningTipsSuccess'
                        });
                        resolve(true);
                    }
                });
        });
    }, [gcodeFile]);

    const onClickUploadJob = useCallback(async () => {
        const success = await uploadBoundary();
        if (!success) {
            modalSmallHOC({
                title: i18n._('key-Workspace/WifiTransport-Failed to send file.'),
                text: i18n._('key-Workspace/WifiTransport-Failed to send file.'),
                iconColor: '#FF4D4F',
                img: 'WarningTipsError'
            });
            return;
        }

        await uploadJob();
    }, [uploadBoundary, uploadJob]);

    return (
        <div className={classNames('border-radius-8', 'background-color-white', styles['output-wrapper'])}>
            <div className={classNames('position-re', 'margin-horizontal-16', 'margin-vertical-16')}>
                <Button
                    type="primary"
                    priority="level-one"
                    onClick={onClickUploadJob}
                    disabled={!isConnected || isWorking}
                >
                    {i18n._('key-Workspace/Upload Job')}
                </Button>
            </div>

            {
                isUploading && uploadFileModalType === UploadFileModalType.Compressing && (
                    <ModalSmallHOC
                        title={i18n._('key-Workspace/WifiTransport-Sending File')}
                        text={i18n._('Compressing file. Please wait…')}
                        iconColor="#4CB518"
                        img="WarningTipsProgress"
                        showCloseButton={false}
                    />
                )
            }
            {
                isUploading && uploadFileModalType === UploadFileModalType.Decompressing && (
                    <ModalSmallHOC
                        title={i18n._('key-Workspace/WifiTransport-Sending File')}
                        text={i18n._('Decompressing file. Please wait…')}
                        iconColor="#4CB518"
                        img="WarningTipsProgress"
                        showCloseButton={false}
                    />
                )
            }
            {
                isUploading && uploadFileModalType === UploadFileModalType.Progress && (
                    <ModalSmallHOC
                        title={i18n._('key-Workspace/WifiTransport-Sending File')}
                        text={i18n._('Sending file. Please wait… {{ progress }}%', {
                            progress: (fileUploadProgress * 100).toFixed(1),
                        })}
                        iconColor="#4CB518"
                        img="WarningTipsProgress"
                        showCloseButton={false}
                    />
                )
            }
        </div>
    );
};

export default UploadView;
