import React from 'react';

import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';

interface StopJobConfirmModalProps {
    onClose: () => void;
    onConfirm: () => void;
}

const StopJobConfirmModal: React.FC<StopJobConfirmModalProps> = (props) => {
    const { onClose, onConfirm } = props;

    return (
        <Modal
            centered
            open
            onClose={onClose}
        >
            <Modal.Header>
                {i18n._('Stop job')}
            </Modal.Header>
            <Modal.Body>
                {i18n._('Are you sure you want to stop the print job?')}
            </Modal.Body>
            <Modal.Footer>
                <Button
                    className="margin-right-8"
                    priority="level-two"
                    type="default"
                    width="96px"
                    onClick={onClose}
                >
                    <div className="align-c">{i18n._('key-Workspace/Workprogress-StopJobConfirmModal Cancel')}</div>
                </Button>
                <Button
                    priority="level-two"
                    type="primary"
                    width="96px"
                    onClick={() => {
                        onConfirm();
                        onClose();
                    }}
                >
                    <div className="align-c">{i18n._('key-Workspace/Workprogress-StopJobConfirmModal Yes')}</div>
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default StopJobConfirmModal;
