import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import styles from './styles/maintoolbar.styl';
import MenuItem from './MenuItem';
// import { timestamp } from '../../../shared/lib/random-utils';

class MainToolBar extends PureComponent {
    static propTypes = {
        leftItems: PropTypes.array,
        centerItems: PropTypes.array,
        rightItems: PropTypes.array,
        mainBarClassName: PropTypes.string,
        lang: PropTypes.string
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
        const { leftItems, centerItems, rightItems, mainBarClassName, lang } = this.props;
        let key = 0;
        return (
            <div
                className={classNames(
                    'clearfix',
                    styles['bar-wrapper'],
                    mainBarClassName || ''
                )}
            >
                <div
                    className={classNames(
                        styles.left,
                        styles['bar-item']
                    )}
                >
                    {leftItems && (leftItems.map((menuItem) => {
                        return <MenuItem key={key++} menuItem={menuItem} actions={actions} lang={lang} />;
                    }))}
                </div>
                <div className={styles['bar-item']}>
                    {centerItems && (centerItems.map((menuItem) => {
                        return <MenuItem key={key++} menuItem={menuItem} actions={actions} lang={lang} />;
                    }))}
                </div>
                <div
                    className={classNames(
                        styles.right,
                        styles['bar-item']
                    )}
                >
                    {rightItems && (rightItems.map((menuItem) => {
                        return <MenuItem key={key++} menuItem={menuItem} actions={actions} lang={lang} />;
                    }))}
                </div>
            </div>
        );
    }
}

export default MainToolBar;
