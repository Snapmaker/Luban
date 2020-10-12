import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import styles from './styles.styl';


class DegreeInput extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        disabled: PropTypes.bool,
        value: PropTypes.number.isRequired,
        defaultValue: PropTypes.string,
        changeModelValue: PropTypes.func,
        suffix: PropTypes.string
    };

    constructor(props) {
        super(props);
        this.state = {
            value: props.value,
            displayValue: props.value.toString().concat(this.props.suffix)
        };
    }

    componentWillReceiveProps(nextProps) {
        this.setState({
            displayValue: nextProps.value.toString().concat(this.props.suffix),
            value: nextProps.value
        });
    }

    onChange = (event) => {
        this.setState({
            value: this.getStandardValue(event.target.value),
            displayValue: event.target.value
        });
    };

    onBlur = (event) => {
        const { changeModelValue } = this.props;
        changeModelValue && changeModelValue(this.getStandardValue(event.target.value));
        this.setState({
            displayValue: this.state.value.toString().concat(this.props.suffix)
        });
    };

    onKeyUp = (event) => {
        // Pressed carriage return (CR or '\r')
        if (event.keyCode === 13) {
            const { changeModelValue } = this.props;
            const standardValue = this.getStandardValue(event.target.value);
            changeModelValue && changeModelValue(standardValue);
            this.setState({
                displayValue: standardValue.toString()
            });
        }
    };

    onFocus = () => {
        this.setState({
            displayValue: this.state.value.toString()
        });
    }

    getStandardValue(value) {
        let numericValue = parseFloat(value) % 360;
        if (numericValue > 180) {
            numericValue -= 360;
        }
        if (numericValue < -180) {
            numericValue += 360;
        }
        // If value is invalid, use defaultValue
        if (Number.isNaN(numericValue)) {
            const absentValue = this.getAbsentValue();
            return absentValue;
        }
        return numericValue;
    }

    getAbsentValue() {
        if (this.props.defaultValue !== undefined) {
            return this.props.defaultValue;
        } else {
            return 0;
        }
    }

    render() {
        const { className = '', disabled = false } = this.props;
        const { displayValue } = this.state;

        return (
            <input
                disabled={disabled}
                suffix={this.props.suffix}
                type="text"
                value={displayValue}
                className={classNames(styles.input, className)}
                onChange={this.onChange}
                onBlur={this.onBlur}
                onKeyUp={this.onKeyUp}
                onFocus={this.onFocus}
            />
        );
    }
}

export default DegreeInput;
