import PropTypes from 'prop-types';
import React from 'react';


const StatusPad = (props) => {
    const { state, actions } = props;
    const controllerState = state.controller.state;
    return (
        <div>
            <div className="row" style={{ marginBottom: 10 }}>
                <div className="col-xs-6">
                    <div>Jog Speed(G0)</div>
                    <div>{ controllerState.jogSpeed }</div>
                </div>
                <div className="col-xs-6">
                    <div>Work Speed(G1)</div>
                    <div>{ controllerState.workSpeed }</div>
                </div>
            </div>
            { actions.is3DPrinting() &&
                <div className="row" style={{ marginBottom: 10 }}>
                    <div className="col-xs-6">
                        <div>Nozzle Temperature</div>
                        <div>{ controllerState.temperature.t }</div>
                    </div>
                    <div className="col-xs-6">
                        <div>Bed Temperature</div>
                        <div>{ controllerState.temperature.b }</div>
                    </div>
                </div>
            }
            <div className="row" style={{ marginBottom: 10 }}>
                <div className="col-xs-6">
                    <div>ToolHead Status(M3)</div>
                    <div>{ controllerState.headStatus }</div>
                </div>
                <div className="col-xs-6">
                    <div>ToolHead Power</div>
                    <div>{ controllerState.headPower }</div>
                </div>
            </div>

        </div>
    );
};

StatusPad.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default StatusPad;
