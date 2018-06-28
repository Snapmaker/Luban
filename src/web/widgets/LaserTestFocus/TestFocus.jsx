import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import pubsub from 'pubsub-js';
import i18n from '../../lib/i18n';
import { WORKFLOW_STATE_IDLE } from '../../constants';
import api from '../../api';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import controller from '../../lib/controller';
import styles from './styles.styl';


const Z_VALUES_1 = [0, -0.5, -1, -1.5, -2, -2.5];
const Z_VALUES_2 = [0, +0.5, +1, +1.5, +2, +2.5];

class TestFocus extends PureComponent {
    static propTypes = {
        state: PropTypes.object
    };

    state = {
        z: 0,
        workSpeed: 80,
        power: 10
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
        generateAndLoadGcode: (power, workSpeed) => {
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
                `G0 Z${z}`,
                'G92 X0 Y0 Z0'
            ];
            controller.command('gcode', gcodes.join('\n'));
        }
    };

    render() {
        const actions = this.actions;
        const { isConnected } = this.props.state;
        const isIdle = controller.workflowState === WORKFLOW_STATE_IDLE;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']}>
                    <tbody>
                        <tr>
                            <td style={{ width: '100%' }}>
                                Work Speed
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
                            <td style={{ width: '20%' }}>
                                Power (%)
                            </td>
                            <td style={{ width: '50%', paddingLeft: '5%', paddingRight: '5%' }}>
                                <Slider
                                    defaultValue={this.state.power}
                                    value={this.state.power}
                                    min={1}
                                    max={100}
                                    step={1}
                                    onChange={actions.onChangePower}
                                />
                            </td>
                            <td style={{ width: '20%' }}>
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
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    disabled={!isIdle}
                    onClick={() => actions.generateAndLoadGcode(this.state.power, this.state.workSpeed)}
                >
                    Generate and Load G-code
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
                    className={classNames(styles.btn, styles['btn-large-blue'])}
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
