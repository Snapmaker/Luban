import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import styles from './index.styl';

const Title = ({ className, ...props }) => (
    <div
        {...props}
        className={classNames(className, styles.widgetTitle)}
    />
);

Title.propTypes = {
    className: PropTypes.string
};

export default Title;
