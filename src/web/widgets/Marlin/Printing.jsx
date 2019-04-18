import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import i18n from '../../lib/i18n';
import Controller from './Controller';
import Overrides from './Overrides';
import controller from '../../lib/controller';
import OptionalDropdown from '../../components/OptionalDropdown';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import styles from './index.styl';
import {
    MODAL_CONTROLLER,
    TEMPERATURE_MIN,
    TEMPERATURE_MAX
} from './constants';

const Printing = (props) => {
    const { state, actions } = props;
    const { canClick, statusPadEnabled, heaterControlEnabled, overridesEnabled } = state;
    const controllerState = state.controller.state;
    const ovF = get(controllerState, 'ovF', 0);
    const ovS = get(controllerState, 'ovS', 0);

    return (
        <div>
            {state.modal.name === MODAL_CONTROLLER && (
                <Controller
                    state={state}
                    actions={actions}
                />
            )}
            {statusPadEnabled !== null && (
                <OptionalDropdown
                    style={{ marginTop: '10px' }}
                    title={i18n._('Status Pad')}
                    onClick={actions.onStatusPadEnabled}
                    hidden={!statusPadEnabled}
                >
                    <div className="row" style={{ margin: '0 0 10px 0' }}>
                        <div className="col-xs-6" style={{ padding: '0 6px' }}>
                            <div>{i18n._('Jog Speed')} (G0)</div>
                            <div>{ controllerState.jogSpeed }</div>
                        </div>
                        <div className="col-xs-6" style={{ padding: '0 6px' }}>
                            <div>{i18n._('Work Speed')} (G1)</div>
                            <div>{ controllerState.workSpeed }</div>
                        </div>
                    </div>
                </OptionalDropdown>
            )}
            {heaterControlEnabled !== null && (
                <OptionalDropdown
                    style={{ marginTop: '10px' }}
                    title={i18n._('Heater Control')}
                    onClick={actions.onHeaterControlEnabled}
                    hidden={!heaterControlEnabled}
                >
                    <table className={styles['parameter-table']}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '0 0 0' }}>
                                    <p style={{ margin: '0 0 0 0', padding: '0 6px 6px' }}>{i18n._('Nozzle')}</p>
                                </td>
                                <td>
                                    <div>{ `${controllerState.temperature.t} °C` }</div>
                                </td>
                                <td>
                                    <div>/</div>
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Nozzle')}
                                        content={i18n._('Set nozzle temperature.')}
                                    >
                                        <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                            <Input
                                                style={{ width: '45px' }}
                                                value={state.nozzleTemperature}
                                                min={TEMPERATURE_MIN}
                                                max={TEMPERATURE_MAX}
                                                onChange={(event) => {
                                                    const nozzleTemperature = event.target.value;
                                                    actions.changeNozzleTemperature(nozzleTemperature);
                                                }}
                                                disabled={!canClick}
                                            />
                                        </div>
                                    </TipTrigger>
                                </td>
                                <td>
                                    <p style={{ margin: '0 0 0 0' }}>{i18n._('°C')}</p>
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        style={{ margin: '0 0 0 0' }}
                                        onClick={(event) => {
                                            controller.command('gcode', `M104 S${state.nozzleTemperature}`);
                                        }}
                                        disabled={!canClick}
                                    >
                                        <i className="fa fa-check" aria-hidden="true" style={{ fontSize: 6 }}/>
                                    </button>
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        style={{ margin: '0 0 0 0' }}
                                        onClick={(event) => {
                                            controller.command('gcode', 'M104 S0');
                                        }}
                                        disabled={!canClick}
                                    >
                                        <i className="fa fa-times" aria-hidden="true" style={{ fontSize: 6 }}/>
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '0 0 0' }}>
                                    <p style={{ margin: '0 0 0 0', padding: '0 6px 0' }}>{i18n._('Bed')}</p>
                                </td>
                                <td>
                                    <div>{ `${controllerState.temperature.b} °C` }</div>
                                </td>
                                <td>
                                    <div>/</div>
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Bed')}
                                        content={i18n._('Set bed temperature.')}
                                    >
                                        <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                            <Input
                                                style={{ width: '45px' }}
                                                value={state.bedTemperature}
                                                min={TEMPERATURE_MIN}
                                                max={TEMPERATURE_MAX}
                                                onChange={(event) => {
                                                    const bedTemperature = event.target.value;
                                                    actions.changeBedTemperature(bedTemperature);
                                                }}
                                                disabled={!canClick}
                                            />
                                        </div>
                                    </TipTrigger>
                                </td>
                                <td>
                                    <p style={{ margin: '0 0 0 0' }}>{i18n._('°C')}</p>
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            controller.command('gcode', `M140 S${state.bedTemperature}`);
                                        }}
                                        disabled={!canClick}
                                    >
                                        <i className="fa fa-check" aria-hidden="true" style={{ fontSize: 6 }} />
                                    </button>
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        style={{ margin: '0 0 0 0' }}
                                        onClick={(event) => {
                                            controller.command('gcode', 'M140 S0');
                                        }}
                                        disabled={!canClick}
                                    >
                                        <i className="fa fa-times" aria-hidden="true" style={{ fontSize: 6 }}/>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </OptionalDropdown>
            )}
            {overridesEnabled !== null && (
                <OptionalDropdown
                    style={{ marginTop: '10px' }}
                    title={i18n._('Overrides')}
                    onClick={actions.onOverridesEnabled}
                    hidden={!overridesEnabled}
                >
                    <Overrides
                        ovF={ovF}
                        ovS={ovS}
                        actions={actions}
                    />
                </OptionalDropdown>
            )}
        </div>
    );
};

Printing.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Printing;
