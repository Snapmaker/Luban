import React from 'react';
import PropTypes from 'prop-types';
import styles from './styles.styl';


const VisualizerProgressBar = ({ progress = 0 }) => (
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
);
VisualizerProgressBar.propTypes = {
    progress: PropTypes.number
};

export default VisualizerProgressBar;
