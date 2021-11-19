import React from 'react';
import classNames from 'classnames';
import i18next from 'i18next';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';

const MoreInfo = () => {
    const lang = i18next.language;
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
                <a className={classNames(styles.listItem, styles['right-part'])} href={lang === 'en' ? 'https://support.snapmaker.com/hc/en-us' : 'https://support.snapmaker.com/hc/zh-cn'} target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Support')}
                    </span>
                </a>
                <a className={classNames(styles.listItem)} href="https://www.youtube.com/playlist?list=PLEn5aHQNSrHWvLWgQwrnLPY6VcaYnTvcQ" target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Video Tutorial')}
                    </span>
                </a>
                <a className={classNames(styles.listItem, styles['right-part'])} href="https://forum.snapmaker.com/" target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Forum')}
                    </span>
                </a>
                <a className={classNames(styles.listItem)} href={lang === 'en' ? 'https://snapmaker.com' : 'https://snapmaker.cn/'} target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Snapmaker.com')}
                    </span>
                </a>
                <a className={classNames(styles.listItem, styles['right-part'])} href={lang === 'en' ? 'https://shop.snapmaker.com/' : 'https://snapmaker.world.tmall.com/?spm=a1z10.3-b.w5001-21696184167.3.40be7f386PAuCQ&scene=taobao_shop'} target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-Store')}
                    </span>
                </a>
                <a className={classNames(styles.listItem)} href="https://www.myminifactory.com/" target="_blank" rel="noopener noreferrer">
                    <span className={classNames('heading-3-normal-with-hover')}>
                        {i18n._('key-HomePage/Begin-MyMiniFactory')}
                    </span>
                </a>
            </div>
        </div>
    );
};

export default MoreInfo;
