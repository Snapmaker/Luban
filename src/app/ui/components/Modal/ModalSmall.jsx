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
                    maxWidth: '432px' // 480 - 48 = 432
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
                {onConfirm && !onCancel && (
                    <Modal.Footer>
                        <Button
                            priority="level-two"
                            className="margin-left-8"
                            width="96px"
                            onClick={onConfirm}
                        >
                            {i18n._('key-Modal/Common-Confirm')}
                        </Button>
                    </Modal.Footer>
                )}
                {onCancel && onConfirm && (
                    <Modal.Footer>
                        <Button
                            priority="level-two"
                            className="margin-left-8"
                            width="96px"
                            type="default"
                            onClick={onCancel}
                        >
                            {i18n._('key-Modal/Common-Cancel')}
                        </Button>
                        <Button
                            priority="level-two"
                            className="margin-left-8"
                            width="96px"
                            onClick={onConfirm}
                        >
                            {i18n._('key-Modal/Common-Confirm')}
                        </Button>
                    </Modal.Footer>
                )}
            </Modal>
        );
    }
}

export default ModalSmall;
