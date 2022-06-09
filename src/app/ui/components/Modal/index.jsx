import React, { useEffect } from 'react';
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


const bodyDom = document.querySelector('body');
function blockScrolling() {
    bodyDom.style.overflowY = 'hidden';
}

function unblockScrolling() {
    bodyDom.style.overflowY = 'auto';
}
const ModalWrapper = React.memo(({
    centered = true,
    modalWrapperClassName = 'modal-wrapper',
    tile = false,
    visible = true,
    onClose,
    className = '',
    children,
    ...rest
}) => {
    useEffect(() => {
        UniApi.Event.emit('appbar-menu:disable');
        blockScrolling();
        return () => {
            UniApi.Event.emit('appbar-menu:enable');
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
        <Modal
            width="auto"
            visible={visible}
            title={renderSection('modalTitle')}
            footer={renderSection('modalFooter')}
            onCancel={onClose}
            maskClosable={false}
            centered={centered}
            mask={!tile}
            className={classNames(styles.modal, `${renderSection('modalTitle') ? className : `${className} no-header`}`)}
            wrapClassName={tile ? `${modalWrapperClassName} tile-modal` : modalWrapperClassName}
            maskStyle={{
                background: '#2A2C2E30'
            }}
            {...rest}
        >
            {renderSection('modalBody')}
        </Modal>
    );
});
ModalWrapper.propTypes = {
    ...Modal.propTypes,
    modalWrapperClassName: PropTypes.string,
    centered: PropTypes.bool,
    tile: PropTypes.bool,
    visible: PropTypes.bool,
    onClose: PropTypes.func,
    className: PropTypes.string
};
ModalWrapper.Header = Title;
ModalWrapper.Body = Body;
ModalWrapper.Footer = Footer;

export default (ModalWrapper);
