import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import styles from '../styles.styl';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import api from '../../api';

const Z_VALUES_1 = [0, -0.5, -1, -1.5, -2, -2.5];
const Z_VALUES_2 = [0, +0.5, +1, +1.5, +2, +2.5];

class TestFocus extends PureComponent {
    state = {
        curZ: 0,
        workSpeed: 80,
        power: 10
    };

    actions = {
        onChangeWorkSpeed: (value) => {
            this.setState({
                workSpeed: value
            });
        },
        onChangePower: (value) => {
            this.setState({
                power: value
            });
        },
        onClickGenerateAndLoadGcode: () => {
            const params = {
                type: 'test-laser-focus',
                power: this.state.power,
                workSpeed: this.state.workSpeed,
                jogSpeed: 1500
            };
            api.generateGCode(params).then((res) => {
                const { gcode } = res.body;
                pubsub.publish('gcode:upload', { gcode: gcode, meta: { name: 'TestFocus' } });
            });
        },
        onChangeZ: (value) => {
            this.setState({
                curZ: value
            });
        },
        onClickAdjustFocus: () => {
        }
    };

    render() {
        const actions = this.actions;
        // todo: title & desc
        const title = 'title';
        const desc = 'desc';
        return (
            <div>
                <div style={{ marginTop: '3px', marginBottom: '18px' }}>
                    <table className={styles['parameter-table']} >
                        <tbody>
                            <tr>
                                <td style={{ width: '220px' }}>
                                    Test Work Speed
                                </td>
                                <td>
                                    <TipTrigger title={title} content={desc}>
                                        <Input
                                            style={{ width: '120px' }}
                                            value={this.state.workSpeed}
                                            onChange={value => {
                                                actions.onChangeWorkSpeed(value);
                                            }}
                                        />
                                        <span className={styles.unit}>mm/min</span>
                                    </TipTrigger>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <table style={{ width: '100%', textAlign: 'center', marginTop: '10px' }} >
                        <tbody>
                            <tr>
                                <td style={{ width: '15%' }}>
                                    Power(%)
                                </td>
                                <td style={{ width: '50%', paddingLeft: '5%', paddingRight: '5%' }}>
                                    <Slider
                                        defaultValue={this.state.power}
                                        value={this.state.power}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onChange={actions.onChangePower}
                                    />
                                </td>
                                <td style={{ width: '20%' }}>
                                    <TipTrigger title={title} content={desc}>
                                        <Input
                                            style={{ width: '100%' }}
                                            value={this.state.power}
                                            onChange={value => {
                                                actions.onChangePower(value);
                                            }}
                                        />
                                    </TipTrigger>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={actions.onClickGenerateAndLoadGcode}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    Generate and Load G-code
                </button>
                <div className={styles.separator} style={{ marginTop: '20px', marginBottom: '10px' }} />
                <table style={{ borderCollapse: 'separate', borderSpacing: '10px' }}>
                    <tbody>
                        <tr>
                            {Z_VALUES_1.map((zValue) => {
                                return (
                                    <td style={{ width: '220px', textAlign: 'center', height: '40px' }} key={zValue}>
                                        <label htmlFor={zValue} className={this.state.curZ === zValue ? styles['text-test-laser-focus-z-value-selected'] : styles['text-test-laser-focus-z-value-normal']} >{zValue.toFixed(1)}</label>
                                        <br />
                                        <button
                                            id={zValue}
                                            onClick={() => actions.onChangeZ(zValue)}
                                            className={ this.state.curZ === zValue ? styles['btn-test-laser-focus-z-selected'] : styles['btn-test-laser-focus-z-normal'] }
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                        <tr>
                            {Z_VALUES_2.map((zValue) => {
                                return (
                                    <td style={{ width: '220px', textAlign: 'center', height: '40px', visibility: (zValue !== 0) ? 'visible' : 'hidden' }} key={zValue}>
                                        <input
                                            id={zValue}
                                            type="button"
                                            onClick={() => actions.onChangeZ(zValue)}
                                            className={ this.state.curZ === zValue ? styles['btn-test-laser-focus-z-selected'] : styles['btn-test-laser-focus-z-normal'] }
                                        />
                                        <br />
                                        <label htmlFor={zValue} className={this.state.curZ === zValue ? styles['text-test-laser-focus-z-value-selected'] : styles['text-test-laser-focus-z-value-normal']}>{'+' + zValue.toFixed(1)}</label>
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-blue'])}
                    onClick={actions.onClickAdjustFocus}
                    style={{ display: 'block', width: '100%', marginTop: '5px' }}
                >
                    Adjust Focus
                </button>
            </div>
        );
    }
}

export default TestFocus;
