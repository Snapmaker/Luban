import { Radio } from 'antd';
import _ from 'lodash';
import React, { useCallback, useState } from 'react';

import i18n from '../../../lib/i18n';
import RepeatButton from '../../components/RepeatButton';

interface JogDistanceProps {
    marks: number[];
    needCustom?: boolean;
    customValue?: number;
    defaultValue?: number;
    value?: string;
    min?: number;
    max?: number;
    step?: number;
    onChange?: (value: number) => void;
}

const JogDistance: React.FC<JogDistanceProps> = ({
    marks,
    needCustom = false,
    customValue,
    defaultValue,
    value,
    min,
    max,
    step,
    onChange,
}) => {
    const [state, setState] = useState({
        value: value || defaultValue || marks[0],
        isCustom: false,
        customValue: customValue || marks[0],
        max: max || _.max(marks) as number,
        min: min || _.min(marks) as number,
        step: step || 1,
    });

    const onChangeValue = useCallback((v: number) => {
        if (!onChange) {
            return;
        }
        onChange(v);
    }, [onChange]);

    const selectCustom = useCallback(() => {
        setState(prevState => ({ ...prevState, isCustom: true }));
        onChangeValue(state.customValue);
    }, [state.customValue, onChangeValue]);

    const onChangeCustomValue = useCallback((v: number) => {
        setState(prevState => ({ ...prevState, customValue: v }));
        onChangeValue(v);
    }, [onChangeValue]);

    const increaseCustomDistance = useCallback(() => {
        const v = Math.min(state.customValue + state.step, state.max);
        setState(prevState => ({ ...prevState, customValue: v }));
        onChangeValue(v);
    }, [state.customValue, state.step, state.max, onChangeValue]);

    const decreaseCustomDistance = useCallback(() => {
        const v = Math.max(state.customValue - state.step, state.min);
        setState(prevState => ({ ...prevState, customValue: v }));
        onChangeValue(v);
    }, [state.customValue, state.step, state.min, onChangeValue]);

    const selectDistance = useCallback((v: string) => {
        if (v === 'custom') {
            selectCustom();
        } else {
            setState(prevState => ({ ...prevState, value: v, isCustom: false }));
            onChangeValue(Number(v));
        }
    }, [onChangeValue, selectCustom]);

    const radioValue = state.isCustom ? 'custom' : state.value;

    return (
        <div>
            <Radio.Group
                size="small"
                defaultValue={radioValue}
                onChange={e => selectDistance(e.target.value)}
            >
                {marks.map(v => (
                    <Radio.Button value={`${v}`}>{v}</Radio.Button>
                ))}
                {needCustom && (
                    <Radio.Button value="custom">
                        <i className="fa fa-adjust" />
                    </Radio.Button>
                )}
            </Radio.Group>
            {needCustom && (
                <input
                    type="number"
                    className="form-control"
                    style={{ borderRadius: 0 }}
                    min={state.min}
                    max={state.max}
                    step={state.step}
                    value={state.customValue}
                    onChange={(event) => {
                        onChangeCustomValue(Number(event.target.value));
                    }}
                    title={i18n._('key-unused-Custom distance for every move')}
                />
            )}
            {needCustom && (
                <div>
                    <RepeatButton
                        className="btn btn-outline-secondary"
                        onClick={increaseCustomDistance}
                        title={i18n._('key-unused-Increase custom distance by one unit')}
                    >
                        <i className="fa fa-plus" />
                    </RepeatButton>
                    <RepeatButton
                        className="btn btn-outline-secondary"
                        onClick={decreaseCustomDistance}
                        title={i18n._('key-unused-Decrease custom distance by one unit')}
                    >
                        <i className="fa fa-minus" />
                    </RepeatButton>
                </div>
            )}
        </div>
    );
};

export default JogDistance;
