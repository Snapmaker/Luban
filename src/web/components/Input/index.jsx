import _ from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';


export class InputWithValidation extends PureComponent {
    static propTypes = {
        value: PropTypes.oneOfType([PropTypes.number.isRequired, PropTypes.string.isRequired]),
        min: PropTypes.number,
        max: PropTypes.number,
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
        if (isNaN(value)) {
            return false;
        }

        const { min, max } = props;
        return (min === undefined || value >= min)
            && (max === undefined || value <= max);
    }

    componentWillReceiveProps(nextProps) {
        if (_.isEqual(nextProps, this.props)) {
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
        const { style, ...rest } = this.props;

        // dirty implementation, use class will be better
        const defaultStyle = {
            borderRadius: 0,
            display: 'inline'
        };
        const newStyle = {
            ...defaultStyle,
            ...style,
            border: this.state.isValid ? '' : '2px solid #C00000'
        };

        return (
            <input
                {...rest}
                type="number"
                className="form-control"
                style={newStyle}
                value={this.state.value}
                onChange={this.onChange}
            />
        );
    }
}
