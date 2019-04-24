import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import i18n from '../../lib/i18n';
import Overrides from './Overrides';
import LaserPad from './LaserPad';
import styles from '../styles.styl';

import OptionalDropdown from '../../components/OptionalDropdown';

const Laser = (props) => {
    const { state, actions } = props;
    const { statusPadEnabled, powerControlEnabled, overridesEnabled } = state;
    const controllerState = state.controller.state;
    const ovF = get(controllerState, 'ovF', 0);
    const ovS = get(controllerState, 'ovS', 0);

    return (
        <div>
            {statusPadEnabled !== null && (
                <OptionalDropdown
                    style={{ margin: '10px 0' }}
                    title={i18n._('Status Pad')}
                    onClick={actions.onStatusPadEnabled}
                    hidden={!statusPadEnabled}
                >
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
                </OptionalDropdown>
            )}
            {powerControlEnabled !== null && (
                <OptionalDropdown
                    style={{ marginTop: '10px' }}
                    title={i18n._('Power')}
                    onClick={actions.onPowerControlEnabled}
                    hidden={!powerControlEnabled}
                >
                    <LaserPad state={state} />
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

Laser.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Laser;
