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
import styles from './styles.styl';

export type LoadGcodeOptions = {
    renderImmediately?: boolean;
};

const UploadView: React.FC = () => {
    // const activeMachine = useSelector((state: RootState) => state.machine.activeMachine);
    // const dispatch = useDispatch();

    // const activeGcodeFile = useSelector((state: RootState) => state.workspace.activeGcodeFile);
    const gcodeFile = useSelector((state: RootState) => state.workspace.gcodeFile);

    console.log('active G-code file', gcodeFile);

    const onClickUploadJob = useCallback(() => {
        if (!gcodeFile) {
            return;
        }

        controller
            .emitEvent(CONNECTION_UPLOAD_FILE, {
                gcodePath: `/${gcodeFile.uploadName}`,
                renderGcodeFileName: 'ray.nc',
            })
            .once(CONNECTION_UPLOAD_FILE, ({ err, text }) => {
                if (err) {
                    log.error('Unable to upload G-code to execute.');
                    log.error(err);
                    log.error(`Reason: ${text}`);
                } else {
                    log.info('Uploaded G-code.');
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
