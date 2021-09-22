import '@trendmicro/react-modal/dist/react-modal.css';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Modal from './index';
import { Button } from '../Buttons';
import SvgIcon from '../SvgIcon';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';

class ModalSmall extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        showCloseButton: PropTypes.bool,
        img: PropTypes.string,
        iconColor: PropTypes.string,
        title: PropTypes.string.isRequired,
        text: PropTypes.string,
        subtext: PropTypes.string
    };

    static defaultProps = {
        ...Modal.defaultProps
    };

    render() {
        const { onClose, onCancel, onConfirm, showCloseButton = true, ...props } = this.props;
        const img = this.props.img || '';
        const iconColor = this.props.iconColor;
        const isImage = new RegExp(/^\/resources/).test(img);
        const text = this.props.text;
        const subtext = this.props.subtext;
        const title = this.props.title;

        return (
            <Modal
                {...props}
                showCloseButton={showCloseButton}
                onClose={onClose}
                style={{
                    borderRadius: '8px'
                }}
            >
                <Modal.Body style={{
                    marginBottom: '42px',
                    maxWidth: '480px',
                    paddingLeft: '40px',
                    paddingRight: '40px'
                }}
                >
                    <div className={styles['modal-small-img']}>
                        {!isImage && (
                            <SvgIcon
                                name={img}
                                color={iconColor}
                                type={['static']}
                                size={72}
                            />
                        )}
                        {isImage && (<img src={img} alt="......" />)}
                    </div>
                    <div className={styles[`${!isImage ? 'modal-small-body-text-svg' : 'modal-small-body-text'}`]}>
                        {i18n._(title)}
                    </div>
                    {text && (
                        <div
                            className={styles['modal-small-body-hit']}
                        >
                            {i18n._(text)}
                        </div>
                    )}
                    {subtext && (
                        <div
                            className={styles['modal-small-body-hit']}
                            style={{
                                color: '#808080',
                                lineHeight: '24px'
                            }}
                        >
                            {i18n._(subtext)}
                        </div>
                    )}

                </Modal.Body>
                {onCancel && onConfirm && (
                    <Modal.Footer>
                        <Button
                            priority="level-two"
                            className="margin-left-8"
                            width="96px"
                            type="default"
                            onClick={onCancel}
                        >
                            {i18n._('key_ui/components/Modal/ModalSmall_Cancel')}
                        </Button>
                        <Button
                            priority="level-two"
                            className="margin-left-8"
                            width="96px"
                            onClick={onConfirm}
                        >
                            {i18n._('key_ui/components/Modal/ModalSmall_Confirm')}
                        </Button>
                    </Modal.Footer>
                )}
            </Modal>
        );
    }
}

export default ModalSmall;
