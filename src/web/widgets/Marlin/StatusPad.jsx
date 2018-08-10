import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';


const StatusPad = (props) => {
    const { state, actions } = props;
    const controllerState = state.controller.state;
    const headStatus = controllerState.headStatus;
    return (
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
            { actions.is3DPrinting() &&
                <div className="row" style={{ marginBottom: 10 }}>
                    <div className="col-xs-6">
                        <div>{i18n._('Nozzle Temperature')}</div>
                        <div>{ controllerState.temperature.t }</div>
                    </div>
                    <div className="col-xs-6">
                        <div>{i18n._('Bed Temperature')}</div>
                        <div>{ controllerState.temperature.b }</div>
                    </div>
                </div>
            }
            { (actions.isLaser() || actions.isCNC()) &&
                <div className="row" style={{ marginBottom: 10 }}>
                    {actions.isLaser() &&
                        <div className="col-xs-6">
                            <div>{i18n._('Tool Head Power')}</div>
                            <div>{ controllerState.headPower }%</div>
                        </div>
                    }
                    <div className="col-xs-6">
                        <div>{i18n._('Tool Head Status (M3)')}</div>
                        <div>
                            {headStatus === 'on' &&
                            <button
                                type="button"
                                className="btn btn-warning"
                                onClick={() => actions.toggleToolHead()}
                            >
                                <i className="fa fa-toggle-on fa-fw" />
                                <span className="space space-sm" />
                                {i18n._('ON')}
                            </button>
                            }
                            {headStatus === 'off' &&
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => actions.toggleToolHead()}
                            >
                                <i className="fa fa-toggle-off fa-fw" />
                                <span className="space space-sm" />
                                {i18n._('OFF')}
                            </button>
                            }
                        </div>
                    </div>
                </div>
            }

        </div>
    );
};

StatusPad.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default StatusPad;
