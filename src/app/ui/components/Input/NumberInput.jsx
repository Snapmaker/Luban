import React, { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Input } from 'antd';
import log from '../../../lib/log';
import styles from './styles.styl';

const maxDecimal = (number, decimalPlaces) => {
    if (decimalPlaces === 0) {
        const value = Math.round(Number(number));
        return value;
    } else {
        const reg = new RegExp(`^(.*\\..{${decimalPlaces}}).*$`);
        return Number(String(number).replace(reg, '$1'));
    }
};

const NumberInput = (props) => {
    const {
        className = '', size = 'middle', value, defaultValue, disabled = false, min, max, onChange, placeholder, allowUndefined, decimalPlaces = 3, allowNaN, suffix, ...rest
    } = props;
    const [displayValue, setDisplayValue] = useState(!decimalPlaces ? value : maxDecimal(value, decimalPlaces));
    const ref = useRef();
    function onInsideChange(event) {
        if (displayValue !== event.target.value) {
            setDisplayValue(event.target.value);
        }
    }

    function getAbsentValue() {
        if (defaultValue !== undefined) {
            return defaultValue;
        } else if (min !== undefined) {
            return min;
        } else {
            return 0;
        }
    }

    function onAfterChangeWrapper(changedValue) {
        let numericValue = parseFloat(changedValue);
        let useEdgeValue = false;

        // If changedValue is invalid, use defaultValue
        if (Number.isNaN(numericValue) && !allowUndefined) {
            const absentValue = getAbsentValue();
            onChange && onChange(absentValue);
            onInsideChange({ target: { value: absentValue } });
            ref.current.blur();
            return;
        }

        // range check
        if (min !== undefined && numericValue < min) {
            numericValue = min;
            useEdgeValue = true;
        }
        if (max !== undefined && numericValue > max) {
            numericValue = max;
            useEdgeValue = true;
        }

        if (Number.isNaN(numericValue) && !allowNaN) {
            setDisplayValue(null);
            return;
        }
        // multiple .setState on edge values won't change props from outside, we
        // need to change display manually
        useEdgeValue && setDisplayValue(numericValue);
        // if (value !== numericValue) {
        //     setDisplayValue(value);
        // }
        // call onAfterChange to change value
        if (onChange && value !== numericValue) {
            setDisplayValue(numericValue);
            onChange(numericValue);
        }
        ref.current.blur();
    }


    const onBlur = (event) => {
        onAfterChangeWrapper(event.target.value);
    };

    const onKeyUp = (event) => {
        // Pressed carriage return (CR or '\r')
        if (event.keyCode === 13 || event.keyCode === 27) {
            // this.onAfterChangeWrapper(event.target.value);
            event.target.blur();
        }
    };


    useEffect(() => {
        if (defaultValue !== undefined) {
            if (min !== undefined && defaultValue < min) {
                log.warn('.defaultValue should greater than or equal to .min');
            }
            if (max !== undefined && defaultValue > max) {
                log.warn('.defaultValue should less than or equal to .max');
            }
        }
    }, [defaultValue, max, min]);

    useEffect(() => {
        setDisplayValue(value);
        // setDisplayValue(!decimalPlaces ? value : maxDecimal(value, decimalPlaces));
    }, [value]);

    return (
        <span
            className={classNames('display-inline', className)}
        >
            <Input
                ref={ref}
                type="number"
                disabled={disabled}
                placeholder={placeholder}
                className={classNames(styles.input, styles[size])}
                value={displayValue}
                onChange={onInsideChange}
                onBlur={onBlur}
                onKeyUp={onKeyUp}
                suffix={suffix}
                {...rest}
            />
        </span>
    );
};

NumberInput.propTypes = {
    className: PropTypes.string,
    size: PropTypes.string,
    value: PropTypes.number,
    defaultValue: PropTypes.number,
    disabled: PropTypes.bool,
    min: PropTypes.number,
    max: PropTypes.number,
    onChange: PropTypes.func,
    placeholder: PropTypes.string,
    allowUndefined: PropTypes.bool,
    decimalPlaces: PropTypes.number,
    allowNaN: PropTypes.bool,
    suffix: PropTypes.string
};

export default NumberInput;
