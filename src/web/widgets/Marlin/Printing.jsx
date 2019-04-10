import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import i18n from '../../lib/i18n';
import Controller from './Controller';
import Overrides from './Overrides';
import controller from '../../lib/controller';
import {
    MODAL_CONTROLLER,
    TEMPERATURE_MIN,
    TEMPERATURE_MAX
} from './constants';

const Printing = (props) => {
    const { state, actions } = props;
    const { nozzleTemperature, bedTemperature, canClick } = state;
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
            <Overrides
                ovF={ovF}
                ovS={ovS}
                actions={actions}
            />
            <div>
                <div className="row" style={{ marginBottom: 10 }}>
                    <div className="col-xs-6">
                        <div>{i18n._('Jog Speed')} (G0)</div>
                        <div>{ controllerState.jogSpeed }</div>
                    </div>
                    <div className="col-xs-6">
                        <div>{i18n._('Work Speed')} (G1)</div>
                        <div>{ controllerState.workSpeed }</div>
                    </div>
                </div>
                <div className="row" style={{ marginBottom: 10 }}>
                    <div className="col-xs-6">
                        <div>{i18n._('Nozzle Temperature')}</div>
                        <div>{ `${controllerState.temperature.t} ---> ` }
                            <input
                                style={{ margin: '0 0 6px 6px', width: '36px' }}
                                value={nozzleTemperature}
                                min={TEMPERATURE_MIN}
                                max={TEMPERATURE_MAX}
                                onChange={(event) => {
                                    const nozzleTemperature = event.target.value;
                                    actions.changeNozzleTemperature(nozzleTemperature);
                                    controller.command('gcode', `M104 S${nozzleTemperature}`);
                                }}
                                disabled={!canClick}
                            />
                        </div>
                    </div>
                    <div className="col-xs-6">
                        <div>{i18n._('Bed Temperature')}</div>
                        <div>{ `${controllerState.temperature.b} ---> ` }
                            <input
                                style={{ margin: '0 0 6px 6px', width: '36px' }}
                                value={bedTemperature}
                                min={TEMPERATURE_MIN}
                                max={TEMPERATURE_MAX}
                                onChange={(event) => {
                                    const bedTemperature = event.target.value;
                                    actions.changeBedTemperature(bedTemperature);
                                    controller.command('gcode', `M140 S${bedTemperature}`);
                                }}
                                disabled={!canClick}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

Printing.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Printing;
