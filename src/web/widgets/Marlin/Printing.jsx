import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import Controller from './Controller';
import Overrides from './Overrides';
import StatusPad from './StatusPad';

import { MODAL_CONTROLLER } from './constants';

const Printing = (props) => {
    const { state, actions } = props;
    const controllerState = state.controller.state || {};
    const ovF = get(controllerState, 'ovF', 0);
    const ovS = get(controllerState, 'ovS', 0);

    const isDetected = actions.is3DPrinting();
    if (!isDetected) {
        return null;
    }

    return (
        <div>
            {state.modal.name === MODAL_CONTROLLER &&
            <Controller state={state} actions={actions} />
            }
            <StatusPad state={state} actions={actions} />
            <Overrides ovF={ovF} ovS={ovS} actions={actions} />
        </div>
    );
};

Printing.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Printing;
