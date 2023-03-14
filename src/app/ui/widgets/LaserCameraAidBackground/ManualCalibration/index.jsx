import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../../lib/i18n';
import api from '../../../../api';
import CalibrationPreview, { CALIBRATION_MODE } from './ManualCalibration';
// import Anchor from '../../../components/Anchor';
import Modal from '../../../components/Modal';
import { Button } from '../../../components/Buttons';

import styles from '../styles.styl';
import { EXPERIMENTAL_LASER_CAMERA } from '../../../../constants';

class ManualCalibration extends PureComponent {
    static propTypes = {
        toolHead: PropTypes.object.isRequired,
        size: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        getPoints: PropTypes.array.isRequired,
        matrix: PropTypes.object.isRequired,
        backtoCalibrationModal: PropTypes.func.isRequired,
        displayExtractTrace: PropTypes.func.isRequired,
        calibrationOnOff: PropTypes.func.isRequired,
        updateStitchEach: PropTypes.func.isRequired,
        updateAffinePoints: PropTypes.func.isRequired,
        series: PropTypes.string.isRequired
    };

    calibrationPreview = React.createRef();

    state = {
        isComfirmPoints: false,
        width: 1024,
        height: 1280
    };

    actions = {
        onClickToUpload: (initialized = false) => {
            api.cameraCalibrationPhoto({ 'address': this.props.server.address, 'toolHead': this.props.toolHead.laserToolhead }).then((res) => {
                // const { fileName } = JSON.parse(res.text);
                const { fileName, width, height } = JSON.parse(res.text);
                this.setState({
                    width,
                    height
                });
                this.calibrationPreview.current.onChangeImage(fileName, width, height, initialized);
            });
            this.setState({
                isComfirmPoints: false
            });
        },
        onClickToConfirm: () => {
            const { size } = this.props;
            this.setState({
                isComfirmPoints: true
            });
            this.calibrationPreview.current.updateMatrix(
                size.x,
                size.y,
            );
        },
        previousPanel: () => {
            this.props.displayExtractTrace();
        },
        setCameraCalibrationMatrix: async () => {
            this.props.calibrationOnOff(true);
            const matrix = this.props.matrix;
            const { address } = this.props.server;
            if (matrix.points !== this.props.getPoints) {
                for (let i = 0; i < matrix.points.length; i++) {
                    matrix.points[i].x = this.props.getPoints[i].x;
                    matrix.points[i].y = this.props.getPoints[i].y;
                }
                await api.setCameraCalibrationMatrix({ 'address': address, 'toolHead': this.props.toolHead.laserToolhead, 'matrix': JSON.stringify(matrix) });
            }
            this.props.backtoCalibrationModal();
            this.props.updateStitchEach();
        }
    };

    componentDidMount() {
        this.actions.onClickToUpload();
    }

    render() {
        return (
            <Modal onClose={this.actions.previousPanel}>
                <div className="clearfix" />
                <Modal.Header>
                    <div className={styles['laser-set-background-calibration-title']}>
                        {i18n._('key-Laser/CameraCapture-Calibrate')}
                    </div>
                </Modal.Header>
                <Modal.Body>
                    <div className={styles['laser-set-background-modal-content']}>
                        <div className={styles['calibrate-background']}>
                            <div className={styles['calibrate-advise']}>
                                <p style={{ marginBottom: '1rem', textAlign: 'left' }}>
                                    1. {i18n._('key-Laser/CamaeraCapture-Align the four corners of the blue quadrilateral with the engraved square.')}
                                </p>
                                <p style={{ marginBottom: '1rem', textAlign: 'left' }}>
                                    2. {i18n._('key-Laser/CamaeraCapture-Fine-tune the position of the four corners')}
                                </p>
                            </div>

                        </div>
                        <CalibrationPreview
                            ref={this.calibrationPreview}
                            getPoints={this.props.getPoints}
                            width={this.state.width}
                            height={this.state.height}
                            updateAffinePoints={this.props.updateAffinePoints}
                            mode={CALIBRATION_MODE}
                            series={this.props.series}
                            size={this.props.size}
                            toolHead={this.props.toolHead}
                        />

                        <div className={classNames(
                            'sm-flex',
                            'justify-space-between',
                            'margin-vertical-16',
                        )}
                        >
                            <Button
                                width="160px"
                                priority="level-three"
                                type="default"
                                onClick={() => this.actions.onClickToUpload(true)}
                            >
                                {i18n._('key-Laser/CameraCapture-Reset')}
                            </Button>
                            <Button
                                width="160px"
                                priority="level-three"
                                type="default"
                                onClick={this.actions.onClickToConfirm}
                            >
                                {i18n._('key-Laser/CameraCapture-Confirm')}
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <div style={{ minHeight: 30 }}>
                        {!EXPERIMENTAL_LASER_CAMERA && (
                            <Button
                                width="96px"
                                priority="level-two"
                                type="default"
                                className={classNames(
                                    styles['btn-camera'],
                                    'float-l'
                                )}
                                onClick={this.actions.previousPanel}
                            >
                                {i18n._('key-Laser/CameraCapture-Back')}
                            </Button>
                        )}
                        {!EXPERIMENTAL_LASER_CAMERA && (
                            <Button
                                priority="level-two"
                                width="96px"
                                className={classNames(
                                    styles[this.state.isComfirmPoints ? 'btn-right-camera' : 'btn-right-camera-disabled border-radius-8'],
                                )}
                                disabled={!this.state.isComfirmPoints}
                                onClick={this.actions.setCameraCalibrationMatrix}
                            >
                                {i18n._('key-Laser/CameraCapture-Apply')}
                            </Button>
                        )}
                    </div>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => {
    const { series, size } = state.machine;
    const { server } = state.workspace;
    return {
        // machine
        series,
        size,

        // connected machine
        server,
    };
};

export default connect(mapStateToProps)(ManualCalibration);
