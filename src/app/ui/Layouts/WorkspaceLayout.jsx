import React, { PureComponent } from 'react';
// import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './styles/workspace.styl';


class WorkspaceLayout extends PureComponent {
    static propTypes = {
        renderLeftView: PropTypes.func,
        renderRightView: PropTypes.func,
        renderCenterView: PropTypes.func,
        renderModalView: PropTypes.func,
        renderMainToolBar: PropTypes.func,
        renderLeftTogglerView: PropTypes.func,
        renderRightTogglerView: PropTypes.func
    };

    state = {
    };

    actions = {
    };


    render() {
        const { renderLeftView, renderRightView, renderCenterView, renderMainToolBar, renderLeftTogglerView, renderRightTogglerView, renderModalView } = this.props;
        return (
            <div className={styles.workspace}>
                {renderModalView && (
                    renderModalView()
                )}
                <div
                    className={classNames(
                        styles['main-bar'],
                    )}
                >
                    {renderMainToolBar && (
                        renderMainToolBar()
                    )}
                </div>
                <div className={styles.workspaceTable}>
                    <div className={styles.workspaceTableRow}>
                        {renderLeftView && (
                            renderLeftView()
                        )}
                        {renderLeftTogglerView && (
                            renderLeftTogglerView()
                        )}
                        {renderCenterView && (
                            renderCenterView()
                        )}
                        {renderRightView && (
                            renderRightView()
                        )}
                        {renderRightTogglerView && (
                            renderRightTogglerView()
                        )}
                    </div>
                </div>
            </div>

        );
    }
}

export default WorkspaceLayout;
