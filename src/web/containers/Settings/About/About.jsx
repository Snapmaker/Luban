import React from 'react';
import settings from '../../../config/settings';
import Anchor from '../../../components/Anchor';
import i18n from '../../../lib/i18n';
import styles from './index.styl';


const About = () => {
    const supportLink = 'https://snapmaker.com/support';

    return (
        <div>
            <div className={styles['about-container']}>
                <img
                    src="images/snap-logo-square-256x256.png"
                    role="presentation"
                    alt="presentation"
                    className={styles['product-logo']}
                />
                <div className={styles['product-details']}>
                    <div className={styles['about-product-name']}>
                        {`${settings.name} ${settings.version}`}
                    </div>
                    <div className={styles['about-product-description']}>
                        {i18n._('A web-based interface for Snapmaker which is able to do 3D Printing, laser engraving and CNC carving.')}
                    </div>
                    <Anchor
                        className={styles['learn-more']}
                        href={supportLink}
                        target="_blank"
                    >
                        {i18n._('Learn more')}
                        <i className="fa fa-arrow-circle-right" style={{ marginLeft: 5 }} />
                    </Anchor>
                </div>
            </div>
            <div className={styles.helpContainer}>
                <button
                    type="button"
                    className="btn btn-default"
                    onClick={() => {
                        const url = 'https://snapmaker.com/download';
                        window.open(url, '_blank');
                    }}
                >
                    {i18n._('Downloads')}
                </button>
                <button
                    style={{ marginLeft: '5px' }}
                    type="button"
                    className="btn btn-default"
                    onClick={() => {
                        const url = 'https://forum.snapmaker.com';
                        window.open(url, '_blank');
                    }}
                >
                    {i18n._('Report an issue')}
                </button>
            </div>
        </div>
    );
};

export default About;
