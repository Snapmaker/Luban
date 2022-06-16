import PropTypes from 'prop-types';
import { InputNumber } from 'antd';
import React, { useRef, useState, useEffect } from 'react';
import styles from './styles.styl';

const Stepper = (props) => {
    const { size = 'small', value, onChange, step = 1, addonAfter = 'mm', ...rest } = props;
    const [displayValue, setDisplayValue] = useState(value);
    const ref = useRef();
    // TODO: float
    function getStepValue(originValue, eachStep) {
        return step * Math.round(originValue / eachStep);
    }

    function handleMouseDown(event) {
        const clientX = event.clientX;
        ref.current.onmousemove = function (e) {
            const changedValueWithStep = getStepValue((e.clientX - clientX) / 20, step);
            setDisplayValue(displayValue + changedValueWithStep);
        };
    }
    function handleMouseOut() {
        ref.current.onmousemove = null;
    }
    function onInsideChange(insideChange) {
        if (displayValue !== insideChange) {
            setDisplayValue(insideChange);
        }
    }
    function onAfterChangeWrapper(changedValue) {
        const numericValue = parseFloat(changedValue);
        if (onChange && value !== numericValue) {
            onChange(numericValue);
        }
    }

    const onBlur = (event) => {
        onAfterChangeWrapper(event.target.value);
    };

    const onKeyUp = (event) => {
        // Pressed carriage return (CR or '\r')
        if (event.keyCode === 13 || event.keyCode === 27) {
            event.target.blur();
        }
    };
    // const onFocus = () => {
    //     ref.current.select();
    // };

    useEffect(() => {
        setDisplayValue(value);
    }, [value]);
    if (typeof displayValue === 'number') {
        return (
            <InputNumber
                ref={ref}
                className={styles[size]}
                step={step}
                value={displayValue}
                addonAfter={addonAfter}
                onMouseDown={handleMouseDown}
                onChange={onInsideChange}
                onBlur={onBlur}
                onKeyUp={onKeyUp}
                onMouseUp={handleMouseOut}
                onMouseOut={handleMouseOut}
                {...rest}
            />
        );
    } else {
        return null;
    }
};


Stepper.propTypes = {
    onChange: PropTypes.func,
    value: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string
    ]),
    addonAfter: PropTypes.string,
    step: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string
    ]),
    size: PropTypes.string,
};

export default Stepper;
