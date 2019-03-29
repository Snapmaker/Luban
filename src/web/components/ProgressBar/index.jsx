import React from 'react';
import PropTypes from 'prop-types';
import styles from './styles.styl';

const ProgressBar = React.memo(({ progress = 0 }) => (
    <div className={styles.progressbar}>
        <div
            className={styles.progress}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ width: `${progress}%` }}
        />
    </div>
));

ProgressBar.propTypes = {
    progress: PropTypes.number
};

export default ProgressBar;
