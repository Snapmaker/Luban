import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Input } from 'antd';
import styles from './styles.styl';

const { TextArea } = Input;

class TextAreaInput extends PureComponent {
    static propTypes = {
        className: PropTypes.string
    };

    render() {
        const { className = '', ...rest } = this.props;

        return (
            <div
                className={classNames(styles['override-textArea'], className)}
            >
                <TextArea
                    {...rest}
                    className={classNames(styles.textarea)}
                />
            </div>
        );
    }
}

export default TextAreaInput;
