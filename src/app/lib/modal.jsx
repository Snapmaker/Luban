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
        defaultInputValue: PropTypes.string,
        title: PropTypes.node,
        body: PropTypes.node,
        footer: PropTypes.node
    };

    static defaultProps = {
        ...Modal.defaultProps
    };

    state = {
        show: true,
        defaultInputValue: this.props.defaultInputValue ? this.props.defaultInputValue : ''
    };

    onChangeInputValue = (event) => {
        console.log('onChangeInputValue', event.target.value);
        this.setState({ defaultInputValue: event.target.value });
    }

    handleClose = () => {
        this.setState({ show: false });
        setTimeout(() => {
            this.props.removeContainer();
            this.props.onClose();
        });
    };

    render() {
        const { title, body, footer, size } = this.props;
        const { show, defaultInputValue } = this.state;
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
                    {this.props.defaultInputValue && (
                        <input
                            type="text"
                            className="sm-parameter-row__input"
                            style={{ height: '30px',
                                width: '100%',
                                padding: '6px 12px',
                                fontSize: '13px',
                                lineHeight: '1.42857143',
                                color: '#282828',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderRadius: '4px',
                                borderColor: '#c8c8c8' }}
                            onChange={this.onChangeInputValue}
                            value={defaultInputValue}
                        />
                    )}
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
