import '@trendmicro/react-modal/dist/react-modal.css';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Modal from './index';
import styles from './styles.styl';
import i18n from '../../lib/i18n';

class ModalSmall extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        img: PropTypes.string,
        text: PropTypes.string.isRequired,
        hit: PropTypes.string
    };

    static defaultProps = {
        ...Modal.defaultProps
    };

    render() {
        const { onClose, ...props } = this.props;
        const img = this.props.img || '../../images/ic_warning-64x64.png';
        const text = this.props.text;
        const hit = this.props.hit;

        return (
            <Modal
                {...props}
                onClose={onClose}
                style={{
                    borderRadius: '4px'
                }}
            >
                <Modal.Body style={{
                    marginBottom: '42px'
                }}
                >
                    <div className={styles['modal-small-img']}>
                        <img src={img} alt="warning" />
                    </div>
                    <div className={styles['modal-small-body-text']}>
                        {i18n._(text)}
                    </div>
                    {hit && (
                        <div className={styles['modal-small-body-hit']}>
                            {i18n._(hit)}
                        </div>
                    )}

                </Modal.Body>
            </Modal>
        );
    }
}

export default ModalSmall;
