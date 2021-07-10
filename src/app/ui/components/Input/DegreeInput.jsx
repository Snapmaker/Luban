import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Input } from 'antd';
import styles from './styles.styl';


class DegreeInput extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        size: PropTypes.string,
        disabled: PropTypes.bool.isRequired,
        value: PropTypes.number.isRequired,
        onChange: PropTypes.func.isRequired,
        suffix: PropTypes.string
    };

    static defaultProps = {
        suffix: '°'
    };

    ref = React.createRef();

    state = {
        // the value is a string being displayed in <input> label
        value: ''
    };

    constructor(props) {
        super(props);
        this.state = {
            value: this.getNumberWithSuffix(props.value)
        };
    }

    componentWillReceiveProps(nextProps) {
        // new value passed in
        if (nextProps.value !== this.state.value) {
            this.setState({
                value: this.getNumberWithSuffix(nextProps.value)
            });
        }
    }

    onChangeInputValue = (event) => {
        this.setState({
            value: event.target.value
        });
    };

    onFocus = () => {
        // Remove suffix from displayed value
        const standardValue = this.getStandardValue(this.state.value);

        this.setState({
            value: standardValue
        });
    };

    /**
     *
     * @param event
     */
    onBlur = (event) => {
        const { onChange } = this.props;
        const standardValue = this.getStandardValue(event.target.value);

        this.setState({
            value: this.getNumberWithSuffix(standardValue)
        });

        onChange && onChange(standardValue);
    };

    onKeyUp = (event) => {
        // Pressed carriage return (CR or '\r')
        if (event.keyCode === 13) {
            // trigger onBlur manually
            this.ref.current.blur();
        }
    };

    /**
     * Return number + suffix, to be displayed in input label.
     *
     * @param {Number} num
     * @returns {string}
     */
    getNumberWithSuffix(num) {
        return num.toString();
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
            return 0;
        }
        return numericValue;
    }

    render() {
        const { className = '', size = 'middle', ...rest } = this.props;
        const { value } = this.state;

        return (
            <span className={classNames('display-inline', styles[size], className)}>
                <Input
                    {...rest}
                    ref={this.ref}
                    type="text"
                    value={value}
                    className={classNames(styles.input)}
                    onChange={this.onChangeInputValue}
                    onBlur={this.onBlur}
                    onKeyUp={this.onKeyUp}
                    onFocus={this.onFocus}
                />
            </span>
        );
    }
}

export default DegreeInput;
