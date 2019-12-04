import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import api from '../../../api';
import CalibrationPreview from './ManualCalibration';
import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { EXPERIMENTAL_LASER_CAMERA } from '../../../constants';


class ManualCalibration extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        getPoints: PropTypes.array.isRequired,
        shouldCalibrate: PropTypes.bool.isRequired,
        displayExtractTrace: PropTypes.func.isRequired,
        // setBackgroundImage: PropTypes.func.isRequired,
        calibrationOnOff: PropTypes.func.isRequired,
        updateAffinePoints: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    calibrationPreview = React.createRef();

    state = {
        filename: '',
        width: 1280,
        height: 1024
        // getPoints: []
    };

    actions = {
        onClickToUpload: () => {
            api.cameraCalibrationPhoto({ 'address': this.props.server.address }).then((res) => {
                const { fileName, width, height } = JSON.parse(res.text);
                this.setState({
                    width,
                    height
                });
                this.calibrationPreview.current.onChangeImage(fileName, width, height);
            });
        },
        reset: () => {
            this.props.calibrationOnOff(false);
            this.calibrationPreview.current.reset();
            console.log('filename', this.state.filename);
        },
        calibrate: () => {
            const { size } = this.props;
            this.calibrationPreview.current.extract(
                size.x,
                size.y,
            );
            this.props.calibrationOnOff(true);
        },
        previousPanel: () => {
            this.props.displayExtractTrace();
        }
    };

    render() {
        const calibrationState = this.props.shouldCalibrate ? i18n._('Calibration Enabled') : i18n._('Calibration Disabled');
        console.log(calibrationState);
        return (
            <div>
                <div className="clearfix" />
                <div className={styles['laser-set-background-modal-title']}>
                    {i18n._('Calibration')}
                </div>
                <div style={{ textAlign: 'center' }}>
                    <CalibrationPreview
                        ref={this.calibrationPreview}
                        getPoints={this.props.getPoints}
                        size={this.props.size}
                        width={this.state.width}
                        height={this.state.height}
                        updateAffinePoints={this.props.updateAffinePoints}
                    />
                </div>
                <div className={styles['calibrate-background']}>
                    <div className={classNames(styles['extract-actions'])}>
                        <Anchor
                            className={styles['extract-actions__btn']}
                            onClick={this.actions.onClickToUpload}
                        >
                            <i className={styles['extract-actions__icon-upload']} />
                        </Anchor>
                        <span className={styles['extract-actions__text']}>{i18n._('Upload')}</span>
                    </div>
                    <div className={classNames(styles['extract-actions'])}>
                        <Anchor
                            className={styles['extract-actions__btn']}
                            onClick={this.actions.reset}
                        >
                            <i className={styles['extract-actions__icon-reset']} />
                        </Anchor>
                        <span className={styles['extract-actions__text']}>{i18n._('Reset')}</span>
                    </div>
                    <div className={classNames(styles['extract-actions'])}>
                        <Anchor
                            className={styles['extract-actions__btn']}
                            onClick={this.actions.calibrate}
                        >
                            <i className={styles['extract-actions__icon-conform']} />
                        </Anchor>
                        <span className={styles['extract-actions__text']}>{i18n._('Calibrate')}</span>
                    </div>
                </div>
                <div style={{ margin: '20px 60px' }}>
                    {!EXPERIMENTAL_LASER_CAMERA && (
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-primary"
                            onClick={this.actions.previousPanel}
                            style={{ width: '40%', float: 'left', margin: '10px 0 0 0' }}
                        >
                            {i18n._('Previous')}
                        </button>
                    )}
                    {!EXPERIMENTAL_LASER_CAMERA && (
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-primary"
                            onClick={this.actions.previousPanel}
                            style={{ width: '40%', float: 'right', margin: '10px 0 0 0' }}
                        >
                            {i18n._('Complete')}
                        </button>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        server: machine.server,
        size: machine.size
    };
};

export default connect(mapStateToProps)(ManualCalibration);
