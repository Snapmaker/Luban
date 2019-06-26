import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './index.styl';

const PanelBody = ({ className, ...props }) => (
    <div {...props} className={classNames(className, styles.panelBody)} />
);

PanelBody.propTypes = {
    className: PropTypes.string
};

export default PanelBody;
