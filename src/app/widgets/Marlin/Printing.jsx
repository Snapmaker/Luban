import get from 'lodash/get';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import TipTrigger from '../../components/TipTrigger';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';

import Overrides from './Overrides';
import MachineModal from './MachineModal';
import styles from './index.styl';
import { TEMPERATURE_MIN, TEMPERATURE_MAX } from './constants';

class Printing extends PureComponent {
    static propTypes = {
        headType: PropTypes.string,
        state: PropTypes.object,
        actions: PropTypes.object
    };

    actions = {
        onApplyHeadTemperature: () => {
            const { state } = this.props;
            controller.command('gcode', `M104 S${state.nozzleTemperature}`);
        },
        onCancelHeadTemperature: () => {
            this.props.actions.changeNozzleTemperature(0);
            controller.command('gcode', 'M104 S0');
        },
        onApplyBedTemperature: () => {
            const { state } = this.props;
            controller.command('gcode', `M140 S${state.bedTemperature}`);
        },
        onCancelBedTemperature: () => {
            this.props.actions.changeBedTemperature(0);
            controller.command('gcode', 'M140 S0');
        }
    };

    render() {
        const { headType, state, actions } = this.props;
        const { canClick, statusSectionExpanded, heaterControlSectionExpanded, overridesSectionExpanded, machineModalSectionExpanded } = state;
        const controllerState = state.controller.state || {};
        const ovF = get(controllerState, 'ovF', 0);
        const ovS = get(controllerState, 'ovS', 0);
        // const spindle = get(controllerState, 'spindle') || none;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={actions.toggleStatusSection}>
                    <span className="fa fa-gear sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Status Pad')}</span>
                    <span className={classNames(
                        'fa',
                        statusSectionExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {statusSectionExpanded && (
                    <table className={styles['parameter-table']} style={{ margin: '10px 0' }}>
                        <tbody>
                            <tr>
                                <td style={{ width: '50%', padding: '0 6px' }}>
                                    <div>{i18n._('Jog Speed')} (G0)</div>
                                    <div>{controllerState.jogSpeed}</div>
                                </td>
                                <td style={{ width: '50%', padding: '0 6px' }}>
                                    <div>{i18n._('Work Speed')} (G1)</div>
                                    <div>{controllerState.workSpeed}</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}
                <Anchor className="sm-parameter-header" onClick={actions.toggleHeaterControlSection}>
                    <span className="fa fa-gear sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Heater Control')}</span>
                    <span className={classNames(
                        'fa',
                        heaterControlSectionExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {heaterControlSectionExpanded && (
                    <table className={styles['parameter-table']} style={{ margin: '10px 0' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '0' }}>
                                    <p style={{ margin: '0', padding: '0 6px' }}>{i18n._('Nozzle')}</p>
                                </td>
                                <td style={{ width: '10%' }}>
                                    <div className="input-group input-group-sm" style={{ float: 'right' }}>
                                        {controllerState.temperature.t}°C
                                    </div>
                                </td>
                                <td style={{ width: '35%' }}>
                                    <TipTrigger
                                        title={i18n._('Nozzle')}
                                        content={i18n._('Set the target temperature of the nozzle in real-time.')}
                                    >
                                        <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                            <span style={{ margin: '0 4px' }}>/</span>
                                            <Input
                                                style={{ width: '50px' }}
                                                value={state.nozzleTemperature}
                                                min={TEMPERATURE_MIN}
                                                max={TEMPERATURE_MAX}
                                                onChange={actions.changeNozzleTemperature}
                                                disabled={!canClick}
                                            />
                                            <span style={{ marginLeft: '4px' }}>°C</span>
                                        </div>
                                    </TipTrigger>
                                </td>
                                <td style={{ width: '20%' }}>
                                    <Anchor
                                        className={classNames('fa', 'fa-check', styles['fa-btn'])}
                                        disabled={!canClick}
                                        onClick={this.actions.onApplyHeadTemperature}
                                    />
                                    <Anchor
                                        className={classNames('fa', 'fa-times', styles['fa-btn'])}
                                        disabled={!canClick}
                                        onClick={this.actions.onCancelHeadTemperature}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '0' }}>
                                    <p style={{ margin: '0', padding: '0 6px' }}>{i18n._('Bed')}</p>
                                </td>
                                <td style={{ width: '10%' }}>
                                    <div className="input-group input-group-sm" style={{ float: 'right' }}>
                                        {controllerState.temperature.b}°C
                                    </div>
                                </td>
                                <td style={{ width: '35%' }}>
                                    <TipTrigger
                                        title={i18n._('Heated Bed')}
                                        content={i18n._('Set the target temperature of the heated bed in real-time.')}
                                    >
                                        <div className="input-group input-group-sm">
                                            <span style={{ margin: '0 4px' }}>/</span>
                                            <Input
                                                style={{ width: '50px' }}
                                                value={state.bedTemperature}
                                                min={TEMPERATURE_MIN}
                                                max={TEMPERATURE_MAX}
                                                onChange={actions.changeBedTemperature}
                                                disabled={!canClick}
                                            />
                                            <span style={{ marginLeft: '4px' }}>°C</span>
                                        </div>
                                    </TipTrigger>
                                </td>
                                <td>
                                    <Anchor
                                        className={classNames('fa', 'fa-check', styles['fa-btn'])}
                                        aria-hidden="true"
                                        disabled={!canClick}
                                        onClick={this.actions.onApplyBedTemperature}
                                    />
                                    <Anchor
                                        className={classNames('fa', 'fa-times', styles['fa-btn'])}
                                        disabled={!canClick}
                                        onClick={this.actions.onCancelBedTemperature}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}
                <Anchor className="sm-parameter-header" onClick={actions.toggleOverridesSection}>
                    <span className="fa fa-gear sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Overrides')}</span>
                    <span className={classNames(
                        'fa',
                        overridesSectionExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {overridesSectionExpanded && (
                    <Overrides
                        ovF={ovF}
                        ovS={ovS}
                        actions={actions}
                    />
                )}
                <MachineModal
                    headType={headType}
                    controllerState={controllerState}
                    expanded={machineModalSectionExpanded}
                    toggleMachineModalSection={actions.toggleMachineModalSection}
                />
            </div>
        );
    }
}

export default Printing;
