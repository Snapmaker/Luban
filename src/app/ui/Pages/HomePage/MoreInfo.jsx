import React from 'react';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';

const MoreInfo = () => {
    return (
        <div className={styles['more-info']}>
            <div className={styles['title-label']}>
                {i18n._('More Resource')}
            </div>
            <div className={styles['resource-list']}>
                <a href="javascript;">
                    {i18n._('Software Manual')}
                </a>
                <a href="https://support.snapmaker.com/hc/en-us" target="_blank" rel="noopener noreferrer">
                    {i18n._('Support Center')}
                </a>
                <a href="javascript;" target="_blank" rel="noopener noreferrer">
                    {i18n._('Video Tutorial')}
                </a>
                <a href="https://forum.snapmaker.com/c/snapmaker-luban" target="_blank" rel="noopener noreferrer">
                    {i18n._('Forum')}
                </a>
                <a href="https://store.snapmakce.com" target="_blank" rel="noopener noreferrer">
                    {i18n._('Store')}
                </a>
                <a href="https://www.myminifactory.com/" target="_blank" rel="noopener noreferrer">
                    {i18n._('Myminifactory')}
                </a>
            </div>
        </div>
    );
};

export default MoreInfo;
