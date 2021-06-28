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
                {/* <a href="javascript;">
                    {i18n._('Software Manual')}
                </a> */}
                <a href="https://support.snapmaker.com/hc/en-us" target="_blank" rel="noopener noreferrer">
                    <img src={require('./images/question.png')} alt="" />
                    <div>{i18n._('Support Center')}</div>
                </a>
                <a href="https://www.youtube.com/c/Snapmaker/playlists" target="_blank" rel="noopener noreferrer">
                    <img src={require('./images/question.png')} alt="" />
                    <div>{i18n._('Video Tutorial')}</div>
                </a>
                <a href="https://forum.snapmaker.com/c/snapmaker-luban" target="_blank" rel="noopener noreferrer">
                    <img src={require('./images/question.png')} alt="" />
                    <div>{i18n._('Forum')}</div>
                </a>
                <a href="https://store.snapmaker.com" target="_blank" rel="noopener noreferrer">
                    <img src={require('./images/question.png')} alt="" />
                    <div>{i18n._('Store')}</div>
                </a>
                <a href="https://www.myminifactory.com/" target="_blank" rel="noopener noreferrer">
                    <img src={require('./images/question.png')} alt="" />
                    <div>{i18n._('Myminifactory')}</div>
                </a>
                <a href="javascript;">
                    {/* {i18n._('Software Manual')} */}
                </a>
            </div>
        </div>
    );
};

export default MoreInfo;
