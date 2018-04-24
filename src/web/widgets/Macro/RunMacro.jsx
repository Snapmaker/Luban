import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import Modal from '../../components/Modal';


const RunMacro = (props) => {
    const { state, actions } = props;
    const { modalParams } = state;
    const { id, name, content } = { ...modalParams };

    return (
        <Modal
            onClose={actions.closeModal}
            size="md"
        >
            <Modal.Header>
                <Modal.Title>
                    {i18n._('Run Macro')}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div style={{ marginBottom: 10 }}>
                    <label><strong>{name}</strong></label>
                    <textarea
                        readOnly
                        rows="10"
                        className="form-control"
                        value={content}
                    />
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    type="button"
                    className="btn btn-default"
                    onClick={actions.closeModal}
                >
                    {i18n._('Cancel')}
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                        actions.runMacro(id, { name });
                        actions.closeModal();
                    }}
                >
                    {i18n._('Run')}
                </button>
            </Modal.Footer>
        </Modal>
    );
};

RunMacro.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};
export default RunMacro;
