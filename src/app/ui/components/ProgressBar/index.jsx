import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'antd';
import classNames from 'classnames';
import { isEqual } from 'lodash';
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


    getSnapshotBeforeUpdate(prevProps) {
        if (!isEqual(prevProps.progress, this.props.progress) && this.props.progress !== 0) {
            this.setState({ display: 'block' });
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }
            if (this.props.progress > 100 - EPSILON) {
                this.timeout = setTimeout(() => this.setState({ display: 'none' }), 5000);
            }
        }
        return prevProps;
    }

    render() {
        const { progress, tips, strokeColor = '#1890ff' } = this.props;
        const { display } = this.state;
        return (
            <div
                style={{ display }}
                className={classNames(styles.progressbar, 'module-default-shadow')}
            >
                <div className="position-re height-16 margin-top-16 margin-bottom-8 align-c">
                    <span>{tips}</span>
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
