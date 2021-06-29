// import { Checkbox } from 'antd';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Checkbox } from 'antd';

import styles from './styles.styl';

class CheckboxWrapper extends PureComponent {
    static propTypes = {
        className: PropTypes.string
    };

    render() {
        const { className = '', ...rest } = this.props;

        return (
            <Checkbox
                {...rest}
                className={classNames(styles.checkbox, className)}
            />
        );
    }
}

export default CheckboxWrapper;
