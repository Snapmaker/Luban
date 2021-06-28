import React, { PureComponent } from 'react';
// import Sortable from 'react-sortablejs';
import { throttle } from 'lodash';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
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

    primaryContainer = React.createRef();

    visualizerContainer = React.createRef();

    secondaryContainer = React.createRef();

    componentDidMount() {
        pubsub.publish('resize'); // Also see "widgets/Visualizer"
        this.addResizeEventListener();
    }

    componentWillUnmount() {
        this.removeResizeEventListener();
    }


    resizeWindow = () => {
        const primaryContainer = this.primaryContainer.current;
        const visualizerContainer = this.visualizerContainer.current;
        const secondaryContainer = this.secondaryContainer.current;
        if (visualizerContainer) {
            visualizerContainer.style.width = `calc(100vw - ${primaryContainer.clientWidth}px - ${secondaryContainer.clientWidth}px)`;
        }
    }

    togglePrimaryContainer = () => {
        const { showPrimaryContainer } = this.props;
        this.props.updateTabContainer('left', { show: !showPrimaryContainer });

        // Publish a 'resize' event
        pubsub.publish('resize'); // Also see "widgets/Visualizer"

        setTimeout(() => {
            this.resizeWindow();
        }, 100);
    };

    toggleSecondaryContainer = () => {
        const { showSecondaryContainer } = this.props;
        this.props.updateTabContainer('right', { show: !showSecondaryContainer });

        // Publish a 'resize' event
        pubsub.publish('resize'); // Also see "widgets/Visualizer"
        // TODO
        setTimeout(() => {
            this.resizeWindow();
        }, 100);
    };

    addResizeEventListener() {
        this.onResizeThrottled = throttle(this.resizeWindow, 50);
        window.addEventListener('resize', this.onResizeThrottled);
    }

    removeResizeEventListener() {
        window.removeEventListener('resize', this.onResizeThrottled);
        this.onResizeThrottled = null;
    }

    renderLeftTogglerView(showPrimaryContainer) {
        return (
            <div>
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={this.togglePrimaryContainer}
                >
                    {showPrimaryContainer && (
                        <i className="fa fa-chevron-left" style={{ verticalAlign: 'middle' }} />
                    )}
                    {!showPrimaryContainer && (
                        <i className="fa fa-chevron-right" style={{ verticalAlign: 'middle' }} />
                    )}
                </button>
            </div>
        );
    }

    renderRightTogglerView(showSecondaryContainer) {
        return (
            <div>
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={this.toggleSecondaryContainer}
                >
                    {showSecondaryContainer && (
                        <i className="fa fa-chevron-right" style={{ verticalAlign: 'middle' }} />
                    )}
                    {!showSecondaryContainer && (
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
                        'clearfix'
                    )}
                >
                    {renderMainToolBar && (
                        renderMainToolBar()
                    )}
                </div>
                <div className={styles.workspaceTable}>
                    <div
                        ref={this.primaryContainer}
                        className={classNames(
                            styles.primaryContainer,
                        )}
                    >
                        <div className={classNames(
                            styles.primaryWrapper
                        )}
                        >
                            {renderLeftView && showPrimaryContainer && (
                                renderLeftView()
                            )}
                            <div
                                className={classNames(styles.primaryToggler)}
                            >
                                {this.renderLeftTogglerView(showPrimaryContainer)}
                            </div>
                        </div>
                    </div>
                    <div
                        ref={this.visualizerContainer}
                        className={classNames(
                            styles.visualizer,
                        )}
                    >
                        {this.props.children}
                    </div>

                    <div
                        ref={this.secondaryContainer}
                        className={
                            classNames(
                                styles.secondaryContainer,
                            )}
                    >
                        <div className={classNames(
                            styles.secondaryWrapper
                        )}
                        >
                            {renderRightView && showSecondaryContainer && (
                                renderRightView()
                            )}
                            <div
                                className={classNames(styles.secondaryToggler)}
                            >
                                { this.renderRightTogglerView(showSecondaryContainer)}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        );
    }
}

export default WorkspaceLayout;
