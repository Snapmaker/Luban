import { Modal as AntdModal, ModalProps as AntdModalProps } from 'antd';
import classNames from 'classnames';
import { filter } from 'lodash';
// import PropTypes from 'prop-types';
import React, { useEffect } from 'react';

import './modal.styl';
import Body from './modalBody';
import Footer from './modalFooter';
import Title from './modalTitle';
import styles from './styles.styl';


let bodyElement: HTMLBodyElement | null = null;

const blockScrolling = () => {
    if (!bodyElement) {
        bodyElement = document.querySelector('body');
    }
    if (bodyElement) {
        bodyElement.style.overflowY = 'hidden';
    }
};

const unblockScrolling = () => {
    if (!bodyElement) {
        bodyElement = document.querySelector('body');
    }
    if (bodyElement) {
        bodyElement.style.overflowY = 'auto';
    }
};


declare type ModalProps = AntdModalProps & {
    tile?: boolean;

    size?: 'sm' | 'md';

    onClose?: (e: React.MouseEvent<HTMLElement>) => void;
};

type ModalType = React.FC<ModalProps> & {
    Header?: typeof Title;
    Body?: typeof Body;
    Footer?: typeof Footer;
};

const Modal: ModalType = React.memo((props) => {
    const {
        centered = true,
        wrapClassName = 'modal-wrapper',
        tile = false,
        open = true,
        onClose,
        className = '',
        children,
        size,
        width = 'auto',
        ...rest
    } = props;

    useEffect(() => {
        blockScrolling();
        return () => {
            unblockScrolling();
        };
    }, []);

    const renderSection = (type) => {
        if (children instanceof Array) {
            const titleNode = filter(children, (o) => {
                return o?.props?.key === type;
            });
            if (!titleNode.length) {
                return null;
            } else {
                return titleNode;
            }
        } else {
            if (children.props.key === type) {
                return children;
            } else {
                return null;
            }
        }
    };

    return (
        <AntdModal
            {...rest}
            width={width}
            open={open}
            title={renderSection('modalTitle')}
            footer={renderSection('modalFooter')}
            onCancel={onClose}
            maskClosable={false}
            centered={centered}
            mask={!tile}
            className={classNames(
                styles.modal,
                `${renderSection('modalTitle') ? className : `${className} no-header`}`,
                `model-${size}`
            )}
            wrapClassName={classNames(
                wrapClassName,
                {
                    'tile-modal': tile
                }
            )}
            maskStyle={{
                background: '#2A2C2E30'
            }}
        >
            {renderSection('modalBody')}
        </AntdModal>
    );
});

Modal.Header = Title;
Modal.Body = Body;
Modal.Footer = Footer;

export default Modal;
