import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './index.styl';

const Controls = ({ className, ...props }) => (
    <div
        {...props}
        className={classNames(className, styles.widgetControls)}
    />
);

Controls.propTypes = {
    className: PropTypes.string
};

export default Controls;
