import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import i18n from '../../lib/i18n';
import Overrides from './Overrides';
import LaserPad from './LaserPad';


const Laser = (props) => {
    const { state, actions } = props;
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
                    {actions.isLaser() && (
                        <div className="col-xs-6">
                            <div>{i18n._('Tool Head Power')}</div>
                            <div>{ controllerState.headPower }%</div>
                        </div>
                    )}
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
            </div>
            <div className="row" style={{ marginBottom: 10 }}>
                <div className="col-xs-6">
                    <div>{i18n._('Tool Head Power')}</div>
                    <div>{ controllerState.headPower }%</div>
                </div>
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
            {actions.isLaser() && <LaserPad />}
        </div>
    );
};

Laser.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Laser;
