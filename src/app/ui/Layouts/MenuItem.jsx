import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import styles from './styles/maintoolbar.styl';
import SvgIcon from '../components/SvgIcon';
import { timestamp } from '../../../shared/lib/random-utils';

function MenuItem({ menuItem, actions }) {
    if (!menuItem) {
        return null;
    }
    const { type = 'button', title } = menuItem;
    switch (type) {
        case 'separator':
            return (
                <div key={title + timestamp()} className={styles.separator} />
            );
        case 'button':
            return (
                <SvgIcon
                    key={title + timestamp()}
                    size={18}
                    name={title}
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
