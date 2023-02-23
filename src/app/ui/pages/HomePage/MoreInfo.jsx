import React from 'react';
import classNames from 'classnames';
import i18next from 'i18next';

import {
    FORUM_URL,
    MARKET_EN_URL,
    MARKET_ZH_URL,
    MYMINIFACTORY_URL,
    OFFICIAL_SITE_EN_URL,
    OFFICIAL_SITE_ZH_URL,
    SUPPORT_EN_URL,
    SUPPORT_ZH_URL,
    TUTORIAL_VIDEO_URL
} from '../../../constants';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';

const MoreInfo = () => {
    const lang = i18next.language;

    const supportURL = lang === 'zh-CN' ? SUPPORT_ZH_URL : SUPPORT_EN_URL;
    const websiteURL = lang === 'zh-CN' ? OFFICIAL_SITE_ZH_URL : OFFICIAL_SITE_EN_URL;
    const shopURL = lang === 'zh-CN' ? MARKET_ZH_URL : MARKET_EN_URL;

    return (
        <div className={styles['more-info']}>
            <div className={classNames('highlight-heading', 'margin-bottom-16')}>
                {i18n._('key-HomePage/Begin-Help')}
            </div>
            <div className={classNames(styles['resource-list'])}>
                <a href="https://support.snapmaker.com/hc/en-us/articles/4406229926935" target="_blank" rel="noopener noreferrer" className={classNames(styles.listItem)}>
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Software Manual')}
                    </span>
                </a>
                <a className={classNames(styles.listItem, styles['right-part'])} href={supportURL} target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Support')}
                    </span>
                </a>
                <a className={classNames(styles.listItem)} href={TUTORIAL_VIDEO_URL} target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Video Tutorial')}
                    </span>
                </a>
                <a className={classNames(styles.listItem, styles['right-part'])} href={FORUM_URL} target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Forum')}
                    </span>
                </a>
                <a className={classNames(styles.listItem)} href={websiteURL} target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Snapmaker.com')}
                    </span>
                </a>
                <a className={classNames(styles.listItem, styles['right-part'])} href={shopURL} target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Store')}
                    </span>
                </a>
                <a className={classNames(styles.listItem)} href={MYMINIFACTORY_URL} target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-MyMiniFactory')}
                    </span>
                </a>
            </div>
        </div>
    );
};

export default MoreInfo;
