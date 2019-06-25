import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './index.styl';

const Panel = ({ className, ...props }) => (
    <div {...props} className={classNames(className, styles.panel, styles.panelDefault)} />
);

Panel.propTypes = {
    className: PropTypes.string
};

export default Panel;
