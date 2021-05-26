import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './styles/homepage.styl';


class ProjectLayout extends PureComponent {
    static propTypes = {
        renderTopView: PropTypes.func,
        renderMiddleView: PropTypes.func,
        renderModalView: PropTypes.func,
        renderBottomBar: PropTypes.func
    };

    state = {
    };

    actions = {
    };


    render() {
        const { renderTopView, renderMiddleView, renderBottomBar, renderModalView } = this.props;
        return (
            <div>
                <div className={styles['content-table']}>
                    <div className={styles['content-row']}>
                        <form
                            className={classNames(
                                styles.controls,
                                styles['controls-right'],
                            )}
                            noValidate
                        >
                            {renderTopView && (
                                renderTopView()
                            )}
                        </form>
                        <div
                            className={classNames(
                                styles.visualizer,
                            )}
                        >
                            {renderMiddleView && (
                                renderMiddleView()
                            )}
                        </div>
                        <div
                            className={classNames(
                                styles['sub-bar'],
                            )}
                        >
                            {renderBottomBar && (
                                renderBottomBar()
                            )}
                        </div>

                        {renderModalView && (
                            renderModalView()
                        )}
                    </div>
                </div>
            </div>

        );
    }
}

export default ProjectLayout;
