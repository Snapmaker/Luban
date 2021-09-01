import React, { useEffect, useRef } from 'react';
// import Sortable from 'react-sortablejs';
import { throttle } from 'lodash';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import styles from './styles/workspace.styl';

function WorkspaceLayout({ renderLeftView, renderRightView, renderMainToolBar, children }) {
    const primaryContainer = useRef();
    const visualizerContainer = useRef();
    const secondaryContainer = useRef();

    const resizeWindow = () => {
        if (visualizerContainer.current) {
            visualizerContainer.current.style.width = `calc(100vw - ${primaryContainer.current.clientWidth < 360 ? 360 : primaryContainer.current.clientWidth}px - ${secondaryContainer.current.clientWidth < 360 ? 360 : secondaryContainer.current.clientWidth}px - 48px)`;
        }
    };
    useEffect(() => {
        pubsub.publish('resize'); // Also see "widgets/Visualizer"

        let onResizeThrottled = throttle(resizeWindow, 50);
        window.addEventListener('resize', onResizeThrottled);

        return () => {
            window.removeEventListener('resize', onResizeThrottled);
            onResizeThrottled = null;
        };
    }, []);

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
                    ref={primaryContainer}
                    className={classNames(
                        'overflow-x-hidden',
                        'border-radius-8',
                        'background-color-white',
                        'margin-8',
                        'box-shadow-module'
                        // 'sm-flex-auto'
                    )}
                >
                    {renderLeftView && (
                        renderLeftView()
                    )}
                </div>
                <div
                    ref={visualizerContainer}
                    className={classNames(
                        styles.visualizer,
                    )}
                >
                    {children}
                </div>

                <div
                    ref={secondaryContainer}
                    className={classNames(
                        'overflow-x-hidden',
                        'border-radius-8',
                        'background-color-white',
                        'margin-8',
                        'sm-flex-auto',
                        'box-shadow-module'
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
WorkspaceLayout.propTypes = {
    children: PropTypes.array,
    renderLeftView: PropTypes.func,
    renderRightView: PropTypes.func,
    renderMainToolBar: PropTypes.func
};

export default WorkspaceLayout;
