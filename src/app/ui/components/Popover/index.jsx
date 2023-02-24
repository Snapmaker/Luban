import React from 'react';
import PropTypes from 'prop-types';
import { Popover as AntdPopover } from 'antd';
import styles from './style.styl';

const Popover = React.memo((props) => {
    const { content, trigger = 'click', title = '', className, ...rest } = props;
    return (
        <AntdPopover
            content={content}
            trigger={trigger}
            title={title}
            overlayClassName={styles[className]}
            {...rest}
        >
            {props.children}
        </AntdPopover>
    );
});

Popover.propTypes = {
    trigger: PropTypes.string,
    content: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.string,
        PropTypes.node
    ]),
    title: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.node
    ]),
    children: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.node
    ]),
    className: PropTypes.string
};
export default Popover;
