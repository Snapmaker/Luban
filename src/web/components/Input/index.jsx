import _ from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './styles.styl';


export class InputWithValidation extends PureComponent {
    static propTypes = {
        value: PropTypes.oneOfType([PropTypes.number.isRequired, PropTypes.string.isRequired]),
        min: PropTypes.number,
        max: PropTypes.number,
        validClassName: PropTypes.string,
        invalidClassName: PropTypes.string,
        onChange: PropTypes.func
    };

    state = this.getInitialState();

    getInitialState() {
        return {
            validatedValue: this.props.value,
            value: this.props.value,
            isValid: true
        };
    }

    static checkValue(props, value) {
        if (Number.isNaN(value)) {
            return false;
        }

        const { min, max } = props;
        return (min === undefined || value >= min)
            && (max === undefined || value <= max);
    }

    componentWillReceiveProps(nextProps) {
        let valueChanged = false;
        for (let key of ['value', 'validatedValue', 'min', 'max']) {
            if (!_.isEqual(nextProps[key], this.props[key])) {
                valueChanged = true;
                break;
            }
        }
        if (!valueChanged) {
            return;
        }
        const { onChange } = this.props;

        // 1. newly received validated value from outer scope
        if (nextProps.value !== this.state.validatedValue) {
            this.setState({
                value: nextProps.value,
                validatedValue: nextProps.value,
                isValid: true
            });
            return;
        }

        // 2. value unchanged, other props have changed, call validation again
        // to determine if current value is valid.
        const value = this.state.value;
        const isValid = this.constructor.checkValue(nextProps, value) && onChange(value);
        if (!isValid) {
            this.setState({ isValid: false });
        }
    }

    onChange = (event) => {
        const { onChange } = this.props;
        const value = parseFloat(event.target.value);

        const isValid = this.constructor.checkValue(this.props, value) && onChange(value);
        if (isValid) {
            this.setState({ value, isValid: true });
        } else {
            this.setState({ value: event.target.value, isValid: false });
        }
    };

    render() {
        const { validClassName, invalidClassName, ...rest } = this.props;

        const className = this.state.isValid
            ? (validClassName || styles.input)
            : (invalidClassName || classNames(styles.input, styles.invalid));

        return (
            <input
                {...rest}
                className={className}
                value={this.state.value}
                onChange={this.onChange}
            />
        );
    }
}
