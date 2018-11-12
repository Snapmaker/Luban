import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import RepeatButton from '../../components/RepeatButton';
import i18n from '../../lib/i18n';
import styles from './secondary-toolbar.styl';


class SecondaryToolbar extends Component {
    static propTypes = {
        actions: PropTypes.object.isRequired
    };

    render() {
        const { zoomIn, zoomOut, autoFocus } = this.props.actions;
        return (
            <div className="pull-right">
                <div className="btn-toolbar">
                    <div className="btn-group btn-group-sm">
                        <RepeatButton
                            className={styles.btnIcon}
                            onClick={autoFocus}
                            title={i18n._('Reset Position')}
                        >
                            <i className={classNames(styles.icon, styles.iconFocusCenter)} />
                        </RepeatButton>
                        <RepeatButton
                            className={styles.btnIcon}
                            onClick={zoomIn}
                            title={i18n._('Zoom In')}
                        >
                            <i className={classNames(styles.icon, styles.iconZoomIn)} />
                        </RepeatButton>
                        <RepeatButton
                            className={styles.btnIcon}
                            onClick={zoomOut}
                            title={i18n._('Zoom Out')}
                        >
                            <i className={classNames(styles.icon, styles.iconZoomOut)} />
                        </RepeatButton>
                    </div>
                </div>
            </div>
        );
    }
}

export default SecondaryToolbar;
