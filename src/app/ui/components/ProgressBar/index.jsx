import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'antd';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import styles from './styles.styl';
import Modal from '../Modal';
import { EPSILON } from '../../../constants';
import i18n from '../../../lib/i18n';

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
        if (this.props.tips.includes(i18n._('key-Progress/3DP-Failed to load model.'))) {
            this.setState({ display: 'none' });
        }
        return prevProps;
    }


    render() {
        const { progress, tips, strokeColor = '#1890ff' } = this.props;
        const { display } = this.state;
        return (
            <div>
                {display === 'block' && (
                    <Modal
                        size="lg"
                        closable={false}
                        centered={false}
                        zIndex={2000}
                        style={{ top: 'calc(100vh - 126px)', padding: '16px 0 0' }}
                    >
                        <Modal.Body style={{ marginBottom: '-24px', marginTop: '-40px' }}>
                            <div className="position-re height-16 margin-top-24 margin-bottom-16 align-c">
                                <span>{tips}</span>
                            </div>
                            <div className={classNames(styles.progressbar)}>

                                <Progress
                                    showInfo={false}
                                    percent={progress}
                                    strokeColor={strokeColor}
                                    trailColor="#D5D6D9"
                                />
                            </div>
                        </Modal.Body>
                    </Modal>
                )}
            </div>

        );
    }
}

// {
//     !touring && (
//         <Steps
//             id="progress"
//             enabled={display !== 'none'}
//             initialStep={0}
//             options={{
//                 showBullets: false,
//                 hidePrev: false,
//                 exitOnEsc: false,
//                 exitOnOverlayClick: false
//             }}
//             steps={[
//                 {
//                     intro: progressBarWidget(),
//                     element: '.progress-bar-wrapper',
//                     tooltipClass: 'progress-bar-intro',
//                     highlightClass: 'progress-bar-highlight-part',
//                     disableInteraction: true
//                 }
//             ]}
//             onExit={noop}
//         />
//     )
// }


export default ProgressBar;
