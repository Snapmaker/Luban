import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import styles from './index.styl';

const Toolbar = ({ className, ...props }) => (
    <div
        {...props}
        className={classNames(className, styles['widget-toolbar'])}
    />
);

Toolbar.propTypes = {
    className: PropTypes.string
};

export default Toolbar;
