import React from 'react';
import PropTypes from 'prop-types';
import styles from './styles.styl';

class ProgressBar extends React.PureComponent {
    timeout = null;

    static propTypes = {
        progress: PropTypes.number,
        tips: PropTypes.string
    }

    constructor(props) {
        super(props);
        this.state = { display: 'block' };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.progress !== this.props.progress) {
            this.setState({ display: 'block' });
            this.timeout && clearTimeout(this.timeout);
            this.timeout = setInterval(() => this.setState({ display: 'none' }), 5000);
        }
    }

    render() {
        const { progress, tips } = this.props;
        const { display } = this.state;
        return (
            <div style={{ display }}>
                <div className={styles['visualizer-notice']}>
                    <p>{tips}</p>
                </div>
                <div className={styles.progressbar}>
                    <div
                        className={styles.progress}
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

        );
    }
}


export default ProgressBar;
