import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import Checkbox from '../../components/Checkbox';

function CheckboxItem({
    definitionKey,
    settings,
    calculateTextIndex = () => 0,
    width = 'auto',
    isOfficialDefinitionKey = () => true,
    onChangePresetSettings,
    defaultValue
}) {
    const setting = settings[definitionKey];
    const { label, description } = setting;
    return (
        <TipTrigger
            title={i18n._(label)}
            content={i18n._(description)}
            key={definitionKey}
        >
            <div className="sm-flex height-32 margin-vertical-8">
                <Checkbox
                    className="sm-flex-auto sm-flex-order-negative"
                    style={{
                        width: width,
                        cursor: isOfficialDefinitionKey(definitionKey)
                            ? 'not-allowed'
                            : 'default',
                        marginLeft: calculateTextIndex(definitionKey)
                    }}
                    checked={defaultValue}
                    disabled={isOfficialDefinitionKey(definitionKey)}
                    onChange={(event) => onChangePresetSettings(definitionKey, event.target.checked)}
                />
                <span className="margin-left-8">{i18n._(label)}</span>
            </div>
        </TipTrigger>
    );
}
CheckboxItem.propTypes = {
    settings: PropTypes.object.isRequired,
    calculateTextIndex: PropTypes.func,
    definitionKey: PropTypes.string.isRequired,
    defaultValue: PropTypes.bool.isRequired,
    isOfficialDefinitionKey: PropTypes.func,
    width: PropTypes.string,
    onChangePresetSettings: PropTypes.func.isRequired
};

export default React.memo(CheckboxItem);
// export default (CheckboxItem);
