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

const UploadView: React.FC = () => {
    // const activeMachine = useSelector((state: RootState) => state.machine.activeMachine);
    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);
    // const activeGcodeFile = useSelector((state: RootState) => state.workspace.activeGcodeFile);
    const gcodeFile = useSelector((state: RootState) => state.workspace.gcodeFile);

    const [fileUploadProgress, setFileUploadProgress] = useState(0);

    useEffect(() => {
        const onProgress = ({ progress }) => {
            setFileUploadProgress(progress);
        };

        controller.on(ControllerEvent.UploadFileProgress, onProgress);

        return () => {
            controller.off(ControllerEvent.UploadFileProgress, onProgress);
        };
    }, []);

    const [showFileUploadProgressModal, setShowFileUploadProgressModal] = useState(false);

    useEffect(() => {
        if (fileUploadProgress > 0) {
            setShowFileUploadProgressModal(true);
        }
    }, [fileUploadProgress]);

    const onClickUploadJob = useCallback(() => {
        if (!gcodeFile) {
            return;
        }

        controller
            .emitEvent(ControllerEvent.CompressUploadFile, {
                filePath: gcodeFile.uploadName,
                targetFilename: 'ray.nc',
            })
            .once(ControllerEvent.CompressUploadFile, ({ err, text }) => {
                // close sending modal
                // TODO
                setShowFileUploadProgressModal(false);

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
                showFileUploadProgressModal && (
                    <ModalSmallHOC
                        title={i18n._('key-Workspace/WifiTransport-Sending File')}
                        text={i18n._('Sending file. Please wait… {{ progress }}%', {
                            progress: (fileUploadProgress * 100).toFixed(1),
                        })}
                        iconColor="#4CB518"
                        img="WarningTipsProgress"
                    />
                )
            }
        </div>
    );
};

export default UploadView;
