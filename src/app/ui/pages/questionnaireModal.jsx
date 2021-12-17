import React from 'react';
import { Trans } from 'react-i18next';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import { Button } from '../components/Buttons';
import Modal from '../components/Modal';
import SvgIcon from '../components/SvgIcon';

const QuestionnaireModal = ({ onClose, onComfirm }) => {
    return (
        <Modal closable onClose={() => onClose()}>
            <Modal.Body className="flex-column sm-flex-overflow-visible align-center">
                <SvgIcon
                    name="IconSurvey"
                    color="#1890FF"
                    type={['static']}
                    size={60}
                />
                <div className="margin-top-32">
                    <span className="heading-3">{i18n._('key-QuestionnaireModal/Title-Luban User Experience Questionnaire')}</span>
                    <p className="align-c margin-top-10 margin-bottom-8">
                        <Trans i18nKey="key-QuestionnaireModal/Tip-Tip1">
                            Would you like to fill in this questionnaire to help us <br />
                            improve the function of Luban and provide better user experience? <br />
                            It will take you about 5 minutes to complete this questionnaire. <br />
                        </Trans>
                    </p>
                    <p className="align-c">
                        <Trans i18nKey="key-QuestionnaireModal/Tip-Tip2">
                            We appreciate you help and will give you a <span className="color-red-1">$ 10 coupon</span> as a reward.
                        </Trans>
                    </p>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="default"
                    priority="level-two"
                    onClick={() => onClose()}
                    width="96px"
                    className="margin-right-8"
                >
                    {i18n._('key-QuestionnaireModal/Footer-No thanks')}
                </Button>
                <a href="https://www.surveymonkey.com/r/GPMWXC6" target="_blank" rel="noopener noreferrer">
                    <Button
                        type="primary"
                        priority="level-two"
                        onClick={onComfirm}
                        width="96px"
                    >
                        {/* <a className="white-text" href="https://www.surveymonkey.com/r/GPMWXC6" target="_blank" rel="noopener noreferrer">{i18n._('key-QuestionnaireModal/Footer-Ok')}</a> */}
                        {i18n._('key-QuestionnaireModal/Footer-Ok')}
                    </Button>
                </a>
            </Modal.Footer>
        </Modal>
    );
};

QuestionnaireModal.propTypes = {
    onClose: PropTypes.func,
    onComfirm: PropTypes.func
};
export default QuestionnaireModal;
