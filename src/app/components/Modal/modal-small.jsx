/* eslint react/no-set-state: 0 */
import pick from 'lodash/pick';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import i18n from '../../lib/i18n';
import Modal from './index';
import styles from './styles.styl';

class ModalSmallHOC extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        container: PropTypes.object,
        showCloseButton: PropTypes.bool,
        img: PropTypes.string,
        title: PropTypes.string.isRequired,
        text: PropTypes.string
    };


    static defaultProps = {
        ...Modal.defaultProps
    };

    state = {
        show: true
    };

    handleClose = () => {
        this.setState({ show: false });
        setTimeout(() => {
            this.removeContainer();
            this.props.onClose && this.props.onClose();
            this.props.onCancel && this.props.onCancel();
        });
    };

    handleConfirm = () => {
        this.setState({ show: false });
        setTimeout(() => {
            this.removeContainer();
            this.props.onClose && this.props.onClose();
            this.props.onConfirm && this.props.onConfirm();
        });
    };

    removeContainer() {
        const { container } = this.props;
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    }

    render() {
        const { onCancel, onConfirm, showCloseButton = true } = this.props;
        const { show } = this.state;
        const img = this.props.img || '../../images/ic_warning-64x64.png';
        const text = this.props.text;
        const title = this.props.title;
        const props = pick(this.props, Object.keys(Modal.propTypes));

        return (
            <Modal
                {...props}
                showCloseButton={showCloseButton}
                onClose={this.handleClose}
                show={show}
                style={{
                    borderRadius: '4px'
                }}
            >
                <Modal.Body style={{
                    marginBottom: '42px'
                }}
                >
                    <div className={styles['modal-small-img']}>
                        <img src={img} width="64" height="64" alt="......" />
                    </div>
                    <div className={styles['modal-small-body-text']}>
                        {i18n._(title)}
                    </div>
                    {text && (
                        <div className={styles['modal-small-body-hit']}>
                            {i18n._(text)}
                        </div>
                    )}

                </Modal.Body>
                {onCancel && onConfirm && (
                    <Modal.Footer>
                        <button
                            type="button"
                            className="btn btn-default"
                            style={{
                                float: 'left'
                            }}
                            onClick={this.handleClose}
                        >
                            {i18n._('Cancel')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={this.handleConfirm}
                        >
                            {i18n._('Confirm')}
                        </button>
                    </Modal.Footer>
                )}
            </Modal>
        );
    }
}
export default (options) => {
    const ref = React.createRef();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const props = {
        ...options,
        // onClose: () => {
        //     resolve();
        // },
        container: container
    };
    ReactDOM.render(<ModalSmallHOC ref={ref} {...props} />, container);

    return {
        ref: ref
    };
};
