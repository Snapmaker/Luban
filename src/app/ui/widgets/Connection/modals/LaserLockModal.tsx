import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { RootState } from '../../../../flux/index.def';
import usePrevious from '../../../../lib/hooks/previous';
import i18n from '../../../../lib/i18n';
import Modal from '../../../components/Modal';

const LaserLockModal: React.FC = () => {
    const [showModal, setShowModal] = useState(false);

    const laserIsLocked = useSelector((state: RootState) => state.workspace.laserIsLocked) as boolean;
    const previousIsLocked = usePrevious(laserIsLocked);

    useEffect(() => {
        if (!previousIsLocked && laserIsLocked) {
            setShowModal(true);
        }
    }, [previousIsLocked, laserIsLocked]);

    return (
        showModal && (
            <Modal
                onClose={() => setShowModal(false)}
                style={{
                    borderRadius: '8px'
                }}
            >
                <Modal.Header>
                    {i18n._('key-Common/Notice')}
                </Modal.Header>
                <Modal.Body style={{ maxWidth: '432px' }}>
                    {i18n._('key-Workspace/Connection-The laser function is locked, please go to the screen to unlock it.')}
                </Modal.Body>
            </Modal>
        )
    );
};

export default LaserLockModal;
