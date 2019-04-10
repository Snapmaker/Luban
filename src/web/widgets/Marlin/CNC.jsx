import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import i18n from '../../lib/i18n';
import Controller from './Controller';
import Overrides from './Overrides';
import OptionalDropdown from '../../components/OptionalDropdown';
import { MODAL_CONTROLLER } from './constants';

const CNC = (props) => {
    const { state, actions } = props;
    const { statusPadEnabled, overridesEnabled } = state;
    const controllerState = state.controller.state;
    const headStatus = controllerState.headStatus;
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
                </OptionalDropdown>
            )}
            <div className="row" style={{ marginBottom: 10 }}>
                <div className="col-xs-6">
                    <div>{i18n._('Tool Head Status (M3)')}</div>
                    <div>
                        {headStatus === 'on' && (
                            <button
                                type="button"
                                className="btn btn-warning"
                                onClick={() => actions.toggleToolHead()}
                            >
                                <i className="fa fa-toggle-on fa-fw" />
                                <span className="space space-sm" />
                                {i18n._('ON')}
                            </button>
                        )}
                        {headStatus === 'off' && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => actions.toggleToolHead()}
                            >
                                <i className="fa fa-toggle-off fa-fw" />
                                <span className="space space-sm" />
                                {i18n._('OFF')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
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
