import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import styles from './index.styl';
import i18n from '../../lib/i18n';
import RepeatButton from '../../components/RepeatButton';

class JogDistance extends PureComponent {
    static propTypes = {
        marks: PropTypes.array.isRequired,
        units: PropTypes.string,
        needCustom: PropTypes.bool,
        customValue: PropTypes.number,
        defaultValue: PropTypes.number,
        value: PropTypes.string,
        min: PropTypes.number,
        max: PropTypes.number,
        step: PropTypes.number,

        onChange: PropTypes.func
    };


    state = {
        value: this.props.value || this.props.defaultValue || this.props.marks[0],
        isCustom: false,
        customValue: this.props.customValue || this.props.marks[0],
        max: this.props.max || _.max(this.props.marks),
        min: this.props.min || _.min(this.props.marks),
        step: this.props.step || 1
    };

    actions = {
        selectDistance: (value) => {
            this.setState({
                value: value
            });
            this.setState({
                isCustom: false
            });
            this.actions.onChange(value);
        },
        selectCustom: () => {
            this.setState({
                isCustom: true
            });
            this.actions.onChange(this.state.customValue);
        },
        onChangeCustomValue: (value) => {
            this.setState({
                customValue: value
            });
            this.actions.onChange(value);
        },
        increaseCustomDistance: () => {
            const value = Math.min(this.state.customValue + this.state.step, this.state.max);
            this.setState({
                customValue: value
            });
            this.actions.onChange(value);
        },
        decreaseCustomDistance: () => {
            const value = Math.max(this.state.customValue - this.state.step, this.state.min);
            this.setState({
                customValue: value
            });
            this.actions.onChange(value);
        },
        onChange: (value) => {
            if (!this.props.onChange) {
                return;
            }
            this.props.onChange(value);
        }
    };


    render() {
        const { marks, units, needCustom } = this.props;
        const actions = this.actions;
        const { value, customValue, isCustom, min, max, step } = this.state;

        return (
            <div className={styles.jogDistanceControl}>
                <div className="input-group input-group-sm">
                    <div className="input-group-btn">
                        {marks.map(v => {
                            return (
                                <button
                                    key={v}
                                    type="button"
                                    className={classNames('btn', 'btn-default', {
                                        'btn-select': !isCustom && v === value
                                    })}
                                    title={`${v} ${units}`}
                                    onClick={() => actions.selectDistance(v)}
                                >
                                    {v}
                                </button>
                            );
                        })}
                        {needCustom && (
                            <button
                                type="button"
                                className={classNames('btn', 'btn-default', {
                                    'btn-select': isCustom
                                })}
                                title={i18n._('User Defined')}
                                onClick={() => actions.selectCustom()}
                            >
                                <i className="fa fa-adjust" />
                            </button>
                        )}
                    </div>
                    {needCustom && (
                        <input
                            type="number"
                            className="form-control"
                            style={{ borderRadius: 0 }}
                            min={min}
                            max={max}
                            step={step}
                            value={customValue}
                            onChange={(event) => {
                                actions.onChangeCustomValue(event.target.value);
                            }}
                            title={i18n._('Custom distance for every move operation')}
                        />
                    )}
                    {needCustom && (
                        <div className="input-group-btn">
                            <RepeatButton
                                className="btn btn-default"
                                onClick={actions.increaseCustomDistance}
                                title={i18n._('Increase custom distance by one unit')}
                            >
                                <i className="fa fa-plus" />
                            </RepeatButton>
                            <RepeatButton
                                className="btn btn-default"
                                onClick={actions.decreaseCustomDistance}
                                title={i18n._('Decrease custom distance by one unit')}
                            >
                                <i className="fa fa-minus" />
                            </RepeatButton>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

export default JogDistance;
