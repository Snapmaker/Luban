import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// import log from '../../lib/log';
import styles from './styles.styl';


class DegreeInput extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        value: PropTypes.string.isRequired,
        defaultValue: PropTypes.string,
        onChange: PropTypes.func,
        suffix: PropTypes.string
    };

    constructor(props) {
        super(props);

        this.state = {
            isFocus: false,
            displayValue: props.value.concat(props.suffix)
        };
    }

    componentWillReceiveProps(nextProps) {
        this.setState({
            displayValue: nextProps.value
        });
    }

    onChange = (event) => {
        this.setState({
            displayValue: event.target.value
        });
    };

    onBlur = (event) => {
        this.setState({
            isFocus: false
        });
        this.onAfterChangeWrapper(event.target.value);
    };

    onKeyUp = (event) => {
        // Pressed carriage return (CR or '\r')
        if (event.keyCode === 13) {
            this.onAfterChangeWrapper(event.target.value);
        }
    };

    onFocus = (event) => {
        this.setState({
            isFocus: true
        });
        const v = event.target.value;
        const suffix = this.props.suffix;
        if (v.substr(v.length - suffix.length, suffix.length) === suffix) {
            this.setState({
                displayValue: v.substr(0, v.length - 1)
            });
        }
    }

    onAfterChangeWrapper(value) {
        const { onChange } = this.props;

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
            onChange(absentValue);
            this.setState({
                displayValue: absentValue.toString().concat(this.props.suffix)
            });
            return;
        }
        this.setState({
            displayValue: numericValue.toString().concat(this.props.suffix)
        });

        onChange && onChange(numericValue);
    }

    getValue = () => {
        return (!this.state.isFocus ? (this.state.displayValue.concat(this.props.suffix)) : this.state.displayValue);
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

        return (
            <input
                {...rest}
                suffix={this.props.suffix}
                type="text"
                value={this.getValue()}
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
