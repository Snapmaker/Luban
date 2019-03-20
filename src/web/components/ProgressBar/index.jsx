import React from 'react';
import PropTypes from 'prop-types';
import styles from '../../widgets/styles.styl';

const ProgressBar = ({ progress = 0 }) => (
    <div>
        <div className="progress">
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

ProgressBar.propTypes = {
    progress: PropTypes.number
};

export default ProgressBar;
