import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import styles from './styles.styl';

class TextInput extends PureComponent {
    static propTypes = {
        className: PropTypes.string
    };

    render() {
        const { className = '', ...rest } = this.props;

        return (
            <input
                {...rest}
                type="text"
                className={classNames(styles.input, className)}
            />
        );
    }
}

export default TextInput;
