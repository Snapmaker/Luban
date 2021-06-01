import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import styles from './index.styl';

const Header = ({ fixed, className, ...props }) => (
    <div
        {...props}
        className={classNames(
            className,
            styles['widget-header'],
            { [styles['widget-header-fixed']]: fixed }
        )}
    />
);

Header.propTypes = {
    className: PropTypes.string,
    fixed: PropTypes.bool
};
Header.defaultProps = {
    fixed: false
};

export default Header;
