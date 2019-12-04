import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import api from '../../api';
import { CONNECTION_TYPE_WIFI } from '../../constants';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Modal from '../../components/Modal';

import { actions } from '../../flux/laser';
import ExtractSquareTrace from './ExtractSquareTrace';
import ManualCalibration from './ManualCalibration';
import Instructions from './Instructions';

const PANEL_EXTRACT_TRACE = 1;
const PANEL_MANUAL_CALIBRATION = 2;
const PANEL_NOT_CALIBRATION = 3;

class SetBackground extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        isLaser: PropTypes.bool.isRequired,
        server: PropTypes.object.isRequired,
        showInstructions: PropTypes.bool.isRequired,
        actions: PropTypes.object.isRequired,

        // redux
        size: PropTypes.object.isRequired,
        setBackgroundImage: PropTypes.func.isRequired,
        removeBackgroundImage: PropTypes.func.isRequired
    };

    state = {
        showModal: false,
        showCalibrationModal: true,
        panel: PANEL_EXTRACT_TRACE,
        shouldCalibrate: false,
        getPoints: []
    };

    actions = {
        showModal: async () => {
            const resPro = await api.getCameraCalibration({ 'address': this.props.server.address });
            console.log('inside checkCalibration', (resPro.body));
            if (!('res' in resPro.body)) {
                this.setState({
                    showModal: true,
                    panel: PANEL_NOT_CALIBRATION
                });
            } else if (!('points' in JSON.parse(resPro.body.res.text))) {
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
        hideModal: () => {
            this.setState({
                showModal: false
            });
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
        checkConnectionStatus: () => {
            const { isConnected, isLaser } = this.props;

            if (isConnected && isLaser) {
                return true;
            }

            modal({
                title: i18n._('Information'),
                body: i18n._('Laser tool head is not connected. Please make sure the laser tool head is installed properly, and then connect to your Snapmaker via Connection widget.')
            });
            return false;
        },

        displayExtractTrace: () => {
            this.setState({ panel: PANEL_EXTRACT_TRACE });
        },
        displayManualCalibration: async () => {
            const resPro = await api.getCameraCalibration({ 'address': this.props.server.address });
            const res = JSON.parse(resPro.body.res.text);
            this.setState({
                getPoints: res.points,
                panel: PANEL_MANUAL_CALIBRATION
            });
        }


    };

    componentDidMount() {
    }


    render() {
        const state = { ...this.state };
        const { showInstructions, connectionType, isConnected } = this.props;
        return (
            <React.Fragment>
                {showInstructions && <Instructions onClose={this.props.actions.hideInstructions} />}
                {state.showModal && (
                    <Modal style={{ width: '800px', paddingBottom: '20px' }} size="lg" onClose={this.actions.hideModal}>
                        <Modal.Body style={{ margin: '0', paddingBottom: '15px', height: '100%' }}>
                            {state.panel === PANEL_EXTRACT_TRACE && (
                                <ExtractSquareTrace
                                    shouldCalibrate={this.state.shouldCalibrate}
                                    getPoints={this.state.getPoints}
                                    setBackgroundImage={this.actions.setBackgroundImage}
                                    displayManualCalibration={this.actions.displayManualCalibration}
                                />
                            )}
                            {state.panel === PANEL_MANUAL_CALIBRATION && (
                                <ManualCalibration
                                    getPoints={this.state.getPoints}
                                    shouldCalibrate={this.state.shouldCalibrate}
                                    displayExtractTrace={this.actions.displayExtractTrace}
                                    calibrationOnOff={this.actions.calibrationOnOff}
                                    updateAffinePoints={this.actions.updateAffinePoints}
                                />
                            )}
                            {state.panel === PANEL_NOT_CALIBRATION && (
                                <div>
                                    {i18n._('imformation')}
                                    <br />
                                    {i18n._('The screen haven\'t  calibrated yet. Please go to the screen to execute camera calibration before any movement.')}
                                </div>
                            )}

                        </Modal.Body>
                    </Modal>
                )}
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={this.actions.showModal}
                    disabled={connectionType !== CONNECTION_TYPE_WIFI || !isConnected}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Add Background')}
                </button>
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={this.actions.removeBackgroundImage}
                    disabled={!isConnected}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Remove Background')}
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        isConnected: machine.isConnected,
        connectionType: machine.connectionType,
        server: machine.server,
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
