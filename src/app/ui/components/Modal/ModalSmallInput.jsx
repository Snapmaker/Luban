import '@trendmicro/react-modal/dist/react-modal.css';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Modal from './index';
import { Button } from '../Buttons';
import { TextInput } from '../Input';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';

class ModalSmallInput extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        showCloseButton: PropTypes.bool,
        img: PropTypes.string,
        title: PropTypes.string.isRequired,
        text: PropTypes.string,
        label: PropTypes.string,
        inputtext: PropTypes.string
    };

    static defaultProps = {
        ...Modal.defaultProps
    };

    state = {
        inputtext: this.props.inputtext
    };

    actions = {
        onInputChange: (event) => {
            this.setState({ inputtext: event.target.value });
        }
    };

    render() {
        const { onClose, onCancel, onConfirm, showCloseButton = true, ...props } = this.props;
        const img = this.props.img;
        const text = this.props.text;
        const label = this.props.label;
        const subtext = this.props.subtext;
        const title = this.props.title;
        const inputtext = this.state.inputtext;

        return (
            <Modal
                {...props}
                showCloseButton={showCloseButton}
                onClose={onClose}
            >
                <Modal.Header>
                    {title}
                </Modal.Header>
                <Modal.Body style={{
                    marginBottom: '42px'
                }}
                >
                    {img && (
                        <div className={styles['modal-small-img']}>
                            <img src={img} alt="......" />
                        </div>
                    )}
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
                        <TextInput
                            id="modal-small-input"
                            size="100%"
                            className="display-block"
                            value={inputtext}
                            onChange={this.actions.onInputChange}
                        />
                    </div>


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
                            {i18n._('key-Modal/Common-Cancel')}
                        </Button>
                        <Button
                            priority="level-two"
                            className="margin-left-8"
                            width="96px"
                            disabled={!(inputtext.trim())}
                            onClick={() => { onConfirm(inputtext); }}
                        >
                            {i18n._('key-Modal/Common-Confirm')}
                        </Button>
                    </Modal.Footer>
                )}
            </Modal>
        );
    }
}

export default ModalSmallInput;
