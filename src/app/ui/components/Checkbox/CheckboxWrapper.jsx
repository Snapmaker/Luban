// import { Checkbox } from 'antd';
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Checkbox } from 'antd';

import styles from './styles.styl';

const CheckboxWrapper = React.memo(({ className = '', hollow = false, ...rest }) => {
    return (
        <Checkbox
            {...rest}
            className={classNames(styles.checkbox, className, hollow && styles.hollow)}
        />
    );
});

CheckboxWrapper.propTypes = {
    className: PropTypes.string,
    hollow: PropTypes.bool,
    defaultChecked: PropTypes.bool,
};
export default CheckboxWrapper;
