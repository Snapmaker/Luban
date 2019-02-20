import isEqual from 'lodash/isEqual';
import React, { PureComponent } from 'react';
import * as THREE from 'three';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';
import Modal from '../../components/Modal';
import styles from './styles.styl';
import modal from '../../lib/modal';
import PrintTrace from './PrintSquareTrace';
import ExtractSquareTrace from './ExtractSquareTrace';
import Instructions from './Instructions';
import { actions } from '../../reducers/laser';

const PANEL_PRINT_TRACE = 0;
const PANEL_EXTRACT_TRACE = 1;

class SetBackground extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        state: PropTypes.shape({
            isConnected: PropTypes.bool.isRequired,
            isLaser: PropTypes.bool.isRequired,
            showInstructions: PropTypes.bool.isRequired
        }),
        actions: PropTypes.object.isRequired,
        // redux
        removeBackgroundImage: PropTypes.func.isRequired,
        setBackgroundImage: PropTypes.func.isRequired
    };

    state = {
        showSetBackgroundModal: false,
        maxSideLength: 100,
        minSideLength: 40,
        sideLength: 100,
        filename: '',
        displayedPanel: PANEL_PRINT_TRACE
    };

    actions = {
        showModal: () => {
            this.actions.showSetBackgroundModal();
        },
        removeBackgroundImage: () => {
            this.props.removeBackgroundImage();
        },
        checkConnectionStatus: () => {
            const { isConnected, isLaser } = this.props.state;

            if (isConnected && isLaser) {
                return true;
            }

            modal({
                title: i18n._('Information'),
                body: i18n._('Laser tool head is not connected. Please make sure the laser tool head is installed properly, and then connect to your Snapmaker via Connection widget.')
            });
            return false;
        },
        showSetBackgroundModal: () => {
            this.setState({ showSetBackgroundModal: true });
        },
        hideSetBackgroundModal: () => {
            this.setState({ showSetBackgroundModal: false });
        },
        displayPrintTrace: () => {
            this.setState({ displayedPanel: PANEL_PRINT_TRACE });
        },
        displayExtractTrace: () => {
            this.setState({ displayedPanel: PANEL_EXTRACT_TRACE });
        },
        changeSideLength: (sideLength) => {
            this.setState({ sideLength });
        },
        changeFilename: (filename) => {
            this.setState({ filename });
        },
        completeBackgroundSetting: () => {
            const { size } = this.props;
            const { sideLength, filename } = this.state;

            if (!filename) {
                modal({
                    title: i18n._('Information'),
                    body: i18n._('Please extract background image from photo.')
                });
                return;
            }

            const x = (size.x - sideLength) / 2;
            const y = (size.y - sideLength) / 2;
            const bottomLeftPoint = new THREE.Vector2(x, y);
            this.props.setBackgroundImage(filename, bottomLeftPoint, sideLength);

            this.actions.hideSetBackgroundModal();
            this.actions.displayPrintTrace();
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
        const actions = this.actions;
        const state = { ...this.props.state, ...this.state };

        return (
            <React.Fragment>
                {state.showInstructions && <Instructions onClose={this.props.actions.hideInstructions} />}
                {state.showSetBackgroundModal &&
                <Modal style={{ width: '500px', height: '640px' }} size="lg" onClose={actions.hideSetBackgroundModal}>
                    <Modal.Body style={{ margin: '0', padding: '0', height: '100%' }}>
                        {state.displayedPanel === PANEL_PRINT_TRACE &&
                        <PrintTrace
                            state={state}
                            actions={actions}
                        />
                        }
                        {state.displayedPanel === PANEL_EXTRACT_TRACE &&
                        <ExtractSquareTrace
                            state={state}
                            actions={actions}
                        />
                        }
                    </Modal.Body>
                </Modal>
                }
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={actions.showModal}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Add Background')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={actions.removeBackgroundImage}
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
        removeBackgroundImage: () => dispatch(actions.removeBackgroundImage()),
        setBackgroundImage: (filename, bottomLeftPoint, sideLength) => dispatch(actions.setBackgroundImage(filename, bottomLeftPoint, sideLength))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SetBackground);

