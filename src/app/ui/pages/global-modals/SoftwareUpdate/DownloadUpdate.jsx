import classNames from 'classnames';
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import i18n from '../../../../lib/i18n';
import styles from './styles.styl';

function DownloadUpdate({ releaseNotes, releaseChangeLog, prevVersion, version }) {
    const notesRef = useRef('');

    useEffect(() => {
        if (notesRef.current && releaseNotes) {
            notesRef.current.innerHTML = releaseNotes;
        }
    }, [releaseNotes]);

    return (
        <div className={styles['autoupdate-wrapper']}>
            <div>
                <div className={styles['lu-logo-container']}>
                    <i className={styles.logo} />
                </div>
                <div className={styles['lu-version']}>
                    <div className={styles['product-details']}>
                        <div className={classNames(styles['about-product-name'], 'heading - 3')}>
                            {`Snapmaker Luban ${version} ${i18n._('key-App/Update-Update')}. ${i18n._('key-App/Update-Current version')} : ${prevVersion}`}
                        </div>
                        <div
                            className={classNames(styles['about-product-description'], 'color-black-4')}
                            ref={notesRef}
                        >
                            {
                                releaseChangeLog && (
                                    <ReactMarkdown linkTarget="_blank">
                                        {releaseChangeLog}
                                    </ReactMarkdown>
                                )
                            }
                        </div>
                        <div className="color-black-3">
                            {i18n._('key-App/Learn more about release notes please checkout')}
                            <a
                                href="https://github.com/Snapmaker/Luban/releases"
                                target="_blank"
                                className="link-text margin-left-4"
                                rel="noreferrer"
                            >
                                https://github.com/Snapmaker/Luban/releases
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
DownloadUpdate.propTypes = {
    releaseNotes: PropTypes.string,
    releaseChangeLog: PropTypes.string,
    prevVersion: PropTypes.string,
    version: PropTypes.string,
};
export default DownloadUpdate;
