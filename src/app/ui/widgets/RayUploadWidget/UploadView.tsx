import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import ControllerEvent from '../../../connection/controller-events';
import { RootState } from '../../../flux/index.def';
import controller from '../../../lib/controller';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { Button } from '../../components/Buttons';
import modalSmallHOC, { ModalSmallHOC } from '../../components/Modal/modal-small';
import styles from './styles.styl';

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
    // const activeGcodeFile = useSelector((state: RootState) => state.workspace.activeGcodeFile);
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

        controller.on(ControllerEvent.UploadFileProgress, onProgress);
        controller.on(ControllerEvent.UploadFileCompressing, onCompressing);
        controller.on(ControllerEvent.UploadFileDecompressing, onDecompressing);

        return () => {
            controller.off(ControllerEvent.UploadFileProgress, onProgress);
            controller.off(ControllerEvent.UploadFileCompressing, onCompressing);
            controller.off(ControllerEvent.UploadFileDecompressing, onDecompressing);
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

    const onClickUploadJob = useCallback(() => {
        if (!gcodeFile) {
            return;
        }

        setIsUploading(true);

        controller
            .emitEvent(ControllerEvent.CompressUploadFile, {
                filePath: gcodeFile.uploadName,
                targetFilename: 'ray.nc',
            })
            .once(ControllerEvent.CompressUploadFile, ({ err, text }) => {
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
                } else {
                    modalSmallHOC({
                        title: i18n._('key-Workspace/WifiTransport-File sent successfully.'),
                        text: i18n._('File was successfully sent. Please long press the button on the machine to start the job.'),
                        iconColor: '#4CB518',
                        img: 'WarningTipsSuccess'
                    });
                }
            });
    }, [gcodeFile]);

    return (
        <div className={classNames('border-radius-8', 'background-color-white', styles['output-wrapper'])}>
            <div className={classNames('position-re', 'margin-horizontal-16', 'margin-vertical-16')}>
                <Button
                    type="primary"
                    priority="level-one"
                    onClick={onClickUploadJob}
                    disabled={!isConnected}
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
