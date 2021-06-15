import React from 'react';
import Modal from '../components/Modal';
// import { Button } from '../components/Buttons';

// import i18n from '../../lib/i18n';

export default function renderPopup(options) {
    const { onClose, component: Component } = options;


    if (!onClose) {
        console.error('Popup need close action');
    }
    if (!Component) {
        console.error('Popup need component to render');
    }


    return (
        <Modal disableOverlay style={{ width: '100%', height: '100%' }} onClose={onClose}>

            <Modal.Body>
                <Component isPopup onClose={onClose} />
            </Modal.Body>

        </Modal>
    );
}
