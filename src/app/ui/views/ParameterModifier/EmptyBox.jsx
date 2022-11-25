import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';

const EmptyBox = ({ tipContent, addButton, setMode }) => (
    <div className="position-ab-center align-c">
        <img src="/resources/images/empty-box-268x201.svg" alt="" />
        <div>{tipContent}</div>
        <Button
            priority="level-two"
            type="primary"
            width="210px"
            className={`margin-top-32 ${addButton ? 'visibility-visible' : 'visibility-hidden'}`}
            onClick={() => setMode('update')}
        >
            {i18n._('Add modifier')}
        </Button>
    </div>
);

EmptyBox.propTypes = {
    tipContent: PropTypes.string.isRequired,
    addButton: PropTypes.bool.isRequired,
    setMode: PropTypes.func.isRequired
};

export default EmptyBox;
