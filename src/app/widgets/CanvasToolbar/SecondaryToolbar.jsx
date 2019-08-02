import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { MenuItem } from 'react-bootstrap';
import RepeatButton from '../../components/RepeatButton';
import i18n from '../../lib/i18n';
import styles from './secondary-toolbar.styl';


class SecondaryToolbar extends Component {
    static propTypes = {
        consoleExpanded: PropTypes.bool,
        toggleConsole: PropTypes.func,
        actions: PropTypes.object.isRequired
    };

    render() {
        const { consoleExpanded, actions } = this.props;
        const { zoomIn, zoomOut, autoFocus } = actions;
        return (
            <div className="pull-right">
                <div className="btn-toolbar">
                    <div className="btn-group btn-group-sm">
                        <MenuItem
                            onSelect={this.props.toggleConsole}
                        >
                            {consoleExpanded
                                ? <i className="fa fa-toggle-on fa-fw" />
                                : <i className="fa fa-toggle-off fa-fw" />
                            }
                            <span className="space space-sm" />
                            {i18n._('Console')}
                        </MenuItem>
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
