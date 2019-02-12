import React, { PureComponent } from 'react';
import * as THREE from 'three';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';
import { BOUND_SIZE } from '../../constants';
import Modal from '../../components/Modal';
import styles from './styles.styl';
import modal from '../../lib/modal';
import PrintTrace from './PrintSquareTrace';
import ExtractBackground from './ExtractSquareTrace';
import Instructions from './Instructions';
import { actions } from '../../reducers/laser';

const PANEL_PRINT_TRACE = 0;
const PANEL_EXTRACT_TRACE = 1;

class SetBackground extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            isConnected: PropTypes.bool.isRequired,
            isLaser: PropTypes.bool.isRequired,
            showInstructions: PropTypes.bool.isRequired
        }),
        actions: PropTypes.object.isRequired,
        // redux
        deleteBgImg: PropTypes.func.isRequired,
        setBgImg: PropTypes.func.isRequired
    };

    state = {
        showSetBackgroundModal: false,
        sideLength: 100,
        bgImgFilename: '',
        displayedPanel: PANEL_PRINT_TRACE
    };

    actions = {
        startBgImgSetting: () => {
            this.actions.showSetBackgroundModal();
        },
        deleteBgImg: () => {
            this.props.deleteBgImg();
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
        hideBgImgSettingModal: () => {
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
        changeBgImgFilename: (bgImgFilename) => {
            this.setState({ bgImgFilename });
        },
        completeBgImgSetting: () => {
            const { sideLength, bgImgFilename } = this.state;

            if (!bgImgFilename) {
                modal({
                    title: i18n._('Information'),
                    body: i18n._('Please extract background image from photo.')
                });
                return;
            }

            const x = (BOUND_SIZE - sideLength) / 2;
            const y = (BOUND_SIZE - sideLength) / 2;
            const leftBottomVector2 = new THREE.Vector2(x, y);
            this.props.setBgImg(bgImgFilename, leftBottomVector2, sideLength);

            this.actions.hideBgImgSettingModal();
            this.actions.displayPrintTrace();
        }
    };

    render() {
        const actions = this.actions;
        const state = { ...this.props.state, ...this.state };

        return (
            <React.Fragment>
                {state.showInstructions && <Instructions onClose={this.props.actions.hideInstructions} />}
                {state.showSetBackgroundModal &&
                <Modal style={{ width: '500px', height: '640px' }} size="lg" onClose={actions.hideBgImgSettingModal}>
                    <Modal.Body style={{ margin: '0', padding: '0', height: '100%' }}>
                        {state.displayedPanel === PANEL_PRINT_TRACE &&
                        <PrintTrace
                            state={state}
                            actions={actions}
                        />
                        }
                        {state.displayedPanel === PANEL_EXTRACT_TRACE &&
                        <ExtractBackground
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
                    onClick={actions.startBgImgSetting}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Add Background')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={actions.deleteBgImg}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Remove Background')}
                </button>
            </React.Fragment>
        );
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        deleteBgImg: () => dispatch(actions.deleteBgImg()),
        setBgImg: (filename, leftBottomVector2, sideLength) => dispatch(actions.setBgImg(filename, leftBottomVector2, sideLength))
    };
};

export default connect(null, mapDispatchToProps)(SetBackground);

