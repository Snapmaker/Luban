import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import pubsub from 'pubsub-js';
import i18n from '../../lib/i18n';
import { WORKFLOW_STATE_IDLE } from '../../constants';
import api from '../../api';
import Modal from '../../components/Modal';
import { NumberInput as Input } from '../../components/Input';
import Space from '../../components/Space/Space';
import TipTrigger from '../../components/TipTrigger';
import controller from '../../lib/controller';
import styles from './styles.styl';


const Z_VALUES_1 = [0, -0.5, -1, -1.5, -2, -2.5];
const Z_VALUES_2 = [0, +0.5, +1, +1.5, +2, +2.5];

class TestFocus extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            isConnected: PropTypes.bool,
            showInstructions: PropTypes.bool
        }),
        actions: PropTypes.shape({
            hideInstructions: PropTypes.func
        })
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
            const params = {
                type: 'test-laser-focus',
                power: power,
                workSpeed: workSpeed,
                jogSpeed: 1500
            };
            api.generateGCode(params).then((res) => {
                const { gcode } = res.body;
                pubsub.publish('gcode:upload', { gcode: gcode, meta: { name: 'TestFocus' } });
            });
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
        const { isConnected } = this.props.state;
        const isIdle = controller.workflowState === WORKFLOW_STATE_IDLE;

        return (
            <React.Fragment>
                {this.props.state.showInstructions &&
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
                    className={classNames(styles['btn-large'], styles['btn-default'])}
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
                                        <label
                                            className={classNames({
                                                [styles['text-test-laser-focus-z-value-selected']]: this.state.z === zValue,
                                                [styles['text-test-laser-focus-z-value-normal']]: this.state.z !== zValue
                                            })}
                                        >
                                            {zValue.toFixed(1)}
                                        </label>
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
                                        style={{ textAlign: 'center', visibility: (zValue !== 0) ? 'visible' : 'hidden' }}
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
                                        <label
                                            className={classNames({
                                                [styles['text-test-laser-focus-z-value-selected']]: this.state.z === zValue,
                                                [styles['text-test-laser-focus-z-value-normal']]: this.state.z !== zValue
                                            })}
                                        >
                                            +{zValue.toFixed(1)}
                                        </label>
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-primary'])}
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

export default TestFocus;
