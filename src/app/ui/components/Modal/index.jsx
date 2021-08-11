import React, { PureComponent } from 'react';
// import '@trendmicro/react-modal/dist/react-modal.css';
// import Modal from '@trendmicro/react-modal';
import PropTypes from 'prop-types';

import './modal.styl';
import { filter } from 'lodash';
import { Modal } from 'antd';
import classNames from 'classnames';
import Title from './modalTitle';
import styles from './styles.styl';
import Body from './modalBody';
import Footer from './modalFooter';
import UniApi from '../../../lib/uni-api';

class ModalWrapper extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        modalWrapperClassName: PropTypes.string,
        tile: PropTypes.bool
    };

    static defaultProps = {
        ...Modal.defaultProps,
        visible: true,
        width: 'auto',
        size: 'md',
        modalWrapperClassName: 'modal-wrapper',
        tile: false
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

    renderTitle = () => {
        if (this.props.children instanceof Array) {
            const titleNode = filter(this.props.children, (o) => {
                return o?.props?.key === 'modalTitle';
            });
            if (!titleNode.length) {
                return null;
            } else {
                return titleNode;
            }
        } else {
            if (this.props.children.props.key === 'modalTitle') {
                return this.props.children;
            } else {
                return null;
            }
        }
    }

    renderBody = () => {
        if (this.props.children instanceof Array) {
            const bodyNode = filter(this.props.children, (o) => {
                return o?.props?.key === 'modalBody';
            });
            if (!bodyNode.length) {
                return null;
            } else {
                return bodyNode;
            }
        } else {
            if (this.props.children.props.key === 'modalBody') {
                return this.props.children;
            } else {
                return null;
            }
        }
    }

    renderFooter = () => {
        if (this.props.children instanceof Array) {
            const footerNode = filter(this.props.children, (o) => {
                return o?.props?.key === 'modalFooter';
            });
            if (footerNode.length) {
                return footerNode;
            } else {
                return null;
            }
        } else {
            if (this.props.children.props.key === 'modalFooter') {
                return this.props.children;
            } else {
                return null;
            }
        }
    }

    render() {
        const { onClose, visible = true, tile, className, modalWrapperClassName, size, ...props } = this.props;
        return (
            <Modal
                {...props}
                width="auto"
                visible={visible}
                title={this.renderTitle()}
                footer={this.renderFooter()}
                onCancel={onClose}
                maskClosable={false}
                centered
                mask={!tile}
                className={classNames(styles.modal, `${this.renderTitle() ? className : `${className} no-header`}`)}
                wrapClassName={tile ? `${modalWrapperClassName} tile-modal` : modalWrapperClassName}
                maskStyle={{
                    background: '#2A2C2E30'
                }}
            >
                {this.renderBody()}
            </Modal>
        );
    }
}

ModalWrapper.Header = Title;
ModalWrapper.Body = Body;
ModalWrapper.Footer = Footer;
// ModalWrapper.Header = Header;
// console.log(ModalWrapper.Header);
// ModalWrapper.Overlay = Modal.Overlay;
// ModalWrapper.Content = Modal.Content;
// ModalWrapper.Header = Modal.Header;
// ModalWrapper.Title = Modal.Title;
// ModalWrapper.Body = Modal.Body;
// ModalWrapper.Footer = Modal.Footer;

export default ModalWrapper;
