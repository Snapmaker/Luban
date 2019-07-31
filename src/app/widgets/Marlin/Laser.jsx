import get from 'lodash/get';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';

import Overrides from './Overrides';
import LaserPad from './LaserPad';
import MachineModal from './MachineModal';
import styles from '../styles.styl';


class Laser extends PureComponent {
    static propTypes = {
        headType: PropTypes.string,
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        const { headType, state, actions } = this.props;
        const { statusSectionExpanded, powerSectionExpanded, overridesSectionExpanded, machineModalSectionExpanded } = state;
        const controllerState = state.controller.state;
        const ovF = get(controllerState, 'ovF', 0);
        const ovS = get(controllerState, 'ovS', 0);

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
                <Anchor className="sm-parameter-header" onClick={actions.togglePowerSection}>
                    <span className="fa fa-gear sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Power')}</span>
                    <span className={classNames(
                        'fa',
                        powerSectionExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {powerSectionExpanded && (
                    <LaserPad state={state} />
                )}
                <Anchor className="sm-parameter-header" onClick={actions.toggleOverridesSection}>
                    <span className="fa fa-gear sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Overrides')}</span>
                    <span className={classNames(
                        'fa',
                        powerSectionExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
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


export default Laser;
