import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import styles from './styles/maintoolbar.styl';
import MenuItem from './MenuItem';

class MainToolBar extends PureComponent {
    static propTypes = {
        leftItems: PropTypes.array,
        centerItems: PropTypes.array,
        rightItems: PropTypes.array
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
        const { leftItems, centerItems, rightItems } = this.props;
        return (
            <div
                className={classNames(
                    styles['is-clearfix'],
                    styles['bar-wrapper']
                )}
            >
                <div
                    className={classNames(
                        styles.left,
                        styles['bar-item']
                    )}
                >
                    {leftItems && (leftItems.map((menuItem) => {
                        return <MenuItem key={menuItem.title} menuItem={menuItem} actions={actions} />;
                    }))}
                </div>
                <div className={styles['bar-item']}>
                    {centerItems && (centerItems.map((menuItem) => {
                        return <MenuItem key={menuItem.title} menuItem={menuItem} actions={actions} />;
                    }))}
                </div>
                <div
                    className={classNames(
                        styles.right,
                        styles['bar-item']
                    )}
                >
                    {rightItems && (rightItems.map((menuItem) => {
                        return <MenuItem key={menuItem.title} menuItem={menuItem} actions={actions} />;
                    }))}
                </div>
            </div>
        );
    }
}

export default MainToolBar;
