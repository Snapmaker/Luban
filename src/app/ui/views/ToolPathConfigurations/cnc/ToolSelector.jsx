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

function ToolSelector({ toolDefinitions, setCurrentToolDefinition, setCurrentValueAsProfile, toolDefinition, isModifiedDefinition, shouldSaveToolpath = false, saveToolPath }) {
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
            label: 'Create profile with current parameters',
            value: 'new-modified'
        });
    }
    const foundDefinition = toolDefinitionOptions.find(d => d.label === toolDefinition.category);

    return (
        <div>
            <React.Fragment>
                <div className="position-re sm-flex justify-space-between margin-vertical-8">
                    <span className="sm-flex-auto sm-flex-order-negative height-32">
                        {i18n._('Tool')}
                    </span>
                    <div className="sm-flex">
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
                            size="large"
                            valueObj={valueObj}
                            options={toolDefinitionOptions}
                            placeholder={i18n._('Choose profile')}
                            onChange={onChangeActiveToolListValue}
                        />
                        <SvgIcon
                            className="border-radius-8 border-default-grey-1 padding-vertical-2 padding-horizontal-2 margin-left-4"
                            name="PrintingSettingNormal"
                            size={24}
                            onClick={onShowCncToolManager}
                        />
                    </div>
                </div>
                <div className="position-re height-8 margin-bottom-8">
                    <p className="sm-flex__input-unit-104 tooltip-message">
                        {foundDefinition && `${i18n._('Material')}: ${foundDefinition.label}`}
                    </p>
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
    setCurrentValueAsProfile: PropTypes.func.isRequired
};

export default ToolSelector;
