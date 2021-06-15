import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import Select from '../../components/Select';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';

function ConfigItem({ definitionForManager, group, isDefinitionEditable, onChangeDefinition, defaultKeysAndId }) {
    return (
        <div>
            {group.name && (
                <Anchor
                    className="sm-parameter-header"
                >
                    <span className="fa fa-gear sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._(group.name)}</span>
                </Anchor>
            )}
            { group.fields && group.fields.map((key) => {
                const setting = definitionForManager.settings[key];
                const { label, description, type, unit = '', enabled, options } = setting;
                const defaultValue = setting.default_value;
                if (typeof enabled === 'string') {
                    if (enabled.indexOf(' and ') !== -1) {
                        const andConditions = enabled.split(' and ').map(c => c.trim());
                        for (const condition of andConditions) {
                        // parse resolveOrValue('adhesion_type') == 'skirt'
                            const enabledKey = condition.match("resolveOrValue\\('(.[^)|']*)'") ? condition.match("resolveOrValue\\('(.[^)|']*)'")[1] : null;
                            const enabledValue = condition.match("== ?'(.[^)|']*)'") ? condition.match("== ?'(.[^)|']*)'")[1] : null;
                            if (enabledKey) {
                                if (definitionForManager.settings[enabledKey]) {
                                    const value = definitionForManager.settings[enabledKey].default_value;
                                    if (value !== enabledValue) {
                                        return null;
                                    }
                                }
                            } else {
                                if (definitionForManager.settings[condition]) {
                                    const value = definitionForManager.settings[condition].default_value;
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
                            if (definitionForManager.settings[condition]) {
                                const value = definitionForManager.settings[condition].default_value;
                                if (value) {
                                    result = true;
                                }
                            }
                            if (condition.match('(.*) > ([0-9]+)')) {
                                const m = condition.match('(.*) > ([0-9]+)');
                                const enabledKey = m[1];
                                const enabledValue = parseInt(m[2], 10);
                                if (definitionForManager.settings[enabledKey]) {
                                    const value = definitionForManager.settings[enabledKey].default_value;
                                    if (value > enabledValue) {
                                        result = true;
                                    }
                                }
                            }
                            if (condition.match('(.*) < ([0-9]+)')) {
                                const m = condition.match('(.*) > ([0-9]+)');
                                const enabledKey = m[1];
                                const enabledValue = parseInt(m[2], 10);
                                if (definitionForManager.settings[enabledKey]) {
                                    const value = definitionForManager.settings[enabledKey].default_value;
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
                                if (definitionForManager.settings[enabledKey]) {
                                    const value = definitionForManager.settings[enabledKey].default_value;
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
                    <TipTrigger title={i18n._(label)} content={i18n._(description)} key={key}>
                        <div className="sm-parameter-row" key={key}>
                            <span className="sm-parameter-row__label-lg">{i18n._(label)}</span>
                            {type === 'float' && (
                                <Input
                                    className="sm-parameter-row__input"
                                    style={{ width: '160px' }}
                                    value={defaultValue}
                                    disabled={!isDefinitionEditable(definitionForManager)}
                                    onChange={(value) => {
                                        onChangeDefinition(key, value);
                                    }}
                                />
                            )}
                            {type === 'float' && (
                                <span className="sm-parameter-row__input-unit">{unit}</span>
                            )}
                            {type === 'int' && (
                                <Input
                                    className="sm-parameter-row__input"
                                    style={{ width: '160px' }}
                                    value={defaultValue}
                                    disabled={!isDefinitionEditable(definitionForManager)}
                                    onChange={(value) => {
                                        onChangeDefinition(key, value);
                                    }}
                                />
                            )}
                            {type === 'int' && (
                                <span className="sm-parameter-row__input-unit">{unit}</span>
                            )}
                            {type === 'bool' && (
                                <input
                                    className="sm-parameter-row__checkbox"
                                    style={{ cursor: !isDefinitionEditable(definitionForManager) ? 'not-allowed' : 'default' }}
                                    type="checkbox"
                                    checked={defaultValue}
                                    disabled={!isDefinitionEditable(definitionForManager)}
                                    onChange={(event) => onChangeDefinition(key, event.target.checked, defaultKeysAndId.keysArray)}
                                />
                            )}
                            {type === 'enum' && (
                                <Select
                                    className="sm-parameter-row__select-md"
                                    backspaceRemoves={false}
                                    clearable={false}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name={key}
                                    disabled={!isDefinitionEditable(definitionForManager)}
                                    options={opts}
                                    value={defaultValue}
                                    onChange={(option) => {
                                        onChangeDefinition(key, option.value, defaultKeysAndId.keysArray);
                                    }}
                                />
                            )}
                            {type === undefined && (
                                <Input
                                    className="sm-parameter-row__input"
                                    style={{ width: '160px' }}
                                    value={defaultValue}
                                    disabled={!isDefinitionEditable(definitionForManager)}
                                    onChange={(value) => {
                                        onChangeDefinition(key, value);
                                    }}
                                />
                            )}
                            {type === undefined && (
                                <span className="sm-parameter-row__input-unit">{unit}</span>
                            )}
                        </div>
                    </TipTrigger>
                );
            })}
        </div>
    );
}
ConfigItem.propTypes = {
    definitionForManager: PropTypes.object.isRequired,
    group: PropTypes.object.isRequired,
    defaultKeysAndId: PropTypes.object.isRequired,
    isDefinitionEditable: PropTypes.func.isRequired,
    onChangeDefinition: PropTypes.func.isRequired
};

export default ConfigItem;
