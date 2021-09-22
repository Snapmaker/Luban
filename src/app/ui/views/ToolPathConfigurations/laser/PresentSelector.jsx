import React, { useState } from 'react';
import PropTypes from 'prop-types';
// import { useDispatch } from 'react-redux';
import classNames from 'classnames';
import Select from '../../../components/Select';
import i18n from '../../../../lib/i18n';
import styles from '../styles.styl';
// import { actions as cncActions } from '../../../../flux/cnc';
import LaserPresentManager from '../../LaserPresentManager';
import SvgIcon from '../../../components/SvgIcon';

function PresentSelector({ toolDefinitions, setCurrentToolDefinition, setCurrentValueAsProfile, toolDefinition, isModifiedDefinition, shouldSaveToolpath = false, saveToolPath }) {
    const [showManager, setShowManager] = useState(false);
    // const dispatch = useDispatch();

    const toolDefinitionOptions = [];
    const toolDefinitionOptionsObj = {};

    function onShowManager() {
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
                <LaserPresentManager
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
            await onShowManager();
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
            const detailName = '';
            // if (tool.settings.angle.default_value !== '180') {
            //     detailName = `${tool.name} (${tool.settings.angle.default_value}${tool.settings.angle.unit} ${tool.settings.shaft_diameter.default_value}${tool.settings.shaft_diameter.unit})`;
            // } else {
            //     detailName = `${tool.name} (${tool.settings.shaft_diameter.default_value}${tool.settings.shaft_diameter.unit})`;
            // }
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
                        {i18n._('Present')}
                    </span>
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
                            size="super-large"
                            valueObj={valueObj}
                            options={toolDefinitionOptions}
                            placeholder={i18n._('key_ui/views/ToolPathConfigurations/laser/PresentSelector_Choose profile')}
                            onChange={onChangeActiveToolListValue}
                        />
                        <SvgIcon
                            // className="border-radius-8 border-default-grey-1 padding-vertical-2 padding-horizontal-2 margin-left-4"
                            className="border-default-black-5 margin-left-4"
                            name="PrintingSettingNormal"
                            size={24}
                            onClick={onShowManager}
                            borderRadius={8}
                        />
                        <div className={`position-ab bottom-0 height-16 ${isModifiedDefinition ? 'left-16' : ''}`}>
                            <p className="additional-message">
                                {foundDefinition && `${i18n._('key_ui/views/ToolPathConfigurations/laser/PresentSelector_Material')}: ${foundDefinition.label}`}
                            </p>
                        </div>
                    </div>
                </div>
                {renderModalView()}
            </React.Fragment>
        </div>
    );
}
PresentSelector.propTypes = {
    toolDefinitions: PropTypes.array.isRequired,
    toolDefinition: PropTypes.object.isRequired,
    setCurrentToolDefinition: PropTypes.func,
    isModifiedDefinition: PropTypes.bool.isRequired,
    shouldSaveToolpath: PropTypes.bool,
    saveToolPath: PropTypes.func,
    setCurrentValueAsProfile: PropTypes.func.isRequired
};

export default PresentSelector;
