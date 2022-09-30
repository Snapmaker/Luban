import React, { useState } from 'react';
import classNames from 'classnames';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';

type TProps = {
    series: string;
    onChange: (num: number) => void;
}

const MATERIALTHICKNESSMAX = {
    A150: 50,
    A250: 100,
    A350: 150,
    A400: 200
};

const MaterialThicknessInput = (props: TProps) => {
    const [value, setValue] = useState(0);
    return (
        <div className={classNames(styles['laser-material-thickness-input'])}>

            <p className="font-size-middle font-weight-bold">输入材料厚度</p>
            <p className="font-size-base">测量并输入材料厚度。机器将会依据输入的材料厚度，自动调整激光高度。（极限值）</p>

            <div className="sm-flex align-center">
                <span className="margin-right-8">Material Tickness</span>
                <Input
                    suffix="mm"
                    value={value}
                    max={MATERIALTHICKNESSMAX[props.series]}
                    min={0}
                    onChange={(v) => {
                        setValue(v);
                        props.onChange(v);
                    }}
                />
            </div>
        </div>
    );
};

export default MaterialThicknessInput;
