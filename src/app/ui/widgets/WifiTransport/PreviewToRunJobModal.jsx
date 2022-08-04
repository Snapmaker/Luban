import React from 'react';
import PropTypes from 'prop-types';
import { includes } from 'lodash';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import i18n from '../../../lib/i18n';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../../constants';

const headTypeArr = [HEAD_PRINTING, HEAD_CNC, HEAD_LASER];
const PreviewToRunJobModal = ({
    selectFileType,
    headType,
    onClose,
    onConfirm
}) => {
    const headerTextKey = includes(selectFileType, headTypeArr) ? i18n._('key-Workspace/RunJobWarningModal-Mismatch header') : i18n._('key-Workspace/RunJobWarningModal-Unknown header');

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
                {
                    includes(selectFileType, headTypeArr) ? i18n._('key-Workspace/RunJobWarningModal-Unknown body', { headType: headType }) : i18n._('key-Workspace/RunJobWarningModal-Mismatch body', { headType: headType, fileType: selectFileType })
                }
            </Modal.Body>
            <Modal.Footer>
                <Button
                    className="margin-right-8"
                    priority="level-two"
                    type="default"
                    width="96px"
                    onClick={onClose}
                >
                    <div className="align-c">Cancel</div>
                </Button>
                <Button
                    priority="level-two"
                    type="primary"
                    width="96px"
                    onClick={handleOK}
                >
                    <div className="align-c">Yes</div>
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
