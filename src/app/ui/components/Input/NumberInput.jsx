import React, { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Input } from 'antd';
import log from '../../../lib/log';
import styles from './styles.styl';

const maxDecimal = (number, decimalPlaces) => {
    const reg = new RegExp(`^(.*\\..{${decimalPlaces}}).*$`);
    return Number(String(number).replace(reg, '$1'));
};


const NumberInput = ({
    className = '', size = 'middle', value, defaultValue, disabled = false, min, max, onChange, placeholder, allowUndefined, decimalPlaces, ...rest
}) => {
    const [displayValue, setDisplayValue] = useState(value);
    const ref = useRef();
    function onInsideChange(event) {
        const v = decimalPlaces === undefined ? event.target.value : maxDecimal(event.target.value, decimalPlaces);
        if (displayValue !== v) {
            setDisplayValue(v);
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
    }, [value]);

    return (
        <span
            className={classNames('display-inline', className)}
        >
            <Input
                ref={ref}
                type="number"
                disabled={disabled}
                placeholder={placeholder || 'Input a Number'}
                className={classNames(styles.input, styles[size])}
                value={displayValue}
                onChange={onInsideChange}
                onBlur={onBlur}
                onKeyUp={onKeyUp}
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
    decimalPlaces: PropTypes.number
};

export default NumberInput;
