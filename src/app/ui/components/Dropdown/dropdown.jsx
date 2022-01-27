import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Dropdown as AntDropdown } from 'antd';
import '../../../styles/global.styl';

const Dropdown = React.memo((props) => {
    const { className, placement = 'bottomCenter', overlay = <div />, ...rest } = props;
    return (
        <div className={classNames(className)}>
            <AntDropdown
                overlayClassName={classNames('border-radius-8', 'border-default-black-5')}
                {...rest}
                overlay={overlay}
                placement={placement}
            >
                {props.children}
            </AntDropdown>
        </div>
    );
});

Dropdown.propTypes = {
    children: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.element,
        PropTypes.string
    ]),
    // PropTypes.string | PropTypes.number | PropTypes.element,
    className: PropTypes.string,
    placement: PropTypes.string,
    overlay: PropTypes.element
};

export default Dropdown;
