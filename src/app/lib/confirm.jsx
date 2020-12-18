import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import Confirm from '../components/Confirm';
import i18n from './i18n';

class ConfirmHOC extends PureComponent {
    static propTypes = {
        container: PropTypes.object,
        onConfirm: PropTypes.func,
        onCancel: PropTypes.func,
        btnConfirm: Confirm.propTypes.btnConfirm,
        btnCancel: Confirm.propTypes.btnCancel
    };

    removeContainer() {
        const { container } = this.props;
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    }

    handleConfirm() {
        setTimeout(() => {
            this.removeContainer();
            this.props.onConfirm();
        });
    }

    handleCancel() {
        setTimeout(() => {
            this.removeContainer();
            this.props.onCancel();
        });
    }

    render() {
        return (
            <Confirm
                {...this.props}
                btnConfirm={{
                    text: i18n._('OK'),
                    ...this.props.btnConfirm,
                    onClick: ::this.handleConfirm
                }}
                btnCancel={{
                    text: i18n._('Cancel'),
                    ...this.props.btnCancel,
                    onClick: ::this.handleCancel
                }}
            />
        );
    }
}

export default (options) => new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const props = {
        ...options,
        onConfirm: () => {
            resolve(true);
        },
        onCancel: () => {
            resolve(false);
        },
        container: container
    };

    ReactDOM.render(<ConfirmHOC {...props} />, container);
});
