import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import Select from '../../components/Select';
import { NumberInput as Input } from '../../components/Input';
import Checkbox from '../../components/Checkbox';

import TipTrigger from '../../components/TipTrigger';
import SvgIcon from '../../components/SvgIcon';

function SettingItem({ definitionKey, settings, isDefinitionEditable = () => true, onChangeDefinition, defaultValue }) {
    const setting = settings[definitionKey];

    const isProfile = !isDefinitionEditable();
    const { label, description, type, unit = '', enabled, options } = setting;
    const settingDefaultValue = setting.default_value;
    const isDefault = defaultValue && (defaultValue.value === settingDefaultValue);
    if (typeof enabled === 'string') {
        if (enabled.indexOf(' and ') !== -1) {
            const andConditions = enabled.split(' and ').map(c => c.trim());
            for (const condition of andConditions) {
            // parse resolveOrValue('adhesion_type') == 'skirt'
                const enabledKey = condition.match("resolveOrValue\\('(.[^)|']*)'") ? condition.match("resolveOrValue\\('(.[^)|']*)'")[1] : null;
                const enabledValue = condition.match("== ?'(.[^)|']*)'") ? condition.match("== ?'(.[^)|']*)'")[1] : null;
                if (enabledKey) {
                    if (settings[enabledKey]) {
                        const value = settings[enabledKey].default_value;
                        if (value !== enabledValue) {
                            return null;
                        }
                    }
                } else {
                    if (settings[condition]) {
                        const value = settings[condition].default_value;
                        if (!value) {
                            return null;
                        }
                    }
                }
            }
        } else {
            const orConditions = enabled.split(' or ')
                .map(c => c.trim());
            let result = false;
            for (const condition of orConditions) {
                if (settings[condition]) {
                    const value = settings[condition].default_value;
                    if (value) {
                        result = true;
                    }
                }
                if (condition.match('(.*) > ([0-9]+)')) {
                    const m = condition.match('(.*) > ([0-9]+)');
                    const enabledKey = m[1];
                    const enabledValue = parseInt(m[2], 10);
                    if (settings[enabledKey]) {
                        const value = settings[enabledKey].default_value;
                        if (value > enabledValue) {
                            result = true;
                        }
                    }
                }
                if (condition.match('(.*) < ([0-9]+)')) {
                    const m = condition.match('(.*) > ([0-9]+)');
                    const enabledKey = m[1];
                    const enabledValue = parseInt(m[2], 10);
                    if (settings[enabledKey]) {
                        const value = settings[enabledKey].default_value;
                        if (value < enabledValue) {
                            result = true;
                        }
                    }
                }
                if (condition.match("resolveOrValue\\('(.[^)|']*)'")) {
                    const m1 = condition.match("resolveOrValue\\('(.[^)|']*)'");
                    const m2 = condition.match("== ?'(.[^)|']*)'");
                    const enabledKey = m1[1];
                    const enabledValue = m2[1];
                    if (settings[enabledKey]) {
                        const value = settings[enabledKey].default_value;
                        if (value === enabledValue) {
                            result = true;
                        }
                    }
                }
            }
            if (!result) {
                return null;
            }
        }
    } else if (typeof enabled === 'boolean' && enabled === false) {
        return null;
    }
    const opts = [];
    if (options) {
        Object.keys(options).forEach((k) => {
            opts.push({
                value: k,
                label: i18n._(options[k])
            });
        });
    }
    return (
        <TipTrigger title={i18n._(label)} content={i18n._(description)} key={definitionKey}>
            <div className="position-re sm-flex justify-space-between height-32 margin-vertical-8">
                <span>
                    {i18n._(label)}
                </span>
                <div className="sm-flex-auto">
                    {isProfile && !isDefault && (
                        <SvgIcon
                            className="margin-horizontal-4"
                            name="Reset"
                            size={24}
                            // className={}
                            onClick={() => {
                                onChangeDefinition(definitionKey, (defaultValue && defaultValue.value) ?? settingDefaultValue);
                            }}
                        />
                    )}
                    {type === 'float' && (
                        <Input
                            className="sm-flex-width align-r"
                            value={settingDefaultValue}
                            // disabled={!isDefinitionEditable()}
                            size="large"
                            onChange={(value) => {
                                onChangeDefinition(definitionKey, value);
                            }}
                        />
                    )}
                    {type === 'float' && (
                        <span className="sm-flex__input-unit-8">{unit}</span>
                    )}
                    {type === 'int' && (
                        <Input
                            className="sm-flex-width align-r"
                            value={settingDefaultValue}
                            // disabled={!isDefinitionEditable()}
                            onChange={(value) => {
                                onChangeDefinition(definitionKey, value);
                            }}
                        />
                    )}
                    {type === 'int' && (
                        <span className="sm-flex__input-unit-8">{unit}</span>
                    )}
                    {type === 'bool' && (
                        <Checkbox
                            className="sm-flex-width align-r"
                            defaultChecked={settingDefaultValue}
                            // disabled={!isDefinitionEditable()}
                            type="checkbox"
                            checked={settingDefaultValue}
                            onChange={(event) => onChangeDefinition(definitionKey, event.target.checked)}
                        />
                    )}
                    {type === 'enum' && (
                        <Select
                            className="sm-flex-width align-r"
                            backspaceRemoves={false}
                            clearable={false}
                            menuContainerStyle={{ zIndex: 5 }}
                            name={definitionKey}
                            // disabled={!isDefinitionEditable()}
                            options={opts}
                            value={settingDefaultValue}
                            onChange={(option) => {
                                onChangeDefinition(definitionKey, option.value);
                            }}
                        />
                    )}
                    {type === undefined && (
                        <Input
                            className="sm-flex-width align-r"
                            value={settingDefaultValue}
                            // disabled={!isDefinitionEditable()}
                            onChange={(value) => {
                                onChangeDefinition(definitionKey, value);
                            }}
                        />
                    )}
                    {type === undefined && (
                        <span className="sm-parameter-row__input-unit">{unit}</span>
                    )}
                </div>
            </div>
        </TipTrigger>
    );
}
SettingItem.propTypes = {
    settings: PropTypes.object.isRequired,
    definitionKey: PropTypes.string.isRequired,
    isDefinitionEditable: PropTypes.func,
    onChangeDefinition: PropTypes.func.isRequired,
    defaultValue: PropTypes.object
};

export default React.memo(SettingItem);
// export default (SettingItem);
