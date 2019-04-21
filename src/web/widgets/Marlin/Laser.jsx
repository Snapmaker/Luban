import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import i18n from '../../lib/i18n';
import Overrides from './Overrides';
import LaserPad from './LaserPad';

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
                    style={{ marginTop: '10px' }}
                    title={i18n._('Status Pad')}
                    onClick={actions.onStatusPadEnabled}
                    hidden={!statusPadEnabled}
                >
                    <div className="row" style={{ margin: '0 0 10px 0' }}>
                        <div className="col-xs-6">
                            <div>{i18n._('Jog Speed')} (G0)</div>
                            <div>{ controllerState.jogSpeed }</div>
                        </div>
                        <div className="col-xs-6">
                            <div>{i18n._('Work Speed')} (G1)</div>
                            <div>{ controllerState.workSpeed }</div>
                        </div>
                    </div>
                </OptionalDropdown>
            )}
            {powerControlEnabled !== null && (
                <OptionalDropdown
                    style={{ marginTop: '10px' }}
                    title={i18n._('Power')}
                    onClick={actions.onPowerControlEnabled}
                    hidden={!powerControlEnabled}
                >
                    <LaserPad
                        state={state}
                        actions={actions}
                    />
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
