import { Switch, Tooltip } from 'antd';
import classNames from 'classnames';
import { isNil, noop } from 'lodash';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

import { PRINTING_MATERIAL_CONFIG_COLORS } from '../../../constants';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import ColorSelector from '../../components/ColorSelector';
import { NumberInput as Input } from '../../components/Input';
import Popover from '../../components/Popover';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import styles from './styles.styl';

function dropdownRender(opts, key, onChangePresetSettings, currentValue) {
    return () => (
        <div
            className={classNames(
                'sm-flex',
                'padding-vertical-16',
                'padding-horizontal-16',
                styles['settings-select-wrapper'],
                opts.length > 8 ? styles['settings-select-wrapper_scroll'] : '',
            )}
        >
            {
                opts.map((settingItem) => {
                    const value = settingItem.value;
                    const label = settingItem.label;
                    return (
                        <span
                            key={label}
                            className={classNames(
                                styles['settings-item'],
                                {
                                    [styles['settings-item_selected']]: currentValue === value,
                                },
                            )}
                        >
                            <Anchor onClick={() => onChangePresetSettings(key, value)}>
                                <div className={classNames(styles['settings-select'])}>
                                    <div
                                        className={classNames(
                                            styles.img,
                                            styles[`img_${key}_${value}`],
                                        )}
                                    />
                                </div>
                            </Anchor>
                            <span className="align-c max-width-76 text-overflow-ellipsis-line-2 height-32-half-line margin-top-4 margin-bottom-8">{label}</span>
                        </span>
                    );
                })
            }
        </div>
    );
}

const colorSelectorContent = (settingDefaultValue, definitionKey, setShowColor, onChangePresetSettings) => (
    <div>
        <ColorSelector
            recentColorKey="profile-manager"
            colors={PRINTING_MATERIAL_CONFIG_COLORS}
            value={settingDefaultValue.toString()}
            onClose={() => {
                setShowColor(false);
            }}
            onChangeComplete={(color) => {
                onChangePresetSettings(definitionKey, color);
            }}
        />
    </div>
);

