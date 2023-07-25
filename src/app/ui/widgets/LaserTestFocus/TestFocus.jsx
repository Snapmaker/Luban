import { WorkflowStatus } from '@snapmaker/luban-platform';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Trans } from 'react-i18next';
import { connect } from 'react-redux';

import { actions as workspaceActions } from '../../../flux/workspace';
import generateLaserFocusGcode from '../../../lib/generateLaserFocusGcode';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import { NumberInput as Input } from '../../components/Input';
import Modal from '../../components/Modal';
import Slider from '../../components/Slider';
import TipTrigger from '../../components/TipTrigger';
import styles from './styles.styl';


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

        executeGcode: PropTypes.func.isRequired,
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
            this.props.executeGcode(gcodes.join('\n'));
        }
    };

    render() {
        const actions = {
            ...this.props.actions,
            ...this.actions
        };
        const { isConnected, showInstructions } = this.props;
        const isIdle = this.props.workflowState === WorkflowStatus.Idle;

        return (
            <React.Fragment>
                {showInstructions && (
                    <Modal style={{ width: '1080px' }} size="lg" onClose={this.props.actions.hideInstructions}>
                        <Modal.Header>
                            {/* <Modal.Title> */}
                            {i18n._('key-Workspace/Fine-tuneWorkOrigin-Fine-tune Work Origin')}
                            {/* </Modal.Title> */}
                        </Modal.Header>
                        <Modal.Body className={classNames(styles['test-laser-instruction-content'], 'clearfix')}>
                            <p>
                                <Trans i18nKey="key-Workspace/Fine-tuneWorkOriginWidget/Description-<0>Setting Work Origin</0> is essentially finding the best place for the engraved image in the X and Y directions and determining the distance (Z Offset) between the platform and the laser module to acquire the smallest laser dot on the material for the most efficient use of the laser power and the best result. For the 200mW laser module, the Z Offset can be set by judging the size of the laser dot by eyes with low power. However, for the 1600mW laser module, this method is less accurate as the laser dot is too strong and less interpretable. To set the Z Offset more accurately, we can move the module to the position that is close to the optimal Z Offset (Offset A). The software will test the results from a few positions next to Offset A on the same material. The best result determines the best Z Offset.">
                                    <b>Setting work origin</b> is essentially finding the best place for the engraved image
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
                                    src="/resources/images/laser/laser-test-instructions-01.png"
                                    role="presentation"
                                    alt="x"
                                />
                                <p>
                                    <Trans i18nKey="key-Workspace/Fine-tuneWorkOriginWidget/Description-Click <1>Focus</1> and use <3>Jog Pad</3> in the Axes section to move the Laser Cutting Module to the position that is close to the optimal Z Offset (just like how you do with the 200mW Laser Engraving Module).">
                                        Click <b>Focus</b> and use <b>Jog Pad</b> in the Axes section to move the Laser
                                        Cutting Module to the position that is close to the optimal Z Offset
                                        (just like how you do with the 200mW Laser Engraving Module).
                                    </Trans>
                                </p>
                            </div>
                            <div className={styles['test-laser-instruction-step']}>
                                <img
                                    src="/resources/images/laser/laser-test-instructions-02.png"
                                    role="presentation"
                                    alt="x"
                                />
                                <p>
                                    <Trans i18nKey="key-Workspace/Fine-tuneWorkOriginWidget/Description-Set <1>Work Speed</1> and <3>Power</3> based on the material you are using. If you are using a piece of 1.5 mm wood sheet, it’s recommended to set <5>Work Speed</5> to a value between 80 mm/s and 120 mm/s and <7>Power</7> to 100%. Click <9>Generate and Load G-code</9> and the G-code is automatically generated and loaded.">
                                        Set <b>Work Speed</b> and <b>Power</b> based on the material you are using. If you are using a
                                        piece of 1.5 mm wood sheet, it’s recommended to set the <b>Work Speed</b> to a value
                                        between 80 mm/s and 120 mm/s and set the <b>Power</b> to 100%.
                                        Click <b>Generate and Load G-code</b> and the G-code is automatically generated
                                        and loaded.
                                    </Trans>
                                </p>
                            </div>
                            <div className={styles['test-laser-instruction-step']}>
                                <img
                                    src="/resources/images/laser/laser-test-instructions-03.png"
                                    role="presentation"
                                    alt="x"
                                />
                                <p>
                                    <Trans i18nKey="key-Workspace/Fine-tuneWorkOriginWidget/Description-Click <1></1>to start laser cutting. Choose the position that can cut the material most smoothly or engrave the thinnest line and the software will set the position as Z Offset. In this example, -2.0 should be the Z Offset.">
                                        Click <span className="fa fa-play" /> to start laser cutting.
                                        Choose the position that can cut the material the most smoothly or engrave the
                                        thinnest line and the software will set it as Z Offset.
                                        In this example, -2.0 should be the Z Offset.
                                    </Trans>
                                </p>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                priority="level-two"
                                type="default"
                                width="96px"
                                onClick={this.props.actions.hideInstructions}
                            >
                                {i18n._('key-Workspace/Fine-tuneWorkOrigin-Close')}
                            </Button>
                        </Modal.Footer>
                    </Modal>
                )}
                <div className="sm-flex height-32 justify-space-between margin-vertical-8">
                    <span>{i18n._('key-Workspace/Fine-tuneWorkOrigin-Work Speed')}</span>
                    <TipTrigger
                        placement="right"
                        className="sm-flex-auto"
                        title={i18n._('key-Workspace/Fine-tuneWorkOrigin-Work Speed')}
                        content={i18n._('key-Workspace/Fine-tuneWorkOrigin-Determines how fast the machine moves when it’s working.')}
                    >
                        <Input
                            suffix="mm/min"
                            min={1}
                            max={6000}
                            value={this.state.workSpeed}
                            onChange={actions.onChangeWorkSpeed}
                        />
                    </TipTrigger>
                </div>
                <div className="sm-flex height-32 justify-space-between margin-vertical-8">
                    <span>{i18n._('key-Workspace/Fine-tuneWorkOrigin-Laser Power')}</span>
                    <Slider
                        value={this.state.power}
                        min={0}
                        max={100}
                        step={0.5}
                        onChange={actions.onChangePower}
                    />
                    <TipTrigger
                        placement="right"
                        className="sm-flex-auto"
                        title={i18n._('key-Workspace/Fine-tuneWorkOrigin-Laser Power')}
                        content={i18n._('key-Workspace/Fine-tuneWorkOrigin-Set the laser power.')}
                    >
                        <Input
                            suffix="%"
                            min={1}
                            max={100}
                            value={this.state.power}
                            onChange={actions.onChangePower}
                        />
                    </TipTrigger>
                </div>
                <Button
                    disabled={!isIdle}
                    className="margin-bottom-16"
                    onClick={actions.generateAndLoadGcode}
                >
                    {i18n._('key-Workspace/Fine-tuneWorkOrigin-Generate and Load G-code')}
                </Button>
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
                                            }, 'color-blue-2')}
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
                <Button
                    priority="level-two"
                    type="primary"
                    onClick={actions.setLaserFocusZ}
                    className="margin-top-16"
                    disabled={!isIdle || !isConnected}
                >
                    {i18n._('key-Workspace/Fine-tuneWorkOrigin-Set Work Origin')}
                </Button>
            </React.Fragment>
        );
    }
}

const mapDispatchToProps = (dispatch) => ({
    renderGcode: (name, gcode) => dispatch(workspaceActions.renderGcode(name, gcode)),
    clearGcode: () => dispatch(workspaceActions.clearGcode()),
    executeGcode: (gcode) => dispatch(workspaceActions.executeGcode(gcode))
});

export default connect(null, mapDispatchToProps)(TestFocus);
