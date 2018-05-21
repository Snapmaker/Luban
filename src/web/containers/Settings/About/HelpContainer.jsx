import React from 'react';
import i18n from '../../../lib/i18n';
import styles from './index.styl';

const HelpContainer = () => {
    return (
        <div className={styles.helpContainer}>
            <button
                type="button"
                className="btn btn-default"
                onClick={() => {
                    const url = 'http://snapmaker.com/download';
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
                    const url = 'http://forum.snapmaker.com';
                    window.open(url, '_blank');
                }}
            >
                {i18n._('Report an issue')}
            </button>
        </div>
    );
};

export default HelpContainer;
