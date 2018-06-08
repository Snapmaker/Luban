import React from 'react';
import PropTypes from 'prop-types';
import styles from './styles.styl';

const VisualizerProgressBar = ({ title = '', progress = 0 }) => (
    <div>
        <p className={styles['progress-title']}>{title}</p>
        <div className={styles['progress-bar']}>
            <div
                className={styles.progress}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ width: `${progress}%` }}
            />
        </div>
    </div>
);
VisualizerProgressBar.propTypes = {
    title: PropTypes.string,
    progress: PropTypes.number
};

export default VisualizerProgressBar;
