import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import log from '../../lib/log';
import styles from './styles.styl';

class NumberInput extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        value: PropTypes.number.isRequired,
        defaultValue: PropTypes.number,
        min: PropTypes.number,
        max: PropTypes.number,
        onChange: PropTypes.func
    };

    ref = React.createRef();

    constructor(props) {
        super(props);

        if (props.defaultValue !== undefined) {
            if (props.min !== undefined && props.defaultValue < props.min) {
                log.warn('.defaultValue should greater than or equal to .min');
            }
            if (props.max !== undefined && props.defaultValue > props.max) {
                log.warn('.defaultValue should less than or equal to .max');
            }
        }

        this.state = {
            displayValue: props.value
        };
    }

    componentWillReceiveProps(nextProps) {
        // If any of .min, .max changed, call .onAfterChangeWrapper once again
        // to check if value is valid.
        const checkKeys = ['min', 'max'];
        const changesMade = checkKeys.some(key => this.props[key] !== nextProps[key]);
        if (changesMade) {
            this.onAfterChangeWrapper(nextProps.value);
        }

        // Changes from outside also reflects on display
        if (nextProps.value !== this.props.value) {
            this.setState({
                displayValue: nextProps.value
            });
        }
    }

    onChange = (event) => {
        this.setState({
            displayValue: event.target.value
        });
    };

    onBlur = (event) => {
        this.onAfterChangeWrapper(event.target.value);
    };

    onKeyUp = (event) => {
        // Pressed carriage return (CR or '\r')
        if (event.keyCode === 13) {
            this.onAfterChangeWrapper(event.target.value);
        }
    };

    onFocus=() => {
        this.ref.current.select();
    };

    onAfterChangeWrapper(value) {
        const { min, max, onChange } = this.props;

        let numericValue = parseFloat(value);
        let useEdgeValue = false;

        // If value is invalid, use defaultValue
        if (Number.isNaN(numericValue)) {
            const absentValue = this.getAbsentValue();
            onChange(absentValue);
            this.onChange({ target: { value: absentValue } });
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
        useEdgeValue && this.setState({ displayValue: numericValue });

        // call onAfterChange to change value
        onChange && onChange(numericValue);
    }

    getAbsentValue() {
        if (this.props.defaultValue !== undefined) {
            return this.props.defaultValue;
        } else if (this.props.min !== undefined) {
            return this.props.min;
        } else {
            return 0;
        }
    }

    render() {
        const { className = '', ...rest } = this.props;

        return (
            <input
                ref={this.ref}
                {...rest}
                type="number"
                value={this.state.displayValue}
                className={classNames(styles.input, className)}
                onChange={this.onChange}
                onBlur={this.onBlur}
                onKeyUp={this.onKeyUp}
                onFocus={this.onFocus}
            />
        );
    }
}

export default NumberInput;
