import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'antd';
import styles from './styles.styl';
import { EPSILON } from '../../../constants';

class ProgressBar extends React.PureComponent {
    static propTypes = {
        progress: PropTypes.number,
        tips: PropTypes.string,
        strokeColor: PropTypes.string
    };

    timeout = null;

    constructor(props) {
        super(props);
        this.state = { display: 'none' };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.progress !== this.props.progress) {
            this.setState({ display: 'block' });
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }
            if (nextProps.progress > 100 - EPSILON) {
                this.timeout = setTimeout(() => this.setState({ display: 'none' }), 5000);
            }
        }
    }

    render() {
        const { progress, tips, strokeColor = '#1890ff' } = this.props;
        const { display } = this.state;
        return (
            <div
                style={{ display }}
                className={styles.progressbar}
            >
                <div className={styles['progress-notice']}>
                    <p>{tips}</p>
                </div>
                <Progress
                    percent={progress}
                    strokeColor={strokeColor}
                    trailColor="#D5D6D9"
                />
            </div>

        );
    }
}


export default ProgressBar;
