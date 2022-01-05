import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CustomPicker } from 'react-color';

const ColorSelectorWrapper = React.memo(({ className = '', hollow = false, ...rest }) => {
    return (
        <CustomPicker
            {...rest}
            className={classNames(className)}
        />
    );
});

ColorSelectorWrapper.propTypes = {
    className: PropTypes.string
};

export default ColorSelectorWrapper;
