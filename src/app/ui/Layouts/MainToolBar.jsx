import classNames from 'classnames';
// import { isUndefined } from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import styles from './styles/maintoolbar.styl';
import SvgIcon from '../../components/SvgIcon';
import { timestamp } from '../../../shared/lib/random-utils';

class MainToolBar extends PureComponent {
    static propTypes = {
        locationArray: PropTypes.array,
        projectArray: PropTypes.array,
        editorArray: PropTypes.array,
        othersArray: PropTypes.array
    };


    state = {
    };

    actions = {
        handleClick: (callback) => {
            try {
                callback && callback();
            } catch (e) {
                console.error(e);
            }
        }
    }


    render() {
        const actions = this.actions;
        const { locationArray, projectArray, editorArray, othersArray } = this.props;
        return (
            <div className={styles['bar-wrapper']}>
                <div className={styles['bar-item']}>
                    {locationArray && (locationArray.map((item) => {
                        const title = item.title;
                        return (
                            <SvgIcon
                                key={title + timestamp()}
                                name={title}
                                isHorizontal={false}
                                size={18}
                                className={classNames(styles['bar-icon'])}
                                onClick={() => { actions.handleClick(item.action); }}
                                spanText={i18n._(title)}
                                spanClassName={classNames(styles['action-title'])}
                            />
                        );
                    }))}
                </div>
                <div className={styles['bar-item']}>
                    {projectArray && (projectArray.map((item) => {
                        const title = item.title;
                        return (
                            <SvgIcon
                                key={title + timestamp()}
                                size={18}
                                name={title}
                                isHorizontal={false}
                                className={classNames(styles['bar-icon'])}
                                onClick={() => { actions.handleClick(item.action); }}
                                spanText={i18n._(title)}
                                spanClassName={classNames(styles['action-title'])}
                            />
                        );
                    }))}
                </div>
                <div className={styles['bar-item']}>
                    {editorArray && (editorArray.map((item) => {
                        const title = item.title;
                        return (
                            <SvgIcon
                                key={title + timestamp()}
                                size={18}
                                name={title}
                                isHorizontal={false}
                                className={classNames(styles['bar-icon'])}
                                onClick={() => { actions.handleClick(item.action); }}
                                spanText={i18n._(title)}
                                spanClassName={classNames(styles['action-title'])}
                            />
                        );
                    }))}
                </div>
                <div className={styles['bar-item']}>
                    {othersArray && (othersArray.map((item) => {
                        const title = item.title;
                        return (
                            <SvgIcon
                                key={title + timestamp()}
                                size={18}
                                name={title}
                                isHorizontal={false}
                                className={classNames(styles['bar-icon'])}
                                onClick={() => { actions.handleClick(item.action); }}
                                spanText={i18n._(title)}
                                spanClassName={classNames(styles['action-title'])}
                            />
                        );
                    }))}
                </div>
            </div>
        );
    }
}

export default MainToolBar;
