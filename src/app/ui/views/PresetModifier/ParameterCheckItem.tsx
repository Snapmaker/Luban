import React from 'react';
import Checkbox from '../../components/Checkbox';

type Props = {
    label: string;
    checked: boolean;
    onChange?: (check: boolean) => void;
};

const ParameterCheckItem: React.FC<Props> = (props) => {
    const {
        label = '',
        checked,
        onChange = null,
    } = props;

    function _onChange(e) {
        if (onChange) {
            onChange(e.target.checked);
        }
    }

    return (
        <div className="sm-flex height-32 margin-vertical-4">
            <Checkbox
                className="sm-flex-auto sm-flex-order-negative"
                style={{ width: 'auto' }}
                checked={checked}
                // onChange={(e) => onChangePresetSettings(definitionKey, e.target.checked, configCategory)}
                onChange={_onChange}
            />
            <span className="margin-left-8">{label}</span>
        </div>
    );
};

export default React.memo(ParameterCheckItem);
