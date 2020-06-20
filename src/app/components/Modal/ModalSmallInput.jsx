import '@trendmicro/react-modal/dist/react-modal.css';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Modal from './index';
import styles from './styles.styl';
import i18n from '../../lib/i18n';

class ModalSmallInput extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        showCloseButton: PropTypes.bool,
        img: PropTypes.string,
        title: PropTypes.string.isRequired,
        text: PropTypes.string,
        label: PropTypes.string,
        inputText: PropTypes.string
    };

    static defaultProps = {
        ...Modal.defaultProps
    };

    state = {
        inputText: ''
    };

    actions = {
        onInputChange: (event) => {
            this.setState({ inputText: event.target.value });
        }
    };

    render() {
        const { onClose, onCancel, onConfirm, showCloseButton = true, ...props } = this.props;
        const img = this.props.img || '../../images/ic_warning-64x64.png';
        const text = this.props.text;
        const label = this.props.label;
        const subtext = this.props.subtext;
        const title = this.props.title;
        const inputText = this.state.inputText;

        return (
            <Modal
                {...props}
                showCloseButton={showCloseButton}
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
                        <img src={img} alt="......" />
                    </div>
                    <div className={styles['modal-small-body-text']}>
                        {i18n._(title)}
                    </div>
                    {text && (
                        <div className={styles['modal-small-body-hit']}>
                            {i18n._(text)}
                        </div>
                    )}
                    {subtext && (
                        <div className={styles['modal-small-body-hit']}>
                            {i18n._(subtext)}
                        </div>
                    )}
                    <div className="form-group">
                        {/* eslint-disable-next-line jsx-a11y/label-has-for */}
                        <label id="modal-small-input-label" htmlFor="modal-small-input">{label}</label>
                        <input id="modal-small-input" type="text" className="form-control" value={inputText} onChange={this.actions.onInputChange} />
                    </div>


                </Modal.Body>
                {onCancel && onConfirm && (
                    <Modal.Footer>
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            style={{
                                float: 'left'
                            }}
                            onClick={onCancel}
                        >
                            {i18n._('Cancel')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => { onConfirm(inputText); }}
                        >
                            {i18n._('Confirm')}
                        </button>
                    </Modal.Footer>
                )}
            </Modal>
        );
    }
}

export default ModalSmallInput;
