import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import styles from './styles.styl';
import api from '../../api';
import { CONNECTION_TYPE_WIFI } from '../../constants';
import i18n from '../../lib/i18n';
import warningModal from '../../lib/modal-warning';
import Modal from '../../components/Modal';
import Space from '../../components/Space';

import { actions } from '../../flux/laser';
import ExtractSquareTrace from './ExtractSquareTrace';
import ManualCalibration from './ManualCalibration';

const PANEL_EXTRACT_TRACE = 1;
const PANEL_MANUAL_CALIBRATION = 2;
const PANEL_NOT_CALIBRATION = 3;
const iconSrc = 'images/camera-aid/ic_warning-64x64.png';

class SetBackground extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        hasBackground: PropTypes.bool.isRequired,
        server: PropTypes.object.isRequired,

        // redux
        size: PropTypes.object.isRequired,
        setBackgroundImage: PropTypes.func.isRequired,
        removeBackgroundImage: PropTypes.func.isRequired
    };

    state = {
        showModal: false,
        canTakePhoto: true,
        showCalibrationModal: true,
        panel: PANEL_EXTRACT_TRACE,
        shouldCalibrate: false,
        matrix: '',
        getPoints: []
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
        backtoCalibrationModal: () => {
            this.setState({
                showModal: true,
                panel: PANEL_EXTRACT_TRACE
            });
        },
        changeCanTakePhoto: (bool) => {
            this.setState({
                canTakePhoto: bool
            });
        },
        insideHideModal: () => {
            this.setState({
                showModal: false
            });
        },
        hideModal: () => {
            if (!this.state.canTakePhoto && this.state.panel === PANEL_EXTRACT_TRACE) {
                warningModal({
                    body: i18n._('Failed to parse image file {{filename}}'),
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
        calibrationOnOff: (shouldCalibrate) => {
            this.setState({
                shouldCalibrate
            });
        },
        updateAffinePoints: (getPoints) => {
            this.setState({
                getPoints
            });
        },
        removeBackgroundImage: () => {
            this.props.removeBackgroundImage();
        },

        displayExtractTrace: () => {
            this.setState({ panel: PANEL_EXTRACT_TRACE });
        },
        displayManualCalibration: async () => {
            const resPro = await api.getCameraCalibration({ 'address': this.props.server.address });
            const res = JSON.parse(resPro.body.res.text);
            this.setState({
                getPoints: res.points,
                matrix: res,
                panel: PANEL_MANUAL_CALIBRATION
            });
        }


    };

    componentDidMount() {
    }


    render() {
        const state = { ...this.state };
        const { connectionType, isConnected, hasBackground } = this.props;
        return (
            <React.Fragment>
                {state.showModal && (
                    <Modal style={{ width: '760px', paddingBottom: '20px' }} size="lg" onClose={this.actions.hideModal}>
                        {state.panel === PANEL_EXTRACT_TRACE && (
                            <Modal.Body style={{ margin: '0', paddingBottom: '15px', height: '100%' }}>
                                <ExtractSquareTrace
                                    shouldCalibrate={this.state.shouldCalibrate}
                                    getPoints={this.state.getPoints}
                                    canTakePhoto={this.state.canTakePhoto}
                                    changeCanTakePhoto={this.actions.changeCanTakePhoto}
                                    setBackgroundImage={this.actions.setBackgroundImage}
                                    displayManualCalibration={this.actions.displayManualCalibration}
                                />
                            </Modal.Body>

                        )}
                        {state.panel === PANEL_MANUAL_CALIBRATION && (
                            <Modal.Body style={{ margin: '0', paddingBottom: '15px', height: '100%' }}>
                                <ManualCalibration
                                    backtoCalibrationModal={this.actions.backtoCalibrationModal}
                                    getPoints={this.state.getPoints}
                                    matrix={this.state.matrix}
                                    shouldCalibrate={this.state.shouldCalibrate}
                                    displayExtractTrace={this.actions.displayExtractTrace}
                                    calibrationOnOff={this.actions.calibrationOnOff}
                                    updateAffinePoints={this.actions.updateAffinePoints}
                                />
                            </Modal.Body>
                        )}
                        {state.panel === PANEL_NOT_CALIBRATION && (
                            <div>
                                <Modal.Header>
                                    <Modal.Title>
                                        {i18n._('Warning')}
                                    </Modal.Title>
                                </Modal.Header>
                                <Modal.Body style={{ margin: '0', paddingBottom: '15px', height: '100%' }}>
                                    <div>
                                        {i18n._('Imformation')}
                                        <br />
                                        <Space width={4} />
                                        {i18n._('The screen haven\'t  calibrated yet. Please go to the screen to execute camera calibration before any movement.')}
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
                    onClick={this.actions.showModal}
                    style={{ display: (connectionType !== CONNECTION_TYPE_WIFI || !isConnected || hasBackground) ? 'none' : 'block' }}
                >
                    {i18n._('Add Background')}
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
        hasBackground: laser.background.enabled,
        size: machine.size
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setBackgroundImage: (filename, width, height, dx, dy) => dispatch(actions.setBackgroundImage(filename, width, height, dx, dy)),
        removeBackgroundImage: () => dispatch(actions.removeBackgroundImage())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SetBackground);
