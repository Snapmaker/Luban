import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import { NumberInput } from '../../components/Input';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import styles from './index.styl';
import { TEMPERATURE_MIN, TEMPERATURE_MAX } from '../../constants';

class HeaterControl extends PureComponent {
    static propTypes = {
        temperature: PropTypes.object,
        nozzleTargetTemperature: PropTypes.number,
        bedTargetTemperature: PropTypes.number,
        changeBedTargetTemperature: PropTypes.func,
        changeNozzleTargetTemperature: PropTypes.func,
        executeGcode: PropTypes.func
    };

    actions = {
        onApplyHeadTemperature: () => {
            this.props.executeGcode(`M104 S${this.props.nozzleTargetTemperature}`);
        },
        onCancelHeadTemperature: () => {
            this.props.executeGcode('M104 S0');
        },
        onApplybedTargetTemperature: () => {
            this.props.executeGcode(`M140 S${this.props.bedTargetTemperature}`);
        },
        onCancelbedTargetTemperature: () => {
            this.props.executeGcode('M140 S0');
        }
    };

    render() {
        const { temperature = {}, nozzleTargetTemperature, bedTargetTemperature } = this.props;
        const bedCurrentTemperature = temperature.b || '0.0';
        const nozzleCurrentTemperature = temperature.t || '0.0';
        return (
            <div>
                <table className={styles['parameter-table']} style={{ margin: '10px 0' }}>
                    <tbody>
                        <tr>
                            <td style={{ padding: '0' }}>
                                <p style={{ margin: '0', padding: '0' }}>{i18n._('Extruder')}</p>
                            </td>
                            <td style={{ width: '60px' }}>
                                <div className="input-group input-group-sm" style={{ float: 'right' }}>
                                    {nozzleCurrentTemperature}°C
                                </div>
                            </td>
                            <td style={{ width: '120px' }}>
                                <TipTrigger
                                    title={i18n._('Extruder')}
                                    content={i18n._('Set the target temperature of the nozzle in real-time.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <span style={{ margin: '0 4px' }}>/</span>
                                        <NumberInput
                                            className={styles['input-normal']}
                                            value={nozzleTargetTemperature}
                                            min={TEMPERATURE_MIN}
                                            max={TEMPERATURE_MAX}
                                            onChange={this.props.changeNozzleTargetTemperature}
                                        />
                                        <span style={{ marginLeft: '4px' }}>°C</span>
                                    </div>
                                </TipTrigger>
                            </td>
                            <td style={{ width: '20%' }}>
                                <Anchor
                                    className={classNames('fa', 'fa-check', styles['fa-btn'])}
                                    onClick={this.actions.onApplyHeadTemperature}
                                />
                                <Anchor
                                    className={classNames('fa', 'fa-times', styles['fa-btn'])}
                                    onClick={this.actions.onCancelHeadTemperature}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td style={{ padding: '0' }}>
                                <p style={{ margin: '0', padding: '0' }}>{i18n._('Bed')}</p>
                            </td>
                            <td style={{ width: '60px' }}>
                                <div className="input-group input-group-sm" style={{ float: 'right' }}>
                                    {bedCurrentTemperature}°C
                                </div>
                            </td>
                            <td style={{ width: '120px' }}>
                                <TipTrigger
                                    title={i18n._('Heated Bed')}
                                    content={i18n._('Set the target temperature of the heated bed in real-time.')}
                                >
                                    <div className="input-group input-group-sm">
                                        <span style={{ margin: '0 4px' }}>/</span>
                                        <NumberInput
                                            className={styles['input-normal']}
                                            value={bedTargetTemperature}
                                            min={TEMPERATURE_MIN}
                                            max={TEMPERATURE_MAX}
                                            onChange={this.props.changeBedTargetTemperature}
                                        />
                                        <span style={{ marginLeft: '4px' }}>°C</span>
                                    </div>
                                </TipTrigger>
                            </td>
                            <td>
                                <Anchor
                                    className={classNames('fa', 'fa-check', styles['fa-btn'])}
                                    aria-hidden="true"
                                    onClick={this.actions.onApplybedTargetTemperature}
                                />
                                <Anchor
                                    className={classNames('fa', 'fa-times', styles['fa-btn'])}
                                    onClick={this.actions.onCancelbedTargetTemperature}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

export default HeaterControl;
