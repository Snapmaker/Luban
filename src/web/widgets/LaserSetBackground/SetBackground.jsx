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
import PrintBgImg from './PrintBgImg';
import ExtractBgImg from './ExtractBgImg';
import Instructions from './Instructions';
import { actions } from '../../reducers/modules/laser';


class SetBackground extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            isConnected: PropTypes.bool.isRequired,
            isLaser: PropTypes.bool.isRequired,
            showInstructions: PropTypes.bool.isRequired
        }),
        // redux
        deleteBgImg: PropTypes.func.isRequired,
        setBgImg: PropTypes.func.isRequired
    };

    state = {
        showBgImgSettingModal: false,
        sideLength: 100,
        bgImgFilename: ''
    };

    actions = {
        startBgImgSetting: () => {
            if (!this.actions.checkConnectionStatus()) {
                return;
            }
            this.actions.showBgImgSettingModal();
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
                title: i18n._('Warning'),
                body: i18n._('Please make sure laser tool head is installed properly, and then connect the machine via Connection widget.')
            });
            return false;
        },
        showBgImgSettingModal: () => {
            this.setState({ showBgImgSettingModal: true });
        },
        hideBgImgSettingModal: () => {
            this.setState({ showBgImgSettingModal: false });
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
        },
    };

    render() {
        const actions = this.actions;
        const state = { ...this.props.state, ...this.state };

        return (
            <React.Fragment>
                {state.showInstructions && <Instructions actions={actions} />}
                {state.showBgImgSettingModal &&
                <Modal style={{ width: '900px', height: '700px' }} size="lg" onClose={actions.hideBgImgSettingModal}>
                    <Modal.Header>
                        <Modal.Title>
                            {i18n._('Set Laser Background')}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <div style={{ height: '540px', width: '402px', padding: '1px', float: 'left' }}>
                            <PrintBgImg
                                ref={node => {
                                    this.printBgImgNode = node;
                                }}
                                state={state}
                                actions={actions}
                            />
                        </div>
                        <div style={{ height: '540px', width: '402px', padding: '1px', float: 'right' }}>
                            <ExtractBgImg
                                ref={node => {
                                    this.extractBgImgNode = node;
                                }}
                                state={state}
                                actions={actions}
                            />
                        </div>
                        <div style={{ marginLeft: '335px', marginRight: '335px', marginTop: '570px' }}>
                            <button
                                type="button"
                                className={classNames(styles['btn-large'], styles['btn-primary'])}
                                onClick={actions.completeBgImgSetting}
                                style={{ display: 'block', width: '100%', marginTop: '5px' }}
                            >
                                {i18n._('Complete')}
                            </button>
                        </div>
                    </Modal.Body>
                </Modal>
                }
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-primary'])}
                    onClick={actions.startBgImgSetting}
                    style={{ display: 'block', width: '100%', marginTop: '5px' }}
                >
                    {i18n._('Start')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-primary'])}
                    onClick={actions.deleteBgImg}
                    style={{ display: 'block', width: '100%', marginTop: '5px' }}
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

