import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'antd';
import classNames from 'classnames';
import { isEqual, noop } from 'lodash';
import styles from './styles.styl';
import { EPSILON } from '../../../constants';
import 'intro.js/introjs.css';
import Steps from '../Steps';

const progressBarWidget = () => {
    return (
        <div />
    );
};

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


    componentDidUpdate() {

    }

    getSnapshotBeforeUpdate(prevProps) {
        if (!isEqual(prevProps.progress, this.props.progress) && this.props.progress !== 0) {
            this.setState({ display: 'block' });
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }
            if (this.props.progress > 100 - EPSILON) {
                this.timeout = setTimeout(() => this.setState({ display: 'none' }), 800);
            }
        }
        if (this.props.tips === 'Failed to load model.') {
            this.setState({ display: 'none' });
        }
        return prevProps;
    }


    render() {
        const { progress, tips, strokeColor = '#1890ff' } = this.props;
        const { display } = this.state;
        return (
            <div
                style={{ display }}
                className={classNames(styles.progressbar, 'module-default-shadow', 'progress-bar-wrapper')}
            >
                <div className="position-re height-16 margin-top-24 margin-bottom-16 align-c">
                    <span>{tips}</span>
                </div>
                <Progress
                    percent={progress}
                    strokeColor={strokeColor}
                    trailColor="#D5D6D9"
                />
                <Steps
                    enabled={display !== 'none'}
                    initialStep={0}
                    options={{
                        showBullets: false,
                        hidePrev: false,
                        exitOnEsc: false,
                        exitOnOverlayClick: false
                    }}
                    steps={[
                        {
                            intro: progressBarWidget(),
                            element: '.progress-bar-wrapper',
                            tooltipClass: 'progress-bar-intro',
                            highlightClass: 'progress-bar-highlight-part',
                            disableInteraction: true
                        }
                    ]}
                    onExit={noop}
                />
            </div>

        );
    }
}
// rgba(42, 44, 46, 0.19)

export default ProgressBar;
