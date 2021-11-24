import React from 'react';
import Modal from '../components/Modal';
import { Button } from '../components/Buttons';

import i18n from '../../lib/i18n';

export default function renderModal(options) {
    const { actions, onClose, zIndex } = options;

    let { renderFooter, renderBody, size, title } = options;
    const { shouldRenderFooter = true } = options;

    if (!onClose) {
        console.error('Modal need close action');
    }

    size || (size = 'small');
    title || (title = i18n._('key-unused-Warning'));

    if (!renderFooter) {
        renderFooter = () => (
            <React.Fragment>
                {
                    actions.map(({ name, isPrimary, isAutoWidth, onClick, disabled = false }) => (
                        <Button
                            disabled={disabled}
                            key={name}
                            priority="level-two"
                            className="margin-left-8"
                            width={isAutoWidth ? 'auto' : '96px'}
                            type={isPrimary ? 'primary' : 'default'}
                            onClick={onClick}
                        >
                            {name}
                        </Button>
                    ))
                }
            </React.Fragment>
        );
    }
    if (!renderBody) {
        renderBody = () => (null);
    }

    return (
        <Modal disableOverlay size={size} onClose={onClose} zIndex={zIndex}>
            <Modal.Header>
                {/* <Modal.Title> */}
                {title}
                {/* </Modal.Title> */}
            </Modal.Header>
            <Modal.Body>
                {renderBody()}
            </Modal.Body>
            {shouldRenderFooter && (
                <Modal.Footer>
                    {renderFooter()}
                </Modal.Footer>
            )}
        </Modal>
    );
}
