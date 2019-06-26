import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './index.styl';

const Content = ({ className, ...props }) => (
    <div
        {...props}
        className={classNames(className, styles.widgetContent)}
    />
);

Content.propTypes = {
    className: PropTypes.string
};

export default Content;
