import { debounce } from 'lodash';
import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Input } from 'antd';
import styles from './styles.styl';

const { TextArea } = Input;

const TextAreaInput = React.memo(({
    className = '', value, defaultValue, disabled = false, onChange, ...rest
}) => {
    const [displayValue, setDisplayValue] = useState(value);
    function onInsideChange(event) {
        if (displayValue !== event.target.value) {
            setDisplayValue(event.target.value);
            console.log('d', setDisplayValue);
        }
    }
    const changeHandler = (newValue) => {
        onChange(newValue);
    };
    const debouncedChangeHandler = useCallback(
        debounce(changeHandler, 400),
        []
    );

    useEffect(() => {
        if (displayValue.trim() !== value.trim()) {
            onChange && debouncedChangeHandler(displayValue);
        }
    }, [displayValue, onChange]);

    return (
        <span
            className={classNames(styles['override-textArea'], className)}
        >
            <TextArea
                {...rest}
                disabled={disabled}
                allowClear
                // showCount
                autoSize={{ minRows: 4, maxRows: 6 }}
                className={classNames(styles.textarea)}
                value={displayValue}
                onChange={onInsideChange}
            />
        </span>
    );
});

TextAreaInput.propTypes = {
    className: PropTypes.string,
    value: PropTypes.string,
    defaultValue: PropTypes.string,
    disabled: PropTypes.bool,
    onChange: PropTypes.func
};

export default TextAreaInput;
