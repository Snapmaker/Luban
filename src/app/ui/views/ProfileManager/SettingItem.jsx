import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { isNil, noop } from 'lodash';
import { Switch } from 'antd';
import i18n from '../../../lib/i18n';
import Select from '../../components/Select';
import { NumberInput as Input } from '../../components/Input';
import Anchor from '../../components/Anchor';
import ColorSelector from '../../components/ColorSelector';
import { HEAD_CNC, PRINTING_MATERIAL_CONFIG_COLORS } from '../../../constants';
import SvgIcon from '../../components/SvgIcon';
import Popover from '../../components/Popover';
import styles from './styles.styl';

function dropdownRender(opts, key, onChangeDefinition, currentValue) {
    return () => (
        <div
            className={classNames(
                'sm-flex',
                'padding-vertical-16',
                'padding-horizontal-16',
                styles['settings-select-wrapper'],
                opts.length > 8 ? styles['settings-select-wrapper_scroll'] : ''
            )}
        >
            {opts.map((settingItem) => {
                const value = settingItem.value;
                const label = settingItem.label;
                return (
                    <span className={classNames(
                        styles['settings-item'],
                        currentValue === value ? styles['settings-item_selected'] : ''
                    )}
                    >
                        <Anchor
                            onClick={() => onChangeDefinition(key, value)}
                        >
                            <div className={classNames(
                                styles['settings-select']
                            )}
                            >
                                <div className={classNames(
                                    styles.img,
                                    styles[`img_${key}_${value}`],
                                )}
                                />
                            </div>
                        </Anchor>
                        <span className="align-c max-width-76 text-overflow-ellipsis-line-2 height-32-half-line margin-top-4 margin-bottom-8">{label}</span>
                    </span>
                );
            })}
        </div>
    );
}

const colorSelectorContent = (settingDefaultValue, definitionKey, setShowColor, onChangeDefinition) => (
    <div>
        <ColorSelector
            recentColorKey="profile-manager"
            colors={PRINTING_MATERIAL_CONFIG_COLORS}
            value={settingDefaultValue.toString()}
            onClose={() => {
                setShowColor(false);
            }}
            onChangeComplete={(color) => {
                onChangeDefinition(definitionKey, color);
            }}
        />
    </div>
);
function SettingItem({
    definitionKey,
    settings,
    isDefaultDefinition = false,
    onChangeDefinition,
    defaultValue,
    styleSize = 'large',
    managerType,
    officalDefinition,
    onClick,
    definitionCategory,
    onChangeMaterialType = noop,
    categoryKey
}) {
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
    if (!visible && !isNil(visible)) {
        return null;
    }
    const opts = [];
    if (options) {
        Object.keys(options).forEach((k) => {
            opts.push({
                value: k.toLocaleLowerCase(),
                label: i18n._(options[k])
            });
        });
    }

    return (
        <Anchor className="sm-flex justify-space-between height-32 margin-vertical-8" onClick={(e) => onClick && onClick(categoryKey, definitionKey, e)}>
            <span className="text-overflow-ellipsis width-auto main-text-normal" style={{ maxWidth: 'calc(100% - 224px)' }}>
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
                {mismatch && (
                    <SvgIcon
                        name="ParameterDisconnect"
                        size={24}
                        type={['static']}
                        color="#FFA940"
                    />
                )}
                {type === 'float' && (
                    <Input
                        suffix={unit}
                        className="sm-flex-width align-r"
                        value={Number(settingDefaultValue)}
                        min={min}
                        max={max}
                        size={styleSize}
                        onChange={(value) => {
                            onChangeDefinition(definitionKey, value);
                        }}
                    />
                )}
                {type === 'int' && (
                    <Input
                        suffix={unit}
                        className="sm-flex-width align-r"
                        value={Number(settingDefaultValue)}
                        size={styleSize}
                        // disabled={!isDefinitionEditable()}
                        onChange={(value) => {
                            onChangeDefinition(definitionKey, value);
                        }}
                    />
                )}
                {type === 'bool' && (
                    <Switch
                        className="sm-flex-width align-r"
                        defaultChecked={settingDefaultValue}
                        // disabled={!isDefinitionEditable()}
                        type="checkbox"
                        checked={settingDefaultValue}
                        onChange={(checked) => onChangeDefinition(definitionKey, checked)}
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
                            onChangeDefinition(definitionKey, option.value);
                        }}
                        disabled={(officalDefinition && managerType === HEAD_CNC && definitionKey === 'tool_type')}
                    />
                )}
                {type === 'enumWithImage' && (
                    <Select
                        placement="bottomRight"
                        className="sm-flex-width align-r"
                        dropdownRender={dropdownRender(opts, definitionKey, onChangeDefinition, settingDefaultValue)}
                        dropdownStyle={{
                            maxWidth: '500px'
                        }}
                        size={styleSize}
                        name={definitionKey}
                        options={opts}
                        value={settingDefaultValue}
                        onChange={(option) => {
                            onChangeDefinition(definitionKey, option.value);
                        }}
                        disabled={officalDefinition && managerType === HEAD_CNC && definitionKey === 'tool_type'}
                    />
                )}
                {type === undefined && (
                    <Input
                        size={styleSize}
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
                {type === 'color' && (
                    <Popover
                        content={colorSelectorContent(settingDefaultValue, definitionKey, setShowColor, onChangeDefinition)}
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
                                height: 32
                            }}
                            role="button"
                            tabIndex="-1"
                            onKeyPress={() => { }}
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
    onChangeDefinition: PropTypes.func.isRequired,
    defaultValue: PropTypes.object,
    styleSize: PropTypes.string,
    managerType: PropTypes.string,
    officalDefinition: PropTypes.bool,
    definitionCategory: PropTypes.string,
    onChangeMaterialType: PropTypes.func,
    onClick: PropTypes.func,
    categoryKey: PropTypes.string
};

export default React.memo(SettingItem);
