import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import RepeatButton from '../../components/RepeatButton';
import i18n from '../../lib/i18n';
import styles from './secondary-toolbar.styl';

const SecondaryToolbar = (props) => {
    const { actions } = props;

    return (
        <div className="pull-right">
            <div className="btn-toolbar">
                <div className="btn-group btn-group-sm">
                    <RepeatButton
                        className={styles.btnIcon}
                        onClick={actions.camera.lookAtCenter}
                        title={i18n._('Reset Position')}
                    >
                        <i className={classNames(styles.icon, styles.iconFocusCenter)} />
                    </RepeatButton>
                    <RepeatButton
                        className={styles.btnIcon}
                        onClick={actions.camera.zoomIn}
                        title={i18n._('Zoom In')}
                    >
                        <i className={classNames(styles.icon, styles.iconZoomIn)} />
                    </RepeatButton>
                    <RepeatButton
                        className={styles.btnIcon}
                        onClick={actions.camera.zoomOut}
                        title={i18n._('Zoom Out')}
                    >
                        <i className={classNames(styles.icon, styles.iconZoomOut)} />
                    </RepeatButton>
                </div>
            </div>
        </div>
    );
};

SecondaryToolbar.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default SecondaryToolbar;
