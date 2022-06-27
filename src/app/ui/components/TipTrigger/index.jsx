import React from 'react';
import PropTypes from 'prop-types';
import { Popover } from 'antd';
import { isEqual } from 'lodash';
// import { Tooltip, Popover } from 'antd';
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
    const { placement = 'left', title = '', content, isIcon = false, children, ...rest } = props;
    let placementValue = 'left';
    if (isIcon) {
        placementValue = 'bottom';
    } else {
        placementValue = placement;
    }
    // function getPopupContainer(node) {
    //     console.log('node', node);
    //     return node.parentNode;
    // }

    return (
        <Popover
            placement={placementValue}
            autoAdjustOverflow={false}
            zIndex={9999}
            content={content}
            title={title}
            arrowPointAtCenter
        >
            <div {...rest}>
                {children}
            </div>
        </Popover>
    );
}, checkIsEqual);


TipTrigger.propTypes = {
    placement: PropTypes.string,
    title: PropTypes.string,
    children: PropTypes.node,
    content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    isIcon: PropTypes.bool
};

export default TipTrigger;
