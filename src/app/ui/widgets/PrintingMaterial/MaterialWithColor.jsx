import React from 'react';
import PropTypes from 'prop-types';

export const MaterialWithColor = ({ name, color }) => {
    return (
        <div className="sm-flex align-center justify-space-between">
            <span>{name}</span>
            <div className={`width-16 height-16 material-background-${color?.toLowerCase()}`} />
        </div>
    );
};
MaterialWithColor.propTypes = {
    name: PropTypes.string,
    color: PropTypes.string
};
