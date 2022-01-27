import React from 'react';
import PropTypes from 'prop-types';

export const MaterialWithColor = ({ name, color }) => {
    return (
        <div className="sm-flex align-center justify-space-between">
            <span className="text-overflow-ellipsis" style={{ maxWidth: 'calc(100% - 16px)' }}>{name}</span>
            {color && (
                <div
                    className="width-16 height-16"
                    style={{
                        backgroundColor: color,
                        border: '1px solid #B9BCBF',
                        borderRadius: '4px'
                    }}
                />
            )}
        </div>
    );
};
MaterialWithColor.propTypes = {
    name: PropTypes.string,
    color: PropTypes.string
};
