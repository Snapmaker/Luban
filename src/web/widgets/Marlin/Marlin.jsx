import get from 'lodash/get';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Controller from './Controller';
import Overrides from './Overrides';
import {
    MODAL_CONTROLLER
} from './constants';

class Marlin extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        const { state, actions } = this.props;
        const controllerState = state.controller.state || {};
        const ovF = get(controllerState, 'ovF', 0);
        const ovS = get(controllerState, 'ovS', 0);

        return (
            <div>
                {state.modal.name === MODAL_CONTROLLER &&
                <Controller state={state} actions={actions} />
                }
                <Overrides ovF={ovF} ovS={ovS} />
            </div>
        );
    }
}

export default Marlin;
