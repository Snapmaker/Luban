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

        renderLeftView: PropTypes.func,
        renderRightView: PropTypes.func,

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
            visualizerContainer.style.width = `calc(100vw - ${primaryContainer.clientWidth < 360 ? 360 : primaryContainer.clientWidth}px - ${secondaryContainer.clientWidth < 360 ? 360 : secondaryContainer.clientWidth}px - 48px)`;
        }
    }


    addResizeEventListener() {
        this.onResizeThrottled = throttle(this.resizeWindow, 50);
        window.addEventListener('resize', this.onResizeThrottled);
    }

    removeResizeEventListener() {
        window.removeEventListener('resize', this.onResizeThrottled);
        this.onResizeThrottled = null;
    }

    render() {
        const { renderLeftView, renderRightView, renderMainToolBar
        } = this.props;
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
                            'overflow-x-hidden',
                            'border-radius-8',
                            'background-color-white',
                            'margin-8',
                            // 'sm-flex-auto'
                        )}
                    >
                        {renderLeftView && (
                            renderLeftView()
                        )}
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
                        className={classNames(
                            'overflow-x-hidden',
                            'border-radius-8',
                            'background-color-white',
                            'margin-8',
                            'sm-flex-auto'
                        )}
                    >
                        {renderRightView && (
                            renderRightView()
                        )}

                    </div>
                </div>
            </div>

        );
    }
}

export default WorkspaceLayout;
