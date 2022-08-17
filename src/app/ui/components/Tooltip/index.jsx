import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'antd';
import classNames from 'classnames';
import styles from './styles.styl';

const InsideTooltip = (props) => {
    const { placement = 'left', title = '', children, ...rest } = props;

    return (
        <Tooltip
            placement={placement}
            className={classNames(
                styles['tooltip-wrapper'],
            )}
            overlayClassName="tooltip-wrapper"
            zIndex={9999}
            title={title}
            {...rest}
        >
            {children}
        </Tooltip>
    );
};


InsideTooltip.propTypes = {
    placement: PropTypes.string,
    title: PropTypes.node,
    children: PropTypes.node,
};

export default InsideTooltip;
