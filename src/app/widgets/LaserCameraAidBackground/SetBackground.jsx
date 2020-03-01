import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import styles from './styles.styl';
import api from '../../api';
import { CONNECTION_TYPE_WIFI, WORKFLOW_STATUS_IDLE } from '../../constants';
import i18n from '../../lib/i18n';
import WarningModal from '../../lib/modal-warning';
import Modal from '../../components/Modal';
import Space from '../../components/Space';

import { actions } from '../../flux/laser';
import ExtractSquareTrace from './ExtractSquareTrace';
// import ManualCalibration from './ManualCalibration';

const PANEL_EXTRACT_TRACE = 1;
const PANEL_NOT_CALIBRATION = 3;
const iconSrc = 'images/camera-aid/ic_warning-64x64.png';

class SetBackground extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool.isRequired,
        workflowStatus: PropTypes.string.isRequired,
        connectionType: PropTypes.string.isRequired,
        hasBackground: PropTypes.bool.isRequired,
        server: PropTypes.object.isRequired,

        // redux
        series: PropTypes.string.isRequired,
        laserSize: PropTypes.object,
        size: PropTypes.object.isRequired,
        setBackgroundImage: PropTypes.func.isRequired,
        removeBackgroundImage: PropTypes.func.isRequired
    };

    state = {
        showModal: false,
        canTakePhoto: true,
        xSize: [],
        ySize: [],
        lastFileNames: [],
        showCalibrationModal: true,
        panel: PANEL_EXTRACT_TRACE
    };

    actions = {
        showModal: async () => {
            const resPro = await api.getCameraCalibration({ 'address': this.props.server.address });
            if (!('res' in resPro.body) || !('points' in JSON.parse(resPro.body.res.text))) {
                this.setState({
                    showModal: true,
                    panel: PANEL_NOT_CALIBRATION
                });
            } else {
                this.setState({
                    showModal: true,
                    panel: PANEL_EXTRACT_TRACE
                });
            }
        },
        changeLastFileNames: (lastFileNames) => {
            this.setState({
                lastFileNames: lastFileNames
            });
        },
        updateEachPicSize: (size, value) => {
            this.setState({
                size: value
            });
        },
        changeCanTakePhoto: (bool) => {
            this.setState({
                canTakePhoto: bool
            });
        },
        updateAffinePoints: (manualPoints) => {
            this.setState({
                manualPoints
            });
        },
        insideHideModal: () => {
            this.setState({
                showModal: false
            });
        },
        hideModal: () => {
            if (!this.state.canTakePhoto && this.state.panel === PANEL_EXTRACT_TRACE) {
                WarningModal({
                    body: i18n._('This action cannot be undone. Are you sure you want to stop the job?'),
                    iconSrc,
                    bodyTitle: i18n._('Warning'),
                    insideHideModal: this.actions.insideHideModal
                });
            } else {
                this.actions.insideHideModal();
            }
        },
        setBackgroundImage: (filename) => {
            const { size } = this.props;
            this.props.setBackgroundImage(filename, size.x, size.y, 0, 0);

            this.actions.hideModal();
        },


        removeBackgroundImage: () => {
            this.props.removeBackgroundImage();
        }

    };

    componentDidMount() {
    }


    render() {
        const state = { ...this.state };
        const { connectionType, isConnected, hasBackground, laserSize, series, workflowStatus } = this.props;
        let fullWidth;
        if (series === 'A350') {
            fullWidth = laserSize ? (laserSize.x * 1.5 + 72 + 4) : 512;
        } else if (series === 'A250') {
            fullWidth = laserSize ? (laserSize.x * 2 + 72 + 4) : 512;
        } else {
            fullWidth = 512 + 72 + 4;
        }
        const canCameraCapture = workflowStatus === WORKFLOW_STATUS_IDLE;
        return (
            <React.Fragment>
                {state.showModal && (
                    <Modal style={{ width: fullWidth, paddingBottom: '10px' }} size="lg" onClose={this.actions.hideModal}>
                        <Modal.Body
                            style={{ margin: '0', padding: '72px 36px 36px 36px', height: '100%' }}
                            className={classNames(
                                styles['modal-body']
                            )}
                        >
                            <ExtractSquareTrace
                                canTakePhoto={this.state.canTakePhoto}
                                changeCanTakePhoto={this.actions.changeCanTakePhoto}
                                ySize={this.state.ySize}
                                xSize={this.state.xSize}
                                lastFileNames={this.state.lastFileNames}
                                updateEachPicSize={this.actions.updateEachPicSize}
                                changeLastFileNames={this.actions.changeLastFileNames}
                                setBackgroundImage={this.actions.setBackgroundImage}
                                updateAffinePoints={this.actions.updateAffinePoints}
                            />
                        </Modal.Body>
                        {state.panel === PANEL_NOT_CALIBRATION && (
                            <div>
                                <Modal.Header>
                                    <Modal.Title>
                                        {i18n._('Warning')}
                                    </Modal.Title>
                                </Modal.Header>
                                <Modal.Body style={{ margin: '0', paddingBottom: '15px', height: '100%' }}>
                                    <div>
                                        {i18n._('Information')}
                                        <br />
                                        <Space width={4} />
                                        {i18n._('The camera hasn\'t calibrated yet. Please go through the Camera Calibration procedures on touchscreen first.')}
                                    </div>
                                </Modal.Body>
                                <Modal.Footer>
                                    <div style={{ display: 'inline-block', marginRight: '8px' }}>
                                        <input
                                            type="checkbox"
                                            defaultChecked={false}
                                        />
                                        <span style={{ paddingLeft: '4px' }}>{i18n._('Don\'t show again in current session')}</span>
                                    </div>
                                </Modal.Footer>
                            </div>
                        )}
                    </Modal>
                )}
                <button
                    type="button"
                    className={classNames(
                        'sm-btn-large',
                        'sm-btn-default',
                        styles['btn-addbackground'],
                    )}
                    disabled={!canCameraCapture}
                    onClick={this.actions.showModal}
                    style={{ display: (connectionType !== CONNECTION_TYPE_WIFI || !isConnected || hasBackground) ? 'none' : 'block' }}
                >
                    {i18n._('Camera Capture')}
                </button>
                <button
                    type="button"
                    className={classNames(
                        'sm-btn-large',
                        styles['btn-removebackground'],
                    )}
                    style={{ display: hasBackground ? 'block' : 'none' }}
                    onClick={this.actions.removeBackgroundImage}
                >
                    {i18n._('Remove Background')}
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const laser = state.laser;
    return {
        isConnected: machine.isConnected,
        connectionType: machine.connectionType,
        server: machine.server,
        series: machine.series,
        hasBackground: laser.background.enabled,
        laserSize: machine.laserSize,
        size: machine.size,
        workflowStatus: machine.workflowStatus
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setBackgroundImage: (filename, width, height, dx, dy) => dispatch(actions.setBackgroundImage(filename, width, height, dx, dy)),
        removeBackgroundImage: () => dispatch(actions.removeBackgroundImage())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SetBackground);
