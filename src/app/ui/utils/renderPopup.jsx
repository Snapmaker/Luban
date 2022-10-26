import React from 'react';
import Modal from '../components/Modal/tileModal';


export default function renderPopup(options) {
    const { onClose, component: Component, key, onCallBack } = options;

    if (!onClose) {
        console.error('Popup need close action');
    }
    if (!Component) {
        console.error('Popup need component to render');
    }

    return (
        <Modal closable={false} disableOverlay tile style={{ width: '100%', height: '100%' }} onClose={onClose}>

            {/* <Modal.Body style={{ padding: '0' }}> */}
            <Component isPopup onClose={onClose} key={key} onCallBack={onCallBack} />
            {/* </Modal.Body> */}

        </Modal>
    );
}
