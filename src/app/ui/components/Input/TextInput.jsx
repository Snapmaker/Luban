import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Input } from 'antd';

import styles from './styles.styl';

class TextInput extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        size: PropTypes.string
    };

    render() {
        const { className = '', size = 'small', ...rest } = this.props;

        return (
            <Input
                {...rest}
                type="text"
                className={classNames(styles.input, styles[size], className)}
            />
        );
    }
}

export default TextInput;
