import classNames from 'classnames';
import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';

import {
    CONNECTION_UPLOAD_FILE
} from '../../../constants';
import { RootState } from '../../../flux/index.def';
import controller from '../../../lib/controller';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { Button } from '../../components/Buttons';
import modalSmallHOC from '../../components/Modal/modal-small';
import styles from './styles.styl';

export type LoadGcodeOptions = {
    renderImmediately?: boolean;
};

const UploadView: React.FC = () => {
    // const activeMachine = useSelector((state: RootState) => state.machine.activeMachine);
    // const dispatch = useDispatch();

    // const activeGcodeFile = useSelector((state: RootState) => state.workspace.activeGcodeFile);
    const gcodeFile = useSelector((state: RootState) => state.workspace.gcodeFile);

    const onClickUploadJob = useCallback(() => {
        if (!gcodeFile) {
            return;
        }

        const sendingModal = modalSmallHOC({
            title: i18n._('key-Workspace/WifiTransport-Sending File'),
            text: i18n._('key-Workspace/WifiTransport-Sending file. Please wait…'),
            iconColor: '#4CB518',
            img: 'WarningTipsProgress'
        }).ref;

        controller
            .emitEvent(CONNECTION_UPLOAD_FILE, {
                gcodePath: `/${gcodeFile.uploadName}`,
                renderGcodeFileName: 'ray.nc',
            })
            .once(CONNECTION_UPLOAD_FILE, ({ err, text }) => {
                // close sending modal
                if (sendingModal.current) {
                    sendingModal.current.removeContainer();
                }

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
                    disabled={false}
                >
                    {i18n._('key-Workspace/Upload Job')}
                </Button>
            </div>
        </div>
    );
};

export default UploadView;
