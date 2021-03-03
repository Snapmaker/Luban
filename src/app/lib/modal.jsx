/* eslint react/no-set-state: 0 */
import pick from 'lodash/pick';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import i18n from './i18n';
import Modal from '../components/Modal';

class ModalHOC extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        removeContainer: PropTypes.func.isRequired,
        title: PropTypes.node,
        body: PropTypes.node,
        footer: PropTypes.node
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
            this.props.removeContainer();
            this.props.onClose();
        });
    };

    render() {
        const { title, body, footer, size } = this.props;
        const { show } = this.state;
        const props = pick(this.props, Object.keys(Modal.propTypes));

        return (
            <Modal
                {...props}
                size={size || 'sm'}
                show={show}
                onClose={this.handleClose}
            >
                {title && (
                    <Modal.Header>
                        <Modal.Title>
                            {title}
                        </Modal.Title>
                    </Modal.Header>
                )}
                <Modal.Body>
                    {body}
                </Modal.Body>
                <Modal.Footer>
                    {footer}
                    <button type="button" className="btn btn-outline-secondary" onClick={this.handleClose}>
                        {i18n._('Close')}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default (options) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const removeContainer = () => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    };

    const props = {
        ...options,
        removeContainer: removeContainer
    };

    ReactDOM.render(<ModalHOC {...props} />, container);
    // return popupActions
    return { close: removeContainer };
};
