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
        hideSecondaryContainer: PropTypes.bool,
        hidePrimaryContainer: PropTypes.bool,
        renderMainToolBar: PropTypes.func,
        renderLeftTogglerView: PropTypes.func,
        renderRightTogglerView: PropTypes.func
    };

    state = {
    };

    actions = {
    };


    render() {
        const { renderLeftView, renderRightView, renderCenterView, renderMainToolBar,
            renderLeftTogglerView, hideSecondaryContainer,
            hidePrimaryContainer, renderRightTogglerView, renderModalView } = this.props;
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
                        <div

                            className={classNames(
                                styles.primaryContainer,
                                { [styles.hidden]: hidePrimaryContainer }
                            )}
                        >
                            {renderLeftView && (
                                renderLeftView()
                            )}
                        </div>
                        <div
                            className={classNames(styles.primaryToggler)}
                        >
                            {renderLeftTogglerView && (
                                renderLeftTogglerView()
                            )}
                        </div>
                        {renderCenterView && (
                            renderCenterView()
                        )}


                        <div
                            className={classNames(
                                styles.secondaryToggler
                            )}
                        >
                            {renderRightTogglerView && (
                                renderRightTogglerView()
                            )}
                        </div>
                        <div
                            className={
                                classNames(
                                    styles.secondaryContainer,
                                    { [styles.hidden]: hideSecondaryContainer }
                                )}
                        >
                            {renderRightView && (
                                renderRightView()
                            )}
                        </div>

                    </div>
                </div>
            </div>

        );
    }
}

export default WorkspaceLayout;
