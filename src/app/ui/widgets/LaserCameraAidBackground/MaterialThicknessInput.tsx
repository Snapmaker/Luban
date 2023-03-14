import classNames from 'classnames';
import React, { useState } from 'react';

import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';

type TProps = {
    series: string;
    onChange: (num: number) => void;
}

export const MATERIALTHICKNESSMAX = {
    A150: 50,
    A250: 100,
    A350: 150,
    A400: 200,
};

const MaterialThicknessInput: React.FC<TProps> = (props) => {
    const [value, setValue] = useState(0);
    return (
        <div className={classNames(styles['laser-material-thickness-input'])}>

            <p className="font-size-middle font-weight-bold">{i18n._('key-Workspace/LaserStartJob-semi_auto_mode')}</p>
            <p className="font-size-base">{i18n._('key-Laser/CameraCapture-thickness input')}</p>

            <div className="sm-flex align-center">
                <span className="margin-right-8">{i18n._('key-StackedModel/Import-Material Thickness')}</span>
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
