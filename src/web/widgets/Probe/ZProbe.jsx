import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal';
import ToggleSwitch from '../../components/ToggleSwitch';
import i18n from '../../lib/i18n';

const ZProbe = (props) => {
    const { state, actions } = props;
    const { useTLO } = state;
    const probeCommands = actions.populateProbeCommands();
    const content = probeCommands.join('\n');

    return (
        <Modal size="sm" onClose={actions.closeModal}>
            <Modal.Header>
                <Modal.Title>{i18n._('Z-Probe')}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    <ToggleSwitch
                        checked={useTLO}
                        size="sm"
                        onChange={actions.toggleUseTLO}
                    />
                    {i18n._('Apply tool length offset')}
                </p>
                <pre style={{ minHeight: 240 }}>
                    <code>{content}</code>
                </pre>
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
                        actions.closeModal();
                        actions.runProbeCommands(probeCommands);
                    }}
                >
                    {i18n._('Run Z-Probe')}
                </button>
            </Modal.Footer>
        </Modal>
    );
};

ZProbe.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};
export default ZProbe;
