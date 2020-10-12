import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import styles from './styles.styl';


class DegreeInput extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        disabled: PropTypes.bool.isRequired,
        value: PropTypes.number.isRequired,
        onChange: PropTypes.func.isRequired,
        suffix: PropTypes.string
    };

    static defaultProps = {
        suffix: '°'
    };

    ref = React.createRef();

    constructor(props) {
        super(props);
        this.state = {
            value: props.value.toString().concat(this.props.suffix)
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.value !== this.state.value) {
            this.setState({
                value: nextProps.value.toString().concat(this.props.suffix)
            });
        }
    }

    onChangeInputValue = (event) => {
        this.setState({
            value: event.target.value
        });
    };

    onBlur = (event) => {
        const { onChange } = this.props;
        const standardValue = this.getStandardValue(event.target.value);

        this.setState({
            value: standardValue.toString().concat(this.props.suffix)
        });

        onChange && onChange(standardValue);
    };

    onKeyUp = (event) => {
        // Pressed carriage return (CR or '\r')
        if (event.keyCode === 13) {
            const { onChange } = this.props;
            const standardValue = this.getStandardValue(event.target.value);

            this.setState({
                value: standardValue.toString().concat(this.props.suffix)
            });

            onChange && onChange(standardValue);

            this.ref.current.blur();
        }
    };

    onFocus = () => {
        const standardValue = this.getStandardValue(this.state.value);
        this.setState({
            value: standardValue
        });
    };

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
        const { className = '', ...rest } = this.props;
        const { value } = this.state;

        return (
            <input
                {...rest}
                ref={this.ref}
                type="text"
                value={value}
                className={classNames(styles.input, className)}
                onChange={this.onChangeInputValue}
                onBlur={this.onBlur}
                onKeyUp={this.onKeyUp}
                onFocus={this.onFocus}
            />
        );
    }
}

export default DegreeInput;
