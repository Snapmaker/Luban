import React from 'react';
import PropTypes from 'prop-types';
import DisplayPanel from './DisplayPanel';
import ControlPanel from './ControlPanel';

const Axes = React.memo((props) => {
    const { state, actions } = props;
    return (
        <div>
            <DisplayPanel state={state} actions={actions} />
            <ControlPanel state={state} actions={actions} />
        </div>
    );
});

Axes.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Axes;
