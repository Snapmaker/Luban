// import { Checkbox } from 'antd';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Checkbox } from 'antd';

import styles from './styles.styl';

class CheckboxWrapper extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        hollow: PropTypes.bool
    };

    render() {
        const { className = '', hollow = false, ...rest } = this.props;

        return (
            <Checkbox
                {...rest}
                className={classNames(styles.checkbox, className, hollow && styles.hollow)}
            />
        );
    }
}

export default CheckboxWrapper;
