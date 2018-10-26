import React, { Component } from 'react';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import PropTypes from 'prop-types';
import RepeatButton from '../../components/RepeatButton';
import i18n from '../../lib/i18n';
import { ACTION_CANVAS_OPERATION } from '../../constants';
import styles from './secondary-toolbar.styl';


class SecondaryToolbar extends Component {
    static propTypes = {
        mode: PropTypes.string.isRequired
    };
    actions = {
        resetPosition: () => {
            pubsub.publish(ACTION_CANVAS_OPERATION, { mode: this.props.mode, operation: 'reset' });
        },
        zoomIn: () => {
            pubsub.publish(ACTION_CANVAS_OPERATION, { mode: this.props.mode, operation: 'zoomIn' });
        },
        zoomOut: () => {
            pubsub.publish(ACTION_CANVAS_OPERATION, { mode: this.props.mode, operation: 'zoomOut' });
        }
    };

    render() {
        const actions = this.actions;
        return (
            <div className="pull-right">
                <div className="btn-toolbar">
                    <div className="btn-group btn-group-sm">
                        <RepeatButton
                            className={styles.btnIcon}
                            onClick={actions.resetPosition}
                            title={i18n._('Reset Position')}
                        >
                            <i className={classNames(styles.icon, styles.iconFocusCenter)} />
                        </RepeatButton>
                        <RepeatButton
                            className={styles.btnIcon}
                            onClick={actions.zoomIn}
                            title={i18n._('Zoom In')}
                        >
                            <i className={classNames(styles.icon, styles.iconZoomIn)} />
                        </RepeatButton>
                        <RepeatButton
                            className={styles.btnIcon}
                            onClick={actions.zoomOut}
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
