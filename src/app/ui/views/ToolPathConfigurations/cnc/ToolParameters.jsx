import React from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import { useDispatch } from 'react-redux';
import classNames from 'classnames';
import Select from '../../../components/Select';
import i18n from '../../../../lib/i18n';
import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { actions as cncActions } from '../../../../flux/cnc';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput as Input } from '../../../components/Input';
import { TOOLPATH_TYPE_VECTOR } from '../../../../constants';

function SettingItem(props) {
    const { setting, isSVG, settingName, updateToolConfig } = props;
    if (!setting) {
        return null;
    }
    const defaultValue = setting.default_value;
    const label = setting.label;
    const unit = setting.unit;
    const min = setting.min || 0;
    const max = setting.max || 6000;
    const content = setting.description || '';

    const isToolParams = (k) => {
        return _.includes(['angle', 'shaft_diameter', 'diameter'], k);
    };

    if (settingName === 'density' && isSVG) {
        return null;
    }

    return (
        <div key={settingName} className="sm-parameter-row">
            <TipTrigger
                title={i18n._(label)}
                content={i18n._(content)}
            >
                <span className="sm-parameter-row__label-lg">{i18n._(label)}</span>
                <Input
                    className="sm-parameter-row__input"
                    value={defaultValue}
                    min={min}
                    max={max}
                    style={{ width: '160px' }}
                    onChange={value => {
                        updateToolConfig(settingName, value);
                    }}
                    disabled={isToolParams(settingName)}
                />
                <span className="sm-parameter-row__input-unit">{unit}</span>
            </TipTrigger>
        </div>
    );
}
SettingItem.propTypes = {
    settingName: PropTypes.string,
    updateToolConfig: PropTypes.func.isRequired,
    setting: PropTypes.object.isRequired,
    isSVG: PropTypes.bool.isRequired
};


function ToolParameters(props) {
    const dispatch = useDispatch();
    const { toolDefinitions, activeToolDefinition, toolPath, isModifiedDefinition, updateToolConfig } = props;
    const type = toolPath?.type;
    const isSVG = type === TOOLPATH_TYPE_VECTOR;

    const toolDefinitionOptions = [];
    const toolDefinitionOptionsObj = {};

    function onShowCncToolManager() {
        dispatch(cncActions.updateShowCncToolManager(true));
    }
    async function onChangeActiveToolListValue(option) {
        if (option.definitionId === 'new') {
            await onShowCncToolManager();
            props.setCurrentValueAsProfile();
        } else {
            const definitionId = option.definitionId;
            const name = option.name;
            await dispatch(cncActions.changeActiveToolListDefinition(definitionId, name));
        }
    }

    toolDefinitions.forEach(tool => {
        const category = tool.category;
        const definitionId = tool.definitionId;

        if (Object.keys(tool?.settings).length > 0) {
            const checkboxAndSelectGroup = {};
            const name = tool.name;
            let detailName = '';
            if (tool.settings.angle.default_value !== '180') {
                detailName = `${tool.name} (${tool.settings.angle.default_value}${tool.settings.angle.unit} ${tool.settings.shaft_diameter.default_value}${tool.settings.shaft_diameter.unit} )`;
            } else {
                detailName = `${tool.name} (${tool.settings.shaft_diameter.default_value}${tool.settings.shaft_diameter.unit} )`;
            }
            checkboxAndSelectGroup.name = name;
            checkboxAndSelectGroup.definitionId = definitionId;
            checkboxAndSelectGroup.label = `${detailName}`;
            checkboxAndSelectGroup.value = `${definitionId}-${name}`;
            if (toolDefinitionOptionsObj[category]) {
                toolDefinitionOptionsObj[category].options.push(checkboxAndSelectGroup);
            } else {
                const groupOptions = {
                    label: category,
                    definitionId: definitionId,
                    options: []
                };
                toolDefinitionOptionsObj[category] = groupOptions;
                groupOptions.options.push(checkboxAndSelectGroup);
            }
        }
        // return true;
    });
    Object.values(toolDefinitionOptionsObj).forEach((item) => {
        toolDefinitionOptions.push(item);
    });

    const valueObj = {
        firstKey: 'definitionId',
        firstValue: activeToolDefinition.definitionId
    };

    if (isModifiedDefinition) {
        toolDefinitionOptions.push({
            name: 'modified',
            definitionId: 'new',
            label: 'Create profile with current parameters',
            value: 'new-modified'
        });
    }
    const foundDefinition = toolDefinitionOptions.find(d => d.label === activeToolDefinition.category);

    return (
        <div>
            <React.Fragment>
                <div className="sm-parameter-container">
                    <div
                        className={classNames(
                            styles['manager-wrapper']
                        )}
                    >
                        <span className={classNames(
                            'sm-parameter-row__label',
                            styles['manager-select-name'],
                        )}
                        >
                            {i18n._('Tool')}
                        </span>
                        {(isModifiedDefinition
                            && (
                                <span
                                    className={classNames(
                                        styles['manager-is-modified']
                                    )}
                                />
                            )
                        )}
                        <Select
                            className={classNames(
                                styles['manager-select'],
                                'sm-parameter-row__select'
                            )}
                            clearable={false}
                            isGroup
                            valueObj={valueObj}
                            options={toolDefinitionOptions}
                            placeholder={i18n._('Choose profile')}
                            onChange={onChangeActiveToolListValue}
                        />
                        <p className={classNames(
                            styles['manager-detail'],
                        )}
                        >
                            {foundDefinition && `${i18n._('Material')} : ${foundDefinition.label}`}
                        </p>
                        <Anchor
                            onClick={onShowCncToolManager}
                        >
                            <span
                                className={classNames(
                                    styles['manager-icon'],
                                )}
                            />
                        </Anchor>
                    </div>

                    {(Object.keys(activeToolDefinition.settings).map(key => {
                        const setting = activeToolDefinition.settings[key];
                        return (
                            <SettingItem
                                setting={setting}
                                updateToolConfig={updateToolConfig}
                                key={key}
                                settingName={key}
                                isSVG={isSVG}
                            />
                        );
                    }))}

                </div>
            </React.Fragment>
        </div>
    );
}
ToolParameters.propTypes = {
    toolDefinitions: PropTypes.array.isRequired,
    activeToolDefinition: PropTypes.object.isRequired,
    toolPath: PropTypes.object.isRequired,
    isModifiedDefinition: PropTypes.bool.isRequired,
    updateToolConfig: PropTypes.func.isRequired,
    setCurrentValueAsProfile: PropTypes.func.isRequired
};

export default ToolParameters;
