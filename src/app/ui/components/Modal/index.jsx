import '@trendmicro/react-modal/dist/react-modal.css';
import Modal from '@trendmicro/react-modal';
import React, { PureComponent } from 'react';
import UniApi from '../../../lib/uni-api';

class ModalWrapper extends PureComponent {
    static propTypes = {
        ...Modal.propTypes
    };

    static defaultProps = {
        ...Modal.defaultProps
    };

    componentDidMount() {
        UniApi.Event.emit('appbar-menu:disable');
        this.blockScrolling();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.show !== this.props.show) {
            if (nextProps.show) {
                this.blockScrolling();
            } else {
                this.unblockScrolling();
            }
        }
    }

    componentWillUnmount() {
        UniApi.Event.emit('appbar-menu:enable');
        this.unblockScrolling();
    }

    blockScrolling() {
        const body = document.querySelector('body');
        body.style.overflowY = 'hidden';
    }

    unblockScrolling() {
        const body = document.querySelector('body');
        body.style.overflowY = 'auto';
    }

    render() {
        const { onClose, ...props } = this.props;

        return (
            <Modal
                {...props}
                disableOverlay
                onClose={() => {
                    this.unblockScrolling();
                    onClose();
                }}
            />
        );
    }
}

ModalWrapper.Overlay = Modal.Overlay;
ModalWrapper.Content = Modal.Content;
ModalWrapper.Header = Modal.Header;
ModalWrapper.Title = Modal.Title;
ModalWrapper.Body = Modal.Body;
ModalWrapper.Footer = Modal.Footer;

export default ModalWrapper;
