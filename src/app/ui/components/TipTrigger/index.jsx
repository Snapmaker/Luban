import React from 'react';
import PropTypes from 'prop-types';
import { Popover } from 'antd';
import { isEqual } from 'lodash';
import classNames from 'classnames';
import styles from './styles.styl';

function isValidElement(object) {
    return (
        typeof object === 'object'
      && object !== null
      && object.$$typeof === Symbol.for('react.element')
    );
}
function checkIsEqual(newObj, oldObj) {
    return Object.entries(newObj).every(([key, item]) => {
        if (Array.isArray(item) && isValidElement(item[0])) {
            return true;
        } else if (isValidElement(item)) {
            return true;
        } else {
            return isEqual(item, oldObj[key]);
        }
    });
}

const TipTrigger = React.memo((props) => {
    const { placement = 'left', style = {}, title = '', content, isIcon = false, children, ...rest } = props;
    let placementValue = 'left';
    if (isIcon) {
        placementValue = 'bottom';
    } else {
        placementValue = placement;
    }
    return (
        <Popover
            placement={placementValue}
            className={classNames(
                styles['popover-wrapper']
            )}
            style={style}
            autoAdjustOverflow={false}
            zIndex={9999}
            content={content}
            title={title}
            arrowPointAtCenter
            {...rest}
        >
            {children}
        </Popover>
    );
}, checkIsEqual);


TipTrigger.propTypes = {
    placement: PropTypes.string,
    title: PropTypes.string,
    children: PropTypes.node,
    style: PropTypes.object,
    content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    isIcon: PropTypes.bool
};

export default TipTrigger;
