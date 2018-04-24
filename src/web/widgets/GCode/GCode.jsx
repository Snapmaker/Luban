import React from 'react';
import PropTypes from 'prop-types';
import GCodeStats from './GCodeStats';

const GCode = (props) => (
    <GCodeStats {...props} />
);

GCode.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default GCode;
