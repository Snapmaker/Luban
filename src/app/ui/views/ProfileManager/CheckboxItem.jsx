import React from 'react';
import PropTypes from 'prop-types';
// import { Switch } from 'antd';
import i18n from '../../../lib/i18n';
import Checkbox from '../../components/Checkbox';

function CheckboxItem({
    definitionKey,
    settings,
    // calculateTextIndex = () => 0,
    width = 'auto',
    onChangePresetSettings,
    defaultValue,
    configCategory
}) {
    const setting = settings[definitionKey];

    const { label } = setting;
    return (
        <div className="sm-flex height-32 margin-vertical-8">
            <Checkbox
                className="sm-flex-auto sm-flex-order-negative"
                style={{
                    width: width,
                    // marginLeft: calculateTextIndex(definitionKey)
                }}
                checked={defaultValue}
                onChange={(e) => onChangePresetSettings(definitionKey, e.target.checked, configCategory)}
            />
            <span className="margin-left-8">{i18n._(label)}</span>
        </div>
    );
}
CheckboxItem.propTypes = {
    settings: PropTypes.object.isRequired,
    // calculateTextIndex: PropTypes.func,
    definitionKey: PropTypes.string.isRequired,
    defaultValue: PropTypes.bool.isRequired,
    width: PropTypes.string,
    onChangePresetSettings: PropTypes.func.isRequired,
    configCategory: PropTypes.string
};

export default React.memo(CheckboxItem);
// export default (CheckboxItem);
