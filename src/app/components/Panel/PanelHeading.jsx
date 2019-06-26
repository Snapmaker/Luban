import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './index.styl';

const PanelHeading = ({ className, ...props }) => (
    <div {...props} className={classNames(className, styles.panelHeading)} />
);

PanelHeading.propTypes = {
    className: PropTypes.string
};

export default PanelHeading;