// TODO: Refactor this ASAP
// FIXME: Refactor this ASAP
function SettingItem(
    {
        definitionKey,
        settings,
        isDefaultDefinition = false,
        onChangePresetSettings,
        defaultValue,
        styleSize = 'large',
        showTooltip = false,
        onClick,
        definitionCategory,
        onChangeMaterialType = noop,
        categoryKey,
        disabled = false,
    }
) {
    const [showColor, setShowColor] = useState(false);

    const setting = settings[definitionKey];
    const isProfile = isDefaultDefinition;
    if (!setting) {
        return null;
    }
    const { label, type, unit = '', options, min, max, mismatch } = setting;
    const { visible } = setting;
    const settingDefaultValue = setting.default_value;
    const isDefault = defaultValue && (defaultValue.value === settingDefaultValue);
    if ((!visible || visible === 'false') && !isNil(visible)) {
        return null;
    }
    const opts = [];
    if (options) {
        Object.keys(options).forEach((k) => {
            opts.push({
                value: k.toLocaleLowerCase(),
                label: i18n._(options[k]),
            });
        });
    }

    return (
        <Anchor className="sm-flex justify-space-between height-32 margin-vertical-8" onClick={(e) => onClick && onClick(categoryKey, definitionKey, e)}>
            {!showTooltip && (
                <span className="text-overflow-ellipsis width-auto main-text-normal" style={{ maxWidth: `calc(100% - ${styleSize === 'large' ? 224 : 176}px)` }}>
                    {i18n._(label)}
                </span>
            )}
            {showTooltip && (
                <Tooltip title={i18n._(label)} placement="left">
                    <span className="text-overflow-ellipsis width-auto main-text-normal" style={{ maxWidth: `calc(100% - ${styleSize === 'large' ? 224 : 176}px)` }}>
                        {i18n._(label)}
                    </span>
                </Tooltip>
            )}
            <div className="sm-flex-auto">
                {isProfile && !isDefault && (
                    <SvgIcon
                        className="margin-left-4"
                        name="Reset"
                        size={24}
                        onClick={() => {
                            onChangePresetSettings(definitionKey, (defaultValue && defaultValue.value) ?? settingDefaultValue);
                        }}
                    />
                )}
                {/* Parameter is not associated to parent */}
                {
                    mismatch && (
                        <Tooltip
                            className="margin-right-4"
                            title={i18n._('key-Printing/Parameter Not Associated with Parent')}
                            placement="topLeft"
                        >
                            <SvgIcon
                                name="ParameterDisconnect"
                                size={24}
                                type={['static']}
                                color="#FFA940"
                            />
                        </Tooltip>
                    )
                }
                {type === 'float' && (
                    <Input
                        suffix={unit}
                        className="sm-flex-width align-r"
                        value={Number(settingDefaultValue)}
                        min={min}
                        max={max}
                        size={styleSize}
                        onChange={(value) => {
                            onChangePresetSettings(definitionKey, value);
                        }}
                        disabled={disabled}
                    />
                )}
                {type === 'int' && (
                    <Input
                        suffix={unit}
                        className="sm-flex-width align-r"
                        value={Number(settingDefaultValue)}
                        min={min}
                        max={max}
                        size={styleSize}
                        // disabled={!isDefinitionEditable()}
                        onChange={(value) => {
                            onChangePresetSettings(definitionKey, value);
                        }}
                        disabled={disabled}
                    />
                )}
                {type === 'bool' && (
                    <Switch
                        className="sm-flex-width align-r"
                        defaultChecked={settingDefaultValue}
                        // disabled={!isDefinitionEditable()}
                        type="checkbox"
                        checked={settingDefaultValue}
                        onChange={(checked) => onChangePresetSettings(definitionKey, checked)}
                        disabled={disabled}
                    />
                )}
                {type === 'enum' && definitionKey === 'material_type' && (
                    <Select
                        className="sm-flex-width align-r"
                        backspaceRemoves={false}
                        clearable={false}
                        size={styleSize}
                        menuContainerStyle={{ zIndex: 5 }}
                        name={definitionKey}
                        options={opts}
                        value={definitionCategory.toLowerCase()}
                        onChange={(option) => {
                            onChangePresetSettings('material_type', option.value);
                            onChangeMaterialType(option.label);
                        }}
                        disabled={isProfile}
                    />
                )}
                {type === 'enum' && definitionKey !== 'material_type' && (
                    <Select
                        className="sm-flex-width align-r"
                        backspaceRemoves={false}
                        clearable={false}
                        size={styleSize}
                        menuContainerStyle={{ zIndex: 5 }}
                        name={definitionKey}
                        options={opts}
                        value={typeof settingDefaultValue === 'string' ? settingDefaultValue.toLowerCase() : settingDefaultValue}
                        onChange={(option) => {
                            onChangePresetSettings(definitionKey, option.value);
                        }}
                        disabled={disabled}
                    />
                )}
                {type === 'enumWithImage' && (
                    <Select
                        placement="bottomRight"
                        className="sm-flex-width align-r"
                        dropdownRender={dropdownRender(opts, definitionKey, onChangePresetSettings, settingDefaultValue)}
                        dropdownStyle={{
                            maxWidth: '500px',
                        }}
                        size={styleSize}
                        name={definitionKey}
                        options={opts}
                        value={settingDefaultValue}
                        onChange={(option) => {
                            onChangePresetSettings(definitionKey, option.value);
                        }}
                        disabled={disabled}
                    />
                )}
                {type === undefined && (
                    <Input
                        size={styleSize}
                        className="sm-flex-width align-r"
                        value={settingDefaultValue}
                        // disabled={!isDefinitionEditable()}
                        onChange={(value) => {
                            onChangePresetSettings(definitionKey, value);
                        }}
                    />
                )}
                {type === undefined && (
                    <span className="sm-parameter-row__input-unit">{unit}</span>
                )}
                {type === 'color' && (
                    <Popover
                        content={colorSelectorContent(settingDefaultValue, definitionKey, setShowColor, onChangePresetSettings)}
                        visible={showColor}
                        trigger="click"
                        placement="bottomRight"
                        className="cancel-content-padding"
                        onVisibleChange={(visibleValue) => {
                            setShowColor(visibleValue);
                        }}
                    >
                        <span
                            className="sm-flex-width align-r height-percent-100 width-96 display-inline border-radius-8 border-default-black-5"
                            style={{
                                background: settingDefaultValue,
                                height: 32,
                            }}
                            role="button"
                            tabIndex="-1"
                            onKeyPress={() => {
                            }}
                            onClick={() => setShowColor(!showColor)}
                        />
                    </Popover>
                )}
            </div>
        </Anchor>
    );
}

SettingItem.propTypes = {
    settings: PropTypes.object.isRequired,
    definitionKey: PropTypes.string.isRequired,
    isDefaultDefinition: PropTypes.bool,
    onChangePresetSettings: PropTypes.func.isRequired,
    defaultValue: PropTypes.object,
    styleSize: PropTypes.string,
    showTooltip: PropTypes.bool,
    definitionCategory: PropTypes.string,
    onChangeMaterialType: PropTypes.func,
    onClick: PropTypes.func,
    categoryKey: PropTypes.string,
    disabled: PropTypes.bool,
};

export default React.memo(SettingItem);
