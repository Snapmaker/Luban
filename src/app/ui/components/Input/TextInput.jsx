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
        const { className = '', size = 'middle', ...rest } = this.props;

        return (
            <span
                style={{ width: size }}
                className={classNames('display-inline', styles[size], className)}
            >
                <Input
                    {...rest}
                    type="text"
                    className={classNames(styles.input)}
                />
            </span>
        );
    }
}

export default TextInput;
