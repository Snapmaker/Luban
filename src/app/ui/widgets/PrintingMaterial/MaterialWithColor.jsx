import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import styles from './styles.styl';

export const MaterialWithColor = ({ name, color }) => {
    return (
        <div className="sm-flex align-center justify-space-between">
            <span className={classNames('text-overflow-ellipsis', styles.text)}>{name}</span>
            {color && (
                <div
                    className="width-16 height-16 margin-right-8"
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
