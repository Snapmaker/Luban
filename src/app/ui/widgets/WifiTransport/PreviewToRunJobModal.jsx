import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import i18n from '../../../lib/i18n';

const PreviewToRunJobModal = (props) => {
    const headerTextKey = props.isMismatchHead ? 'key-Workspace/RunJobWarningModal-Mismatch header' : 'key-Workspace/RunJobWarningModal-Unknown header';
    const bodyTextKey = props.isMismatchHead ? 'key-Workspace/RunJobWarningModal-Mismatch body' : 'key-Workspace/RunJobWarningModal-Unknown body';

    return (
        <Modal
            centered
            visible
            onClose={() => { props.onClose(); }}
        >
            <Modal.Header>
                {i18n._(headerTextKey)}
            </Modal.Header>
            <Modal.Body>
                {i18n._(bodyTextKey, { gcodeType: props.gcodeType, headType: props.headType })}
            </Modal.Body>
            <Modal.Footer>
                <Button
                    className="margin-right-8"
                    priority="level-two"
                    type="default"
                    width="96px"
                    onClick={() => { props.onClose(); }}
                >
                    <div className="align-c">Cancel</div>
                </Button>
                <Button
                    priority="level-two"
                    type="primary"
                    width="96px"
                    onClick={() => { props.onConfirm(); props.onClose(); }}
                >
                    <div className="align-c">Yes</div>
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

PreviewToRunJobModal.propTypes = {
    isMismatchHead: PropTypes.bool.isRequired,
    gcodeType: PropTypes.string,
    headType: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
};

export default PreviewToRunJobModal;
