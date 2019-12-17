import isEqual from 'lodash/isEqual';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { EXPERIMENTAL_LASER_CAMERA } from '../../constants';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Modal from '../../components/Modal';

import { actions } from '../../flux/laser';
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

        // redux
        size: PropTypes.object.isRequired,
        setBackgroundImage: PropTypes.func.isRequired,
        removeBackgroundImage: PropTypes.func.isRequired
    };

    state = {
        showModal: false,
        panel: PANEL_PRINT_TRACE,

        // print trace settings
        maxSideLength: Math.min(this.props.size.x, this.props.size.y),
        minSideLength: 40,
        sideLength: 100
    };

    actions = {
        showModal: () => {
            this.setState({
                showModal: true,
                panel: PANEL_EXTRACT_TRACE
            });
        },
        hideModal: () => {
            this.setState({
                showModal: false
            });
        },
        setBackgroundImage: (filename) => {
            console.log(this.props, this.state);
            const { size } = this.props;
            const { sideLength } = this.state;

            console.log('from outerside', filename);
            if (EXPERIMENTAL_LASER_CAMERA) {
                console.log('from outerside', filename);
                this.props.setBackgroundImage(filename, size.x, size.y, 0, 0);
            } else {
                this.props.setBackgroundImage(filename, sideLength, sideLength, (size.x - sideLength) / 2, (size.y - sideLength) / 2);
            }

            this.actions.hideModal();
            this.actions.displayPrintTrace();
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
                {state.showModal && (
                    <Modal style={{ width: '500px', height: '640px' }} size="lg" onClose={this.actions.hideModal}>
                        <Modal.Body style={{ margin: '0', padding: '0', height: '100%' }}>
                            {state.panel === PANEL_PRINT_TRACE && (
                                <PrintTrace
                                    state={state}
                                    actions={this.actions}
                                />
                            )}
                            {state.panel === PANEL_EXTRACT_TRACE && (
                                <ExtractSquareTrace
                                    sideLength={this.state.sideLength}
                                    displayPrintTrace={this.actions.displayPrintTrace}
                                    setBackgroundImage={this.actions.setBackgroundImage}
                                />
                            )}
                        </Modal.Body>
                    </Modal>
                )}
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={this.actions.showModal}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Add Background')}
                </button>
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={this.actions.removeBackgroundImage}
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
