import React, { useCallback } from 'react';

import Modal from '../../../components/Modal';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';


interface RunBoundaryModalProps {
    onClose: () => void;
}

const RunBoundaryModal: React.FC<RunBoundaryModalProps> = (props) => {
    const { onClose } = props;

    const onClickOk = useCallback(() => {
        onClose && onClose();
    }, [onClose]);

    return (
        <Modal size="sm" closable={false}>
            <Modal.Header>
                {i18n._('Run Boundary')}
            </Modal.Header>
            <Modal.Body>
                <div>
                    {i18n._('Please go to the machine, click button to run boundary. If the enclosure is installed, the enclosure door needs to be closed.')}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="primary"
                    priority="level-two"
                    className="align-r"
                    width="96px"
                    onClick={onClickOk}
                >
                    {i18n._('key-Workspace/Connection-OK')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default RunBoundaryModal;
