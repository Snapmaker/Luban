import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import Overrides from './Overrides';
import StatusPad from './StatusPad';
import LaserPad from './LaserPad';


const Laser = (props) => {
    const { state, actions } = props;
    const controllerState = state.controller.state || {};
    const ovF = get(controllerState, 'ovF', 0);
    const ovS = get(controllerState, 'ovS', 0);

    const isDetected = actions.isLaser();
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

Laser.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Laser;
