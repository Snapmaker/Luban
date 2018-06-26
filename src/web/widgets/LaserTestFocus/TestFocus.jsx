import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import styles from './styles.styl';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';

const Z_VALUES_1 = [0, -0.5, -1, -1.5, -2, -2.5];
const Z_VALUES_2 = [0, +0.5, +1, +1.5, +2, +2.5];

class TestFocus extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };
    state = {
        z: 0,
        workSpeed: 80,
        power: 10
    };

    actions = {
        onChangeTestWorkSpeed: (value) => {
            this.setState({
                workSpeed: value
            });
        },
        onChangePower: (value) => {
            this.setState({
                power: value
            });
        },
        onChangeZ: (value) => {
            this.setState({
                z: value
            });
        }
    };
    render() {
        const actions = { ...this.actions, ...this.props.actions };
        const { canClick } = this.props.state;
        // todo: title & desc
        const title = 'title';
        const desc = 'desc';
        return (
            <div>
                <div style={{ marginTop: '3px', marginBottom: '18px' }}>
                    <table className={styles['parameter-table']}>
                        <tbody>
                            <tr>
                                <td style={{ width: '100%' }}>
                                    Test Work Speed
                                </td>
                                <td>
                                    <TipTrigger title={title} content={desc}>
                                        <Input
                                            style={{ width: '100px' }}
                                            min={1}
                                            max={6000}
                                            value={this.state.workSpeed}
                                            onChange={actions.onChangeTestWorkSpeed}
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
                                <td style={{ width: '15%' }}>
                                    Power(%)
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
                                    <TipTrigger title={title} content={desc}>
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
                </div>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    disabled={!canClick}
                    onClick={() => actions.generateAndLoadGcode(this.state.power, this.state.workSpeed)}
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
                                        <label
                                            htmlFor={zValue}
                                            className={classNames({
                                                [styles['text-test-laser-focus-z-value-selected']]: this.state.z === zValue,
                                                [styles['text-test-laser-focus-z-value-normal']]: this.state.z !== zValue
                                            })}
                                        >
                                            {zValue.toFixed(1)}
                                        </label>
                                        <br/>
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
                                    <td style={{ width: '220px', textAlign: 'center', height: '40px', visibility: (zValue !== 0) ? 'visible' : 'hidden' }} key={zValue}>
                                        <button
                                            type="button"
                                            id={zValue}
                                            onClick={() => actions.onChangeZ(zValue)}
                                            className={classNames({
                                                [styles['btn-test-laser-focus-z-selected']]: this.state.z === zValue,
                                                [styles['btn-test-laser-focus-z-normal']]: this.state.z !== zValue
                                            })}
                                        />
                                        <br/>
                                        <label
                                            htmlFor={zValue}
                                            className={classNames({
                                                [styles['text-test-laser-focus-z-value-selected']]: this.state.z === zValue,
                                                [styles['text-test-laser-focus-z-value-normal']]: this.state.z !== zValue
                                            })}
                                        >
                                            {'+' + zValue.toFixed(1)}
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
                    onClick={() => actions.setLaserFocusZ(this.state.z)}
                    disabled={!canClick}
                    style={{ display: 'block', width: '100%', marginTop: '5px' }}
                >
                    Adjust Focus
                </button>
            </div>
        );
    }
}

export default TestFocus;
