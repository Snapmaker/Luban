import React, { PureComponent } from 'react';
// import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './styles/workspace.styl';


class WorkspaceLayout extends PureComponent {
    static propTypes = {
        children: PropTypes.array,
        showSecondaryContainer: PropTypes.bool,
        showPrimaryContainer: PropTypes.bool,

        renderLeftView: PropTypes.func,
        renderRightView: PropTypes.func,

        updateTabContainer: PropTypes.func,
        renderMainToolBar: PropTypes.func

    };

    state = {
    };

    actions = {
    };

    togglePrimaryContainer = () => {
        const { showPrimaryContainer } = this.props;
        this.props.updateTabContainer('left', { show: !showPrimaryContainer });

        // Publish a 'resize' event
        // pubsub.publish('resize'); // Also see "widgets/Visualizer"
    };

    toggleSecondaryContainer = () => {
        const { showSecondaryContainer } = this.props;
        this.props.updateTabContainer('right', { show: !showSecondaryContainer });


        // Publish a 'resize' event
        // pubsub.publish('resize'); // Also see "widgets/Visualizer"
    };


    renderLeftTogglerView(showPrimaryContainer) {
        const hidePrimaryContainer = !showPrimaryContainer;
        return (
            <div
                ref={this.primaryToggler}
            >
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={this.togglePrimaryContainer}
                >
                    {!hidePrimaryContainer && (
                        <i className="fa fa-chevron-left" style={{ verticalAlign: 'middle' }} />
                    )}
                    {hidePrimaryContainer && (
                        <i className="fa fa-chevron-right" style={{ verticalAlign: 'middle' }} />
                    )}
                </button>
            </div>
        );
    }

    renderRightTogglerView(showSecondaryContainer) {
        const hideSecondaryContainer = !showSecondaryContainer;
        return (
            <div
                ref={this.secondaryToggler}
            >
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={this.toggleSecondaryContainer}
                >
                    {!hideSecondaryContainer && (
                        <i className="fa fa-chevron-right" style={{ verticalAlign: 'middle' }} />
                    )}
                    {hideSecondaryContainer && (
                        <i className="fa fa-chevron-left" style={{ verticalAlign: 'middle' }} />
                    )}
                </button>
            </div>
        );
    }

    render() {
        const { renderLeftView, renderRightView, renderMainToolBar,
            showSecondaryContainer, showPrimaryContainer } = this.props;
        return (
            <div className={styles.workspace}>
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
                                { [styles.hidden]: !showPrimaryContainer }
                            )}
                        >
                            {renderLeftView && showPrimaryContainer && (
                                renderLeftView()
                            )}
                            <div
                                className={classNames(styles.primaryToggler)}
                            >
                                {this.renderLeftTogglerView()}
                            </div>
                        </div>

                        {this.props.children}


                        <div
                            className={
                                classNames(
                                    styles.secondaryContainer,
                                    { [styles.hidden]: !showSecondaryContainer }
                                )}
                        >
                            {renderRightView && showSecondaryContainer && (
                                renderRightView()
                            )}
                            <div
                                className={classNames(
                                    styles.secondaryToggler
                                )}
                            >
                                { this.renderRightTogglerView()}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        );
    }
}

export default WorkspaceLayout;
