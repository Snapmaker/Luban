import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import Checkbox from '../../components/Checkbox';

function CheckboxItem({ definitionKey, settings, calculateTextIndex = () => 0, defaultValue, width = 'auto', isDefinitionEditable = () => true, onChangeDefinition }) {
    const setting = settings[definitionKey];
    const { label, description } = setting;

    return (
        <TipTrigger title={i18n._(label)} content={i18n._(description)} key={definitionKey}>
            <div className="sm-flex height-32 margin-vertical-8 justify-space-between">
                <Checkbox
                    className="sm-flex-width"
                    style={{ width: width, cursor: !isDefinitionEditable(definitionKey) ? 'not-allowed' : 'default' }}
                    checked={defaultValue}
                    disabled={!isDefinitionEditable(definitionKey)}
                    onChange={(event) => onChangeDefinition(definitionKey, event.target.checked)}
                />
                <span
                    className="sm-flex-auto"
                    style={{ textIndent: calculateTextIndex(definitionKey) }}
                >
                    {i18n._(label)}
                </span>
            </div>
        </TipTrigger>
    );
}
CheckboxItem.propTypes = {
    settings: PropTypes.object.isRequired,
    calculateTextIndex: PropTypes.func,
    definitionKey: PropTypes.string.isRequired,
    defaultValue: PropTypes.bool.isRequired,
    isDefinitionEditable: PropTypes.func,
    width: PropTypes.string,
    onChangeDefinition: PropTypes.func.isRequired
};

export default React.memo(CheckboxItem);
// export default (CheckboxItem);
