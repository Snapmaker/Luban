import React from 'react';
import PropTypes from 'prop-types';
import Anchor from '../../../components/Anchor';
import settings from '../../../config/settings';
import i18n from '../../../lib/i18n';
import styles from './index.styl';

const AboutContainer = ({ version }) => {
    const wiki = 'http://snapmaker.com/support';

    return (
        <div className={styles.aboutContainer}>
            <img src="images/snap-logo-square-256x256.png" role="presentation" alt="presentation" className={styles.productLogo} />
            <div className={styles.productDetails}>
                <div className={styles.aboutProductName}>
                    {`${settings.name} ${version.current}`}
                </div>
                <div className={styles.aboutProductDescription}>
                    {i18n._('A web-based interface for Snapmaker based laser engraving & CNC carving.')}
                </div>
                <Anchor
                    className={styles.learnmore}
                    href={wiki}
                    target="_blank"
                >
                    {i18n._('Learn more')}
                    <i className="fa fa-arrow-circle-right" style={{ marginLeft: 5 }} />
                </Anchor>
            </div>
        </div>
    );
};

AboutContainer.propTypes = {
    version: PropTypes.object
};

export default AboutContainer;
