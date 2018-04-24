import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import styles from './index.styl';

/**
 * Widget Component
 */
const Widget = (props) => {
    const { borderless, fullscreen, className, ...rest } = props;

    return (
        <div
            {...rest}
            className={classNames(
                className,
                styles.widget,
                { [styles.widgetBorderless]: borderless },
                { [styles.widgetFullscreen]: fullscreen }
            )}
        />
    );
};

Widget.propTypes = {
    borderless: PropTypes.bool,
    fullscreen: PropTypes.bool
};

Widget.defaultProps = {
    borderless: false,
    fullscreen: false
};

export default Widget;
