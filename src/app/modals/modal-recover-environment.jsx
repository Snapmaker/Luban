/* eslint react/no-set-state: 0 */
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';

import { Button } from '@trendmicro/react-buttons';
import i18n from '../lib/i18n';
import Modal from '../components/Modal';
import { MACHINE_HEAD_TYPE, MACHINE_SERIES } from '../constants';

import styles from './styles.styl';

class RecoveryEnvironmentModal extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        series: PropTypes.string,
        headType: PropTypes.string,
        onRecovery: PropTypes.func.isRequired,
        quitRecovery: PropTypes.func.isRequired,
        onConfirm: PropTypes.func
    };

    static defaultProps = {
        ...Modal.defaultProps
    };

    state = {
        series: this.props.series || MACHINE_SERIES.ORIGINAL.value,
        headType: this.props.headType || MACHINE_HEAD_TYPE['3DP'].value
    };


    onRecovery = () => {
        this.handleClose();
        this.props.onRecovery();
    }

    quitRecovery = () => {
        this.props.quitRecovery();
        this.handleClose();
    }

    handleClose = () => {
        setTimeout(() => {
            this.removeContainer();
        });
    };

    handleConfirm = () => {
        setTimeout(() => {
            this.removeContainer();
            this.props.onConfirm && this.props.onConfirm(this.state.series, this.state.headType);
        });
    };

    removeContainer() {
        const { container } = this.props;
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    }

    render() {
        return (
            <Modal disableOverlay showCloseButton={false} size="md" onClose={this.handleClose}>
                <Modal.Header>
                    <Modal.Title>
                        <div className={styles['device-not-recognized']}>{i18n._('Project Recover')}</div>

                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className={styles['which-model']}>{i18n._('The program quit due to an unknown error (reason.) Do you want to recover your last project?')}
                    </div>

                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={this.quitRecovery}
                    >
                        {i18n._('Quit')}
                    </Button>
                    <Button
                        btnStyle="primary"
                        onClick={this.onRecovery}
                    >
                        {i18n._('Recover')}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default (options) => new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const props = {
        ...options,
        onClose: () => {
            resolve();
        },
        container: container
    };

    ReactDOM.render(<RecoveryEnvironmentModal {...props} />, container);
});
