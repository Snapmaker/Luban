import React, { PureComponent } from 'react';
// import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import classNames from 'classnames';
// import i18next from 'i18next';
// import { includes } from 'lodash';
// import { longLang } from '../../constants';
import { Spin } from 'antd';
import styles from './styles/project.styl';

class ProjectLayout extends PureComponent {
    static propTypes = {
        renderRightView: PropTypes.func,
        children: PropTypes.array,
        renderModalView: PropTypes.func,
        renderMainToolBar: PropTypes.func,
        isContentLoading: PropTypes.bool
    };

    state = {};

    centerView = React.createRef();

    rightView = React.createRef();

    componentDidMount() {
        window.addEventListener('resize', this.resizeWindow, false);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeWindow, false);
    }

    resizeWindow = () => {
        const rightView = this.rightView.current;
        const centerView = this.centerView.current;
        if (centerView) {
            centerView.style.width = `calc(100vw - ${rightView.clientWidth}px)`;
        }
    };

    render() {
        const { renderRightView, children, renderMainToolBar, renderModalView } = this.props;
        return (
            <div className={styles['project-layout']}>
                <div className={classNames(styles['main-toolbar'], 'clearfix')}>
                    {
                        renderMainToolBar && (
                            renderMainToolBar()
                        )
                    }
                </div>
                <Spin spinning={this.props.isContentLoading || false}>
                    <div
                        className={classNames(
                            styles['content-flex'],
                            // {
                            //     [styles['long-lang-content-height']]: includes(longLang, i18next.language),
                            // }
                        )}
                    >
                        <div
                            ref={this.rightView}
                            className={classNames(styles['configuration-panel'])}
                        >
                            {
                                renderRightView && (
                                    renderRightView()
                                )
                            }
                        </div>

                        <div
                            ref={this.centerView}
                            className={classNames(styles.visualizer)}
                        >
                            {children}
                        </div>

                        {
                            renderModalView && (
                                renderModalView()
                            )
                        }
                    </div>
                </Spin>
            </div>
        );
    }
}

export default ProjectLayout;
