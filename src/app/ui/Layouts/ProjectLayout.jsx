import React, { PureComponent } from 'react';
// import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './project.styl';


class ProjectLayout extends PureComponent {
    static propTypes = {
        rightView: PropTypes.func,
        centerView: PropTypes.func,
        modalView: PropTypes.func,
        mainToolBar: PropTypes.func,
        subToolBar: PropTypes.func
    };

    state = {
    };

    actions = {
    };


    render() {
        const { rightView, centerView, mainToolBar, subToolBar, modalView } = this.props;
        return (
            <div className={styles['content-flex']}>
                <div
                    className={classNames(
                        styles['main-bar'],
                    )}
                >
                    {mainToolBar && (

                        mainToolBar()
                    )}
                </div>
                <form
                    className={classNames(
                        styles.controls,
                        styles['controls-right'],
                    )}
                    noValidate
                >
                    {rightView && (
                        rightView()
                    )}
                </form>

                {centerView && (
                    <div
                        className={classNames(
                            styles.visualizer,
                        )}
                    >
                        {centerView()}
                    </div>
                )}

                <div
                    className={classNames(
                        styles['sub-bar'],
                    )}
                >
                    {subToolBar && (
                        subToolBar()
                    )}
                </div>

                {modalView && (
                    modalView()
                )}
            </div>
        );
    }
}

export default ProjectLayout;
