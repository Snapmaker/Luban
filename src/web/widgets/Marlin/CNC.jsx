import get from 'lodash/get';
import React from 'react';
import PropTypes from 'prop-types';

import i18n from '../../lib/i18n';
import Overrides from './Overrides';
import OptionalDropdown from '../../components/OptionalDropdown';
import styles from '../styles.styl';

const CNC = (props) => {
    const { state, actions } = props;
    const { statusPadEnabled, overridesEnabled } = state;
    const controllerState = state.controller.state;
    const headStatus = controllerState.headStatus;
    const ovF = get(controllerState, 'ovF', 0);
    const ovS = get(controllerState, 'ovS', 0);

    return (
        <div>
            {statusPadEnabled !== null && (
                <OptionalDropdown
                    style={{ marginTop: '10px' }}
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
                            <tr>
                                <td style={{ width: '50%', padding: '0 6px' }}>
                                    <div>{i18n._('Tool Head (M3)')}</div>
                                    <div>
                                        {headStatus === 'on' && (
                                            <button
                                                type="button"
                                                style={{ width: '80px' }}
                                                className="sm-btn-small sm-btn-primary"
                                                onClick={actions.toggleToolHead}
                                            >
                                                <i className="fa fa-toggle-on fa-fw" />
                                                <span className="space space-sm" />
                                                {i18n._('ON')}
                                            </button>
                                        )}
                                        {headStatus === 'off' && (
                                            <button
                                                type="button"
                                                style={{ width: '80px' }}
                                                className="sm-btn-small sm-btn-default"
                                                onClick={actions.toggleToolHead}
                                            >
                                                <i className="fa fa-toggle-off fa-fw" />
                                                <span className="space space-sm" />
                                                {i18n._('OFF')}
                                            </button>
                                        )}
                                    </div>
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

CNC.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default CNC;
