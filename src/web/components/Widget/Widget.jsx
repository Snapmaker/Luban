import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import styles from './index.styl';


/**
 * Widget Component
 */
class Widget extends PureComponent {
    static propTypes = {
        borderless: PropTypes.bool,
        fullscreen: PropTypes.bool
    };

    static defaultProps = {
        borderless: false,
        fullscreen: false
    };

    render() {
        const { borderless, fullscreen, ...rest } = this.props;

        return (
            <div
                {...rest}
                className={classNames(
                    styles.widget,
                    { [styles.widgetBorderless]: borderless },
                    { [styles.widgetFullscreen]: fullscreen }
                )}
            />
        );
    }
}

export default Widget;
