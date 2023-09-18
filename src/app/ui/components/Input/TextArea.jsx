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

    useEffect(() => {
        setDisplayValue(value);
    }, [value]);

    const changeHandler = useCallback((newValue) => {
        onChange && onChange(newValue);
    }, [onChange]);

    const debouncedChangeHandler = useCallback(debounce(changeHandler, 400, { trailing: true }), [changeHandler]);

    // Synchronize input to display value
    const onInsideChange = useCallback((event) => {
        if (displayValue !== event.target.value) {
            setDisplayValue(event.target.value);

            // also trigger a debounced change handler
            const newValue = event.target.value.trim();
            debouncedChangeHandler(newValue);
        }
    }, [displayValue, debouncedChangeHandler]);

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
