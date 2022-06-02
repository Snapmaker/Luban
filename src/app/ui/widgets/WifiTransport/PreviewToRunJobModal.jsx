import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import i18n from '../../../lib/i18n';

const PreviewToRunJobModal = (props) => {
    const headerTextKey = props.isMismatchHead ? i18n._('key-Workspace/RunJobWarningModal-Mismatch header') : i18n._('key-Workspace/RunJobWarningModal-Unknown header');
    const [bodyTextKey, setBodyTextKey] = useState('--');

    useEffect(() => {
        if (props.isUnKownHead) {
            setBodyTextKey(i18n._('key-Workspace/RunJobWarningModal-Unknown toolhead', { gcodeType: props.gcodeType, headType: props.headType }));
        } else if (props.isMismatchHead) {
            setBodyTextKey(i18n._('key-Workspace/RunJobWarningModal-Mismatch body', { gcodeType: props.gcodeType, headType: props.headType }));
        } else {
            setBodyTextKey(i18n._('key-Workspace/RunJobWarningModal-Unknown body', { gcodeType: props.gcodeType, headType: props.headType }));
        }
    }, [props.isUnKownHead, props.isMismatchHead]);


    return (
        <Modal
            centered
            visible
            onClose={() => { props.onClose(); }}
        >
            <Modal.Header>
                {headerTextKey}
            </Modal.Header>
            <Modal.Body>
                {bodyTextKey}
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
    isUnKownHead: PropTypes.bool.isRequired,
    gcodeType: PropTypes.string,
    headType: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
};

export default PreviewToRunJobModal;
