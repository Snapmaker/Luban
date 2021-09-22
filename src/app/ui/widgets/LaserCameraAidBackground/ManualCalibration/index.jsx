import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../../lib/i18n';
import api from '../../../../api';
import CalibrationPreview from './ManualCalibration';
// import Anchor from '../../../components/Anchor';
import Modal from '../../../components/Modal';
import { Button } from '../../../components/Buttons';

import styles from '../styles.styl';
import { EXPERIMENTAL_LASER_CAMERA } from '../../../../constants';


class ManualCalibration extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        getPoints: PropTypes.array.isRequired,
        matrix: PropTypes.object.isRequired,
        backtoCalibrationModal: PropTypes.func.isRequired,
        displayExtractTrace: PropTypes.func.isRequired,
        calibrationOnOff: PropTypes.func.isRequired,
        updateStitchEach: PropTypes.func.isRequired,
        updateAffinePoints: PropTypes.func.isRequired
    };

    calibrationPreview = React.createRef();

    state = {
        isComfirmPoints: false,
        width: 1024,
        height: 1280
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
                    matrix.points[i].x = Math.floor(this.props.getPoints[i].x);
                    matrix.points[i].y = Math.floor(this.props.getPoints[i].y);
                }
                await api.setCameraCalibrationMatrix({ 'address': address, 'matrix': JSON.stringify(matrix) });
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
                        {i18n._('key_ui/widgets/LaserCameraAidBackground/ManualCalibration/index_Calibrate')}
                    </div>
                </Modal.Header>
                <Modal.Body>
                    <div className={styles['laser-set-background-modal-content']}>
                        <div className={styles['calibrate-background']}>
                            <div className={styles['calibrate-advise']}>
                                <p style={{ marginBottom: '1rem', textAlign: 'left', width: '522px' }}>
                                    {i18n._('key_ui/widgets/LaserCameraAidBackground/ManualCalibration/index_Align the four corners of the blue quadrilateral with the printed square.') }
                                </p>
                            </div>

                        </div>
                        <CalibrationPreview
                            ref={this.calibrationPreview}
                            getPoints={this.props.getPoints}
                            width={this.state.width}
                            height={this.state.height}
                            updateAffinePoints={this.props.updateAffinePoints}
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
                                onClick={this.actions.onClickToUpload}
                            >
                                {i18n._('key_ui/widgets/LaserCameraAidBackground/ManualCalibration/index_Reset')}
                            </Button>
                            <Button
                                width="160px"
                                priority="level-three"
                                type="default"
                                onClick={this.actions.onClickToConfirm}
                            >
                                {i18n._('key_ui/widgets/LaserCameraAidBackground/ManualCalibration/index_Confirm')}
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
                                {i18n._('key_ui/widgets/LaserCameraAidBackground/ManualCalibration/index_Back')}
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
                                {i18n._('key_ui/widgets/LaserCameraAidBackground/ManualCalibration/index_Apply')}
                            </Button>
                        )}
                    </div>
                </Modal.Footer>
            </Modal>
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
