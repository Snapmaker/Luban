import React, { useCallback } from 'react';

import Modal from '../../../components/Modal';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';


interface HomeTipModalProps {
    onClose: () => void;
    onOk: () => void;
}

const HomeTipModal: React.FC<HomeTipModalProps> = (props) => {
    const { onClose, onOk } = props;

    const onClickOk = useCallback(() => {
        onOk && onOk();
        onClose && onClose();
    }, [onClose, onOk]);

    return (
        <Modal size="sm" closable={false}>
            <Modal.Header>
                {i18n._('key-Modal/tips-Tips')}
            </Modal.Header>
            <Modal.Body>
                <div>
                    {i18n._('This mode requires homing to update the current machine coordinates. Would you like to continue?')}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="default"
                    priority="level-two"
                    className="align-r"
                    width="96px"
                    onClick={() => onClose && onClose()}
                >
                    {i18n._('key-Modal/Common-Cancel')}
                </Button>
                <Button
                    type="primary"
                    priority="level-two"
                    className="align-r"
                    width="96px"
                    onClick={onClickOk}
                >
                    {i18n._('key-Modal/Common-Confirm')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default HomeTipModal;
