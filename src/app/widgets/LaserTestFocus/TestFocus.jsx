import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import classNames from 'classnames';
import { Trans } from 'react-i18next';

import i18n from '../../lib/i18n';
import Modal from '../../components/Modal';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { controller } from '../../lib/controller';
import styles from './styles.styl';
import generateLaserFocusGcode from '../../lib/generateLaserFocusGcode';
import { actions as workspaceActions } from '../../flux/workspace';
import { WORKFLOW_STATE_IDLE } from '../../constants';


const Z_VALUES_1 = [0, -0.5, -1, -1.5, -2, -2.5];
const Z_VALUES_2 = [0, +0.5, +1, +1.5, +2, +2.5];

class TestFocus extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool,
        workflowState: PropTypes.string,
        showInstructions: PropTypes.bool,
        actions: PropTypes.shape({
            hideInstructions: PropTypes.func
        }),

        renderGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired
    };

    state = {
        z: 0,
        workSpeed: 85,
        power: 6
    };

    actions = {
        onChangeWorkSpeed: (workSpeed) => {
            this.setState({ workSpeed });
        },
        onChangePower: (power) => {
            this.setState({ power });
        },
        onChangeZ: (z) => {
            this.setState({ z });
        },
        generateAndLoadGcode: () => {
            const { power, workSpeed } = this.state;
            const jogSpeed = 1500;
            const gcode = generateLaserFocusGcode(power, workSpeed, jogSpeed);
            this.props.clearGcode();
            this.props.renderGcode('Laser_Fine_Tune.nc', gcode);
        },
        setLaserFocusZ: () => {
            const z = this.state.z;
            const gcodes = [
                `G0 Z${z} F100`,
                'G92 X0 Y0 Z0'
            ];
            controller.command('gcode', gcodes.join('\n'));
        }
    };

    render() {
        const actions = {
            ...this.props.actions,
            ...this.actions
        };
        const { isConnected, showInstructions } = this.props;
        const isIdle = this.props.workflowState === WORKFLOW_STATE_IDLE;

        return (
            <React.Fragment>
                {showInstructions && (
                    <Modal style={{ width: '1080px' }} size="lg" onClose={actions.hideInstructions}>
                        <Modal.Header>
                            <Modal.Title>
                                {i18n._('How Fine Tune Work Origin Works')}
                            </Modal.Title>
                        </Modal.Header>
                        <Modal.Body className={styles['test-laser-instruction-content']}>
                            <p>
                                <Trans>
                                    Setting work origin is essentially finding the best place for the engraved image
                                    in the X and Y directions and determining the distance (Z Offset) between the
                                    Engraving & Carving Platform and the Laser Module to acquire the smallest laser dot
                                    on the material for the most efficient use of the laser power and the best result.
                                    For the 200mW Laser Engraving Module, the Z Offset can be set by judging the size of
                                    the laser dot by eyes with low power.
                                    However, for the 1600mW Laser Cutting Module, this method is less accurate as the
                                    laser dot is too strong and less interpretable. To set the Z Offset more accurately,
                                    we can move the module to the position that is close to the optimal Z Offset (Offset
                                    A). The software will test the results from a few positions next to Offset A on the
                                    same material. The best result determines the best Z Offset.
                                </Trans>
                            </p>
                            <div className={styles['test-laser-instruction-step']}>
                                <img
                                    src="images/laser/laser-test-instructions-01.png"
                                    role="presentation"
                                    alt="x"
                                />
                                <p>
                                    <Trans>
                                        Click <b>Focus</b> and use <b>Jog Pad</b> in the Axes section to move the Laser
                                        Cutting Module to the position that is close to the optimal Z Offset
                                        (just like how you do with the 200mW Laser Engraving Module).
                                    </Trans>
                                </p>
                            </div>
                            <div className={styles['test-laser-instruction-step']}>
                                <img
                                    src="images/laser/laser-test-instructions-02.png"
                                    role="presentation"
                                    alt="x"
                                />
                                <p>
                                    <Trans>
                                        Set Work Speed and Power based on the material you are using. If you are using a
                                        piece of 1.5 mm wood sheet, it’s recommended to set the Work Speed to a value
                                        between 80 mm/s and 120 mm/s and set the Power to 100%.
                                        Click <b>Generate and Load G-code</b> and the G-code is automatically generated
                                        and loaded.
                                    </Trans>
                                </p>
                            </div>
                            <div className={styles['test-laser-instruction-step']}>
                                <img
                                    src="images/laser/laser-test-instructions-03.png"
                                    role="presentation"
                                    alt="x"
                                />
                                <p>
                                    <Trans>
                                        Click <span className="fa fa-play" /> to start laser cutting.
                                        Choose the position that can cut the material the most smoothly or engrave the
                                        thinnest line and the software will set it as Z Offset.
                                        In this example, -2.0 should be the Z Offset.
                                    </Trans>
                                </p>
                            </div>
                        </Modal.Body>
                    </Modal>
                )}
                <table className={styles['parameter-table']}>
                    <tbody>
                        <tr>
                            <td style={{ width: '100%' }}>
                                {i18n._('Work Speed')}
                            </td>
                            <td>
                                <TipTrigger
                                    placement="right"
                                    title={i18n._('Work Speed')}
                                    content={i18n._('Determines how fast the machine moves when it’s working.')}
                                >
                                    <Input
                                        style={{ width: '100px', float: 'right' }}
                                        min={1}
                                        max={6000}
                                        value={this.state.workSpeed}
                                        onChange={actions.onChangeWorkSpeed}
                                    />
                                    <span className={styles.unit}>mm/min</span>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '25%' }}>
                                {i18n._('Power (%)')}
                            </td>
                            <td style={{ width: '50%', paddingLeft: '5%', paddingRight: '5%' }}>
                                <Slider
                                    value={this.state.power}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    onChange={actions.onChangePower}
                                />
                            </td>
                            <td style={{ width: '25%' }}>
                                <TipTrigger
                                    placement="right"
                                    title={i18n._('Power')}
                                    content={i18n._('Power to use when laser is working.')}
                                >
                                    <Input
                                        style={{ width: '100%' }}
                                        min={1}
                                        max={100}
                                        value={this.state.power}
                                        onChange={actions.onChangePower}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                    className="sm-btn-large sm-btn-default"
                    disabled={!isIdle}
                    onClick={actions.generateAndLoadGcode}
                >
                    {i18n._('Generate and Load G-code')}
                </button>
                <div className={styles.separator} style={{ marginTop: '20px', marginBottom: '10px' }} />
                <table style={{ borderCollapse: 'separate', borderSpacing: '5px', width: '100%' }}>
                    <tbody>
                        <tr>
                            {Z_VALUES_1.map((zValue) => {
                                return (
                                    <td style={{ textAlign: 'center' }} key={zValue}>
                                        <span
                                            className={classNames({
                                                [styles['text-test-laser-focus-z-value-selected']]: this.state.z === zValue,
                                                [styles['text-test-laser-focus-z-value-normal']]: this.state.z !== zValue
                                            })}
                                        >
                                            {zValue.toFixed(1)}
                                        </span>
                                        <br />
                                        <button
                                            type="button"
                                            id={zValue}
                                            onClick={() => actions.onChangeZ(zValue)}
                                            className={classNames({
                                                [styles['btn-test-laser-focus-z-selected']]: this.state.z === zValue,
                                                [styles['btn-test-laser-focus-z-normal']]: this.state.z !== zValue
                                            })}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                        <tr>
                            {Z_VALUES_2.map((zValue) => {
                                return (
                                    <td
                                        key={zValue}
                                        style={{
                                            textAlign: 'center',
                                            visibility: (zValue !== 0) ? 'visible' : 'hidden'
                                        }}
                                    >
                                        <button
                                            type="button"
                                            id={zValue}
                                            onClick={() => actions.onChangeZ(zValue)}
                                            className={classNames({
                                                [styles['btn-test-laser-focus-z-selected']]: this.state.z === zValue,
                                                [styles['btn-test-laser-focus-z-normal']]: this.state.z !== zValue
                                            })}
                                        />
                                        <br />
                                        <span
                                            className={classNames({
                                                [styles['text-test-laser-focus-z-value-selected']]: this.state.z === zValue,
                                                [styles['text-test-laser-focus-z-value-normal']]: this.state.z !== zValue
                                            })}
                                        >
                                            +{zValue.toFixed(1)}
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    className="sm-btn-large sm-btn-primary"
                    onClick={actions.setLaserFocusZ}
                    disabled={!isIdle || !isConnected}
                    style={{ display: 'block', width: '100%', marginTop: '5px' }}
                >
                    {i18n._('Set Work Origin')}
                </button>
            </React.Fragment>
        );
    }
}

const mapDispatchToProps = (dispatch) => ({
    renderGcode: (name, gcode) => dispatch(workspaceActions.renderGcode(name, gcode)),
    clearGcode: () => dispatch(workspaceActions.clearGcode())
});

export default connect(null, mapDispatchToProps)(TestFocus);
