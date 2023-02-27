import isEqual from 'lodash/isEqual';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Trans } from 'react-i18next';

import { EXPERIMENTAL_LASER_CAMERA } from '../../../constants';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
// import Modal from '../../components/Modal';

import { actions } from '../../../flux/laser';
import PrintTrace from './PrintSquareTrace';
import ExtractSquareTrace from './ExtractSquareTrace';
import Instructions from './Instructions';

const PANEL_PRINT_TRACE = 0;
const PANEL_EXTRACT_TRACE = 1;

class SetBackground extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool.isRequired,
        isLaser: PropTypes.bool.isRequired,
        showInstructions: PropTypes.bool.isRequired,
        actions: PropTypes.object.isRequired,
        hideModal: PropTypes.func.isRequired,

        // redux
        toolHead: PropTypes.object.isRequired,
        size: PropTypes.object.isRequired,
        setBackgroundImage: PropTypes.func.isRequired
    };

    state = {
        panel: PANEL_PRINT_TRACE,

        // print trace settings
        maxSideLength: Math.min(this.props.size.x, this.props.size.y),
        minSideLength: 40,
        sideLength: 100
    };

    actions = {
        showModal: () => {
            if (EXPERIMENTAL_LASER_CAMERA) {
                this.setState({
                    panel: PANEL_EXTRACT_TRACE
                });
            } else {
                this.setState({
                    panel: PANEL_PRINT_TRACE
                });
            }
        },
        setBackgroundImage: (filename) => {
            const { size } = this.props;
            const { sideLength } = this.state;

            if (!filename) {
                modal({
                    title: i18n._('key-Laser/CameraCaptureOriginal-Information'),
                    body: i18n._('key-Laser/CameraCaptureOriginal-Please extract background image from photo.')
                });
                return;
            }

            if (EXPERIMENTAL_LASER_CAMERA) {
                this.props.setBackgroundImage(filename, size.x, size.y, 0, 0);
            } else {
                this.props.setBackgroundImage(filename, sideLength, sideLength, (size.x - sideLength) / 2, (size.y - sideLength) / 2);
            }

            this.props.hideModal();
            this.actions.displayPrintTrace();
        },
        checkConnectionStatus: () => {
            const { isConnected, isLaser } = this.props;

            if (isConnected && isLaser) {
                return true;
            }

            modal({
                title: i18n._('key-Laser/CameraCaptureOriginal-Device Not Connected'),
                body: (
                    <Trans i18nKey="key-Laser/CameraCaptureOriginal_laser_module_not_connect_notice">
                        Laser module is not connected. Please make sure it is installed properly, and then connect to your Snapmaker via <b>Connection</b>.
                    </Trans>
                )
            });
            return false;
        },
        displayPrintTrace: () => {
            this.setState({ panel: PANEL_PRINT_TRACE });
        },
        displayExtractTrace: () => {
            this.setState({ panel: PANEL_EXTRACT_TRACE });
        },
        changeSideLength: (sideLength) => {
            this.setState({ sideLength });
        },
        changeFilename: (filename) => {
            this.setState({ filename });
        }
    };

    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.size, this.props.size)) {
            const size = nextProps.size;
            const maxSideLength = Math.min(size.x, size.y);
            const minSideLength = Math.min(40, maxSideLength);
            const sideLength = Math.min(maxSideLength, Math.max(minSideLength, this.state.sideLength));
            this.setState({
                sideLength,
                minSideLength,
                maxSideLength
            });
        }
    }

    render() {
        const state = { ...this.state };
        const { showInstructions } = this.props;

        return (
            <React.Fragment>
                {showInstructions && <Instructions onClose={this.props.actions.hideInstructions} />}
                <div>
                    {state.panel === PANEL_PRINT_TRACE && (
                        <PrintTrace
                            state={state}
                            actions={this.actions}
                            hideModal={this.props.hideModal}
                        />
                    )}
                    {state.panel === PANEL_EXTRACT_TRACE && (
                        <ExtractSquareTrace
                            toolHead={this.props.toolHead}
                            sideLength={this.state.sideLength}
                            displayPrintTrace={this.actions.displayPrintTrace}
                            setBackgroundImage={this.actions.setBackgroundImage}
                            hideModal={this.props.hideModal}
                        />
                    )}
                </div>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        size: machine.metadata.size,
        toolHead: machine.toolHead
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setBackgroundImage: (filename, width, height, dx, dy) => dispatch(actions.setBackgroundImage(filename, width, height, dx, dy))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SetBackground);
