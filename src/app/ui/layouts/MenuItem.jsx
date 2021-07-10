import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import styles from './styles/maintoolbar.styl';
import SvgIcon from '../components/SvgIcon';
// import Anchor from '../components/Anchor';

function MenuItem({ menuItem, actions }) {
    if (!menuItem) {
        return null;
    }
    const { type = 'button', name = 'Copy', iconClassName, title, inputInfo, disabled = false } = menuItem;
    const { customRender = () => {} } = menuItem;
    console.log('customRender', type, customRender);
    function handleClick() {
        actions.handleClick(menuItem.action);
    }
    switch (type) {
        case 'separator':
            return (
                <div className={styles.separator} />
            );
        case 'button':
            return (
                <SvgIcon
                    size={24}
                    name={name}
                    disabled={disabled}
                    isHorizontal={false}
                    className={classNames(styles['bar-icon'], iconClassName)}
                    onClick={handleClick}
                    spanText={i18n._(title)}
                    spanClassName={classNames(styles['action-title'])}
                    inputInfo={inputInfo}
                    type={['hoverNormal', 'pressNormal']}
                />
            );
        case 'render':
            return customRender();
        default:
            return null;
    }
}
MenuItem.propTypes = {
    menuItem: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired
};

export default MenuItem;
