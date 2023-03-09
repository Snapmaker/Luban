import { includes } from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING, START_JOB_MISMATCH_GCODE_INFO, START_JOB_MISMATCH_HEAD_INFO } from '../../../constants';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';

const headTypeArr = [HEAD_PRINTING, HEAD_CNC, HEAD_LASER];
const PreviewToRunJobModal = ({
    selectFileType,
    headType,
    onClose,
    onConfirm
}) => {
    const headerTextKey = includes(headTypeArr, selectFileType) ? i18n._('key-Workspace/RunJobWarningModal-Mismatch header') : i18n._('key-Workspace/RunJobWarningModal-Unknown header');
    const headTypeWithI18n = i18n._(START_JOB_MISMATCH_HEAD_INFO[headType]);
    const fileTypeWithI18n = i18n._(START_JOB_MISMATCH_GCODE_INFO[selectFileType]);
    const handleOK = () => {
        onConfirm();
        onClose();
    };

    return (
        <Modal
            centered
            visible
            onClose={onClose}
        >
            <Modal.Header>
                {headerTextKey}
            </Modal.Header>
            <Modal.Body>
                <div className="width-438">
                    {
                        includes(headTypeArr, selectFileType)
                            ? i18n._('key-Workspace/RunJobWarningModal-Mismatch body', { headType: headTypeWithI18n, fileType: fileTypeWithI18n })
                            : i18n._('key-Workspace/RunJobWarningModal-Unknown body', { headType: headTypeWithI18n })
                    }
                </div>

            </Modal.Body>
            <Modal.Footer>
                <Button
                    className="margin-right-8"
                    priority="level-two"
                    type="default"
                    width="96px"
                    onClick={onClose}
                >
                    <div className="align-c">{i18n._('key-Modal/Common-Cancel')}</div>
                </Button>
                <Button
                    priority="level-two"
                    type="primary"
                    width="96px"
                    onClick={handleOK}
                >
                    <div className="align-c">{i18n._('key-Modal/Common-Start')}</div>
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

PreviewToRunJobModal.propTypes = {
    selectFileType: PropTypes.string,
    headType: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
};

export default PreviewToRunJobModal;
