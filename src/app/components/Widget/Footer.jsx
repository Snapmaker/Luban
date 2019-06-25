import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './index.styl';

const Footer = ({ className, ...props }) => (
    <div
        {...props}
        className={classNames(className, styles.widgetFooter)}
    />
);

Footer.propTypes = {
    className: PropTypes.string
};

export default Footer;
