import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import Overrides from './Overrides';
import StatusPad from './StatusPad';
import LaserPad from './LaserPad';


const Marlin = (props) => {
    const { state, actions } = props;
    const controllerState = state.controller.state || {};
    const ovF = get(controllerState, 'ovF', 0);
    const ovS = get(controllerState, 'ovS', 0);

    const isDetected = actions.is3DPrinting() || actions.isLaser() || actions.isCNC();
    if (!isDetected) {
        return null;
    }

    return (
        <div>
            <StatusPad state={state} actions={actions} />
            <Overrides ovF={ovF} ovS={ovS} actions={actions} />

            {actions.isLaser() && <LaserPad />}
        </div>
    );
};

Marlin.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Marlin;
