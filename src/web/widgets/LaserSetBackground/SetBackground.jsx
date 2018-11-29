import React, { PureComponent } from 'react';
import * as THREE from 'three';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';
import { WORKFLOW_STATE_IDLE, BOUND_SIZE } from '../../constants';
import Modal from '../../components/Modal';
import Space from '../../components/Space/Space';
import controller from '../../lib/controller';
import styles from './styles.styl';
import modal from '../../lib/modal';
import PrintBgImg from './PrintBgImg';
import ExtractBgImg from './ExtractBgImg';
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
            const isIdle = controller.workflowState === WORKFLOW_STATE_IDLE;
            if (isConnected && isLaser && isIdle) {
                return true;
            } else {
                // alert
                let msg = '';
                if (!isIdle) {
                    msg = 'Please wait for idle.';
                }
                if (!isLaser) {
                    msg = 'Please change to laser head.';
                }
                if (!isConnected) {
                    msg = 'Please connect first.';
                }
                modal({
                    title: i18n._('Can not operate'),
                    body: i18n._(`${msg}`)
                });
                return false;
            }
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
                const msg = 'Please extract background image from photo.';
                modal({
                    title: i18n._('Can not operate'),
                    body: i18n._(`${msg}`)
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
                {state.showInstructions &&
                <Modal style={{ width: '1080px' }} size="lg" onClose={actions.hideInstructions}>
                    <Modal.Header>
                        <Modal.Title>
                            {i18n._('How Fine Tune Work Origin Works')}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className={styles['test-laser-instruction-content']}>
                        <p>{i18n._('Setting work origin is essentially finding the best place for the engraved image \
in the X and Y directions and determining the distance (Z Offset) between the Engraving & Carving Platform and the \
Laser Module to acquire the smallest laser dot on the material for the most efficient use of the laser power and the \
best result. For the 200mW Laser Engraving Module, the Z Offset can be set by judging the size of the laser dot by eyes \
with low power. However, for the 1600mW Laser Cutting Module, this method is less accurate as the laser dot is too \
strong and less interpretable. To set the Z Offset more accurately, we can move the module to the position that is \
close to the optimal Z Offset (Offset A). The software will test the results from a few positions next to Offset A \
on the same material. The best result determines the best Z Offset.')}
                        </p>
                        <div className={styles['test-laser-instruction-step']}>
                            <img
                                src="images/laser/laser-test-instructions-01.png"
                                role="presentation"
                                alt="x"
                            />
                            <p>
                                <span>{i18n._('Click')}</span>
                                <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Focus')}</span>
                                <span>{i18n._('and use')}</span>
                                <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Jog Pad')}</span>
                                <span>{i18n._('in the Axes section to move the Laser Cutting Module to the position \
that is close to the optimal Z Offset (just like how you do with the 200mW Laser Engraving Module).')}
                                </span>
                            </p>
                        </div>
                        <div className={styles['test-laser-instruction-step']}>
                            <img
                                src="images/laser/laser-test-instructions-02.png"
                                role="presentation"
                                alt="x"
                            />
                            <p>
                                <span>{i18n._('Set Work Speed and Power based on the material you are using. If you are using \
a piece of 1.5 mm wood sheet, it’s recommended to set the Work Speed to a value between 80 mm/s and 120 mm/s and set the Power to 100%.')}
                                </span>
                                <Space width={4} />
                                <span>{i18n._('Click')}</span>
                                <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Generate and Load G-code')}</span>
                                <span>{i18n._('and the G-code is automatically generated and loaded.')}</span>
                            </p>
                        </div>
                        <div className={styles['test-laser-instruction-step']}>
                            <img
                                src="images/laser/laser-test-instructions-03.png"
                                role="presentation"
                                alt="x"
                            />
                            <p>
                                <span>{i18n._('Click')}</span>
                                <span className="fa fa-play" style={{ padding: '0 4px' }} />
                                <span>{i18n._('to start laser cutting.')}</span>
                                <Space width={4} />
                                <span>{i18n._('Choose the position that can cut the material the most smoothly or \
engrave the thinnest line and the software will set it as Z Offset. In this example, -2.0 should be the Z Offset.')}
                                </span>
                            </p>
                        </div>
                    </Modal.Body>
                </Modal>
                }
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

