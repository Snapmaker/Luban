import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { MenuItem } from 'react-bootstrap';
import RepeatButton from '../../components/RepeatButton';
import i18n from '../../lib/i18n';
import styles from './secondary-toolbar.styl';
import { actions } from '../../flux/workspace';


class SecondaryToolbar extends Component {
    static propTypes = {
        consoleExpanded: PropTypes.bool,
        toggleConsole: PropTypes.func,
        zoomIn: PropTypes.func,
        zoomOut: PropTypes.func,
        autoFocus: PropTypes.func
    };

    render() {
        const { consoleExpanded, toggleConsole, zoomIn, zoomOut, autoFocus } = this.props;
        return (
            <div className="pull-right">
                <div className="btn-toolbar">
                    <div
                        className="btn-group btn-group-sm"
                        style={{ margin: '6px 6px 0 0' }}
                    >
                        <MenuItem
                            onSelect={toggleConsole}
                        >
                            {consoleExpanded
                                ? <i className="fa fa-toggle-on fa-fw" />
                                : <i className="fa fa-toggle-off fa-fw" />
                            }
                            <span className="space space-sm" />
                            {i18n._('Console')}
                        </MenuItem>
                    </div>
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

// export default SecondaryToolbar;

const mapStateToProps = (state) => {
    const workspace = state.workspace;
    return {
        consoleExpanded: workspace.consoleExpanded
    };
};

const mapDispatchToProps = (dispatch) => ({
    toggleConsole: () => dispatch(actions.toggleConsole()),
    zoomIn: () => dispatch(actions.zoomIn()),
    zoomOut: () => dispatch(actions.zoomOut()),
    autoFocus: () => dispatch(actions.autoFocus())
});

export default connect(mapStateToProps, mapDispatchToProps)(SecondaryToolbar);
