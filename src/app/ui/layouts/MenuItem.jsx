import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'antd';
import { noop, includes } from 'lodash';
import i18n from '../../lib/i18n';
import styles from './styles/maintoolbar.styl';
import SvgIcon from '../components/SvgIcon';
import { longLangWithType } from '../../constants';
// import Anchor from '../components/Anchor';

function MenuItem({ menuItem, actions, lang, headType }) {
    const { type = 'button', name = 'Copy', iconClassName, title, inputInfo, disabled = false } = menuItem;
    const { customRender = noop } = menuItem;
    function handleClick(e) {
        actions.handleClick(menuItem.action, e);
    }

    const [itemType, setTtemType] = useState(type);
    useEffect(() => {
        setTtemType(type);
    }, [type]);

    switch (itemType) {
        case 'separator':
            return (
                <div className={styles.separator} />
            );
        case 'button':
            return (
                <Tooltip title={i18n._(title)}>
                    <SvgIcon
                        size={24}
                        name={name}
                        disabled={disabled}
                        isHorizontal={false}
                        className={classNames(styles['bar-icon'], iconClassName, includes(longLangWithType[lang], headType) && styles['bar-icon-for-long'])}
                        onClick={(e) => handleClick(e)}
                        spanText={i18n._(title)}
                        spanClassName={classNames(includes(longLangWithType[lang], headType) && styles['action-title-for-long'])}
                        inputInfo={inputInfo}
                        // type={['hoverNormal', 'pressNormal']}
                        type={['static']}
                    />
                </Tooltip>
            );
        case 'render':
            return customRender();
        default:
            return null;
    }
}
MenuItem.propTypes = {
    menuItem: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired,
    lang: PropTypes.string,
    headType: PropTypes.string
};

export default MenuItem;
