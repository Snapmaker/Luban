import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import styles from './styles.styl';


class DegreeInput extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        value: PropTypes.number.isRequired,
        defaultValue: PropTypes.string,
        onChange: PropTypes.func,
        suffix: PropTypes.string
    };

    constructor(props) {
        super(props);
        this.state = {
            isEdit: false,
            value: props.value
        };
    }

    componentWillReceiveProps(nextProps) {
        this.setState({
            value: nextProps.value.toString()
        });
    }

    onChange = (event) => {
        this.setState({
            value: event.target.value
        });
    };

    onBlur = (event) => {
        const { onChange } = this.props;
        onChange && onChange(this.getStanderValue(event.target.value));
        this.setState({
            isEdit: false
        });
    };

    onKeyUp = (event) => {
        // Pressed carriage return (CR or '\r')
        if (event.keyCode === 13) {
            const { onChange } = this.props;
            onChange && onChange(this.getStanderValue(event.target.value));
        }
    };

    onFocus = () => {
        this.setState({
            isEdit: true
        });
    }

    getStanderValue(value) {
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
        const { className = '', ...rest } = this.props;
        const { value, isEdit } = this.state;
        const displayValue = isEdit ? value : value.toString().concat(this.props.suffix);

        return (
            <input
                {...rest}
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
