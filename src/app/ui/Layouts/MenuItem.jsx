import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import styles from './styles/maintoolbar.styl';
import SvgIcon from '../components/SvgIcon';

function MenuItem({ menuItem, actions }) {
    if (!menuItem) {
        return null;
    }
    const { type = 'button', name = 'Copy', title } = menuItem;
    switch (type) {
        case 'separator':
            return (
                <div className={styles.separator} />
            );
        case 'button':
            return (
                <SvgIcon
                    size={18}
                    name={name}
                    isHorizontal={false}
                    className={classNames(styles['bar-icon'])}
                    onClick={() => { actions.handleClick(menuItem.action); }}
                    spanText={i18n._(title)}
                    spanClassName={classNames(styles['action-title'])}
                />
            );
        default:
            return null;
    }
}
MenuItem.propTypes = {
    menuItem: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired
};

export default MenuItem;
