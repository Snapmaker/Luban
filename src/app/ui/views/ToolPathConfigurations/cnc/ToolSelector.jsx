import React, { useState } from 'react';
import PropTypes from 'prop-types';
// import { useDispatch } from 'react-redux';
import classNames from 'classnames';
import Select from '../../../components/Select';
import i18n from '../../../../lib/i18n';
import styles from '../styles.styl';
// import { actions as cncActions } from '../../../../flux/cnc';
import CncToolManager from '../../CncToolManager';
import SvgIcon from '../../../components/SvgIcon';

function ToolSelector({
    toolDefinitions,
    setCurrentToolDefinition,
    setCurrentValueAsProfile,
    toolDefinition,
    isModifiedDefinition = false,
    shouldSaveToolpath = false,
    saveToolPath,
    isModel,
}) {
    const [showManager, setShowManager] = useState(false);
    // const dispatch = useDispatch();

    const toolDefinitionOptions = [];
    const toolDefinitionOptionsObj = {};

    function onShowCncToolManager() {
        setShowManager(true);
    }

    function renderModalView() {
        function onclose() {
            setShowManager(false);
        }
        let saveToolPathFunc;
        if (shouldSaveToolpath) {
            saveToolPathFunc = saveToolPath;
        }
        return (
            showManager && (
                <CncToolManager
                    shouldSaveToolpath
                    setCurrentToolDefinition={setCurrentToolDefinition}
                    saveToolPath={saveToolPathFunc}
                    closeToolManager={onclose}
                />
            )
        );
    }

    async function onChangeActiveToolListValue(option) {
        if (option.definitionId === 'new') {
            await onShowCncToolManager();
            setCurrentValueAsProfile();
        } else {
            const definitionId = option.definitionId;
            const newDefinition = toolDefinitions.find(d => d.definitionId === definitionId);
            setCurrentToolDefinition(newDefinition);
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
                detailName = `${tool.name} (${tool.settings.angle.default_value}${tool.settings.angle.unit} ${tool.settings.shaft_diameter.default_value}${tool.settings.shaft_diameter.unit})`;
            } else {
                detailName = `${tool.name} (${tool.settings.shaft_diameter.default_value}${tool.settings.shaft_diameter.unit})`;
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
        firstValue: toolDefinition.definitionId
    };

    if (isModifiedDefinition) {
        toolDefinitionOptions.push({
            name: 'modified',
            definitionId: 'new',
            label: i18n._('key-Laser/ToolpathParameters-Create profile with current parameters'),
            value: 'new-modified'
        });
    }
    const foundDefinition = toolDefinitionOptions.find(d => d.label === toolDefinition.category);

    return (
        <div>
            <React.Fragment>
                <div className={`margin-vertical-8 ${isModel ? 'position-re sm-flex justify-space-between' : null}`}>
                    <div className="sm-flex-auto sm-flex-order-negative height-32">
                        {i18n._('key-Cnc/ToolpathParameters/ToolSelector-Tool')}
                    </div>
                    <div className="sm-flex position-re padding-bottom-24">
                        {(isModifiedDefinition
                            && (
                                <span
                                    className={classNames(
                                        styles['manager-is-modified'],
                                        'height-32'
                                    )}
                                />
                            )
                        )}
                        <Select
                            className="sm-flex align-r"
                            clearable={false}
                            isGroup
                            size={isModel ? 'super-large' : 'higher-larger'}
                            valueObj={valueObj}
                            options={toolDefinitionOptions}
                            placeholder={i18n._('key-Cnc/ToolpathParameters/ToolSelector-Choose profile')}
                            onChange={onChangeActiveToolListValue}
                        />
                        <SvgIcon
                            // className="border-radius-8 border-default-grey-1 padding-vertical-2 padding-horizontal-2 margin-left-4"
                            className="border-default-black-5 margin-left-4"
                            name="PrintingSettingNormal"
                            size={24}
                            onClick={onShowCncToolManager}
                            borderRadius={8}
                        />
                        <div className={`position-absolute bottom-0 height-16 ${isModifiedDefinition ? 'left-16' : ''}`}>
                            <p className="additional-message">
                                {foundDefinition && `${i18n._('key-Cnc/ToolpathParameters/ToolSelector-Material')}: ${foundDefinition.label}`}
                            </p>
                        </div>
                    </div>
                </div>
                {renderModalView()}
            </React.Fragment>
        </div>
    );
}
ToolSelector.propTypes = {
    toolDefinitions: PropTypes.array.isRequired,
    toolDefinition: PropTypes.object.isRequired,
    setCurrentToolDefinition: PropTypes.func,
    isModifiedDefinition: PropTypes.bool.isRequired,
    shouldSaveToolpath: PropTypes.bool,
    saveToolPath: PropTypes.func,
    setCurrentValueAsProfile: PropTypes.func.isRequired,
    isModel: PropTypes.bool
};

export default ToolSelector;
