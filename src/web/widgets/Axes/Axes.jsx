import PropTypes from 'prop-types';
import React from 'react';
import Toolbar from './Toolbar';
import DisplayPanel from './DisplayPanel';
import ControlPanel from './ControlPanel';

const Axes = (props) => {
    const { state, actions } = props;
    // @fixme
    //state.canClick = true;
    return (
        <div>
            <Toolbar state={state} actions={actions} />
            <DisplayPanel state={state} actions={actions} />
            <ControlPanel state={state} actions={actions} />
        </div>
    );
};

Axes.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Axes;
