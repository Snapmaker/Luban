import { Radio } from 'antd';
import _ from 'lodash';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';

import i18n from '../../../lib/i18n';
import RepeatButton from '../../components/RepeatButton';

class JogDistance extends PureComponent {
    static propTypes = {
        marks: PropTypes.array.isRequired,
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
            if (value === 'custom') {
                this.actions.selectCustom();
            } else {
                this.setState({
                    value: value
                });
                this.setState({
                    isCustom: false
                });
                this.actions.onChange(value);
            }
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
        const { marks, needCustom = false } = this.props;
        const actions = this.actions;
        const { value, customValue, isCustom, min, max, step } = this.state;

        const radioValue = isCustom ? 'custom' : value;

        return (
            <div>
                <Radio.Group
                    size="small"
                    defaultValue={radioValue}
                    onChange={(e) => actions.selectDistance(e.target.value)}
                >
                    {
                        marks.map(v => {
                            return (
                                <Radio.Button value={v}>{v}</Radio.Button>
                            );
                        })
                    }
                    {
                        needCustom && (
                            <Radio.Button value="custom">
                                <i className="fa fa-adjust" />
                            </Radio.Button>
                        )
                    }
                </Radio.Group>
                {
                    needCustom && (
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
                            title={i18n._('key-unused-Custom distance for every move')}
                        />
                    )
                }
                {
                    needCustom && (
                        <div>
                            <RepeatButton
                                className="btn btn-outline-secondary"
                                onClick={actions.increaseCustomDistance}
                                title={i18n._('key-unused-Increase custom distance by one unit')}
                            >
                                <i className="fa fa-plus" />
                            </RepeatButton>
                            <RepeatButton
                                className="btn btn-outline-secondary"
                                onClick={actions.decreaseCustomDistance}
                                title={i18n._('key-unused-Decrease custom distance by one unit')}
                            >
                                <i className="fa fa-minus" />
                            </RepeatButton>
                        </div>
                    )
                }
            </div>
        );
    }
}

export default JogDistance;
