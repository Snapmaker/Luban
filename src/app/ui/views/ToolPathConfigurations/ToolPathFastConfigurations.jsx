import React, { useState, useEffect } from 'react';
// import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import i18n from '../../../lib/i18n';
import { actions as editorActions } from '../../../flux/editor';
import Anchor from '../../components/Anchor';
import modal from '../../../lib/modal';
import { Button } from '../../components/Buttons';
import { toHump, toLine } from '../../../../shared/lib/utils';
import ToolParameters from './cnc/ToolParameters';
import ToolSelector from './cnc/ToolSelector';

import {
    CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION,
    LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION,
    HEAD_CNC,
    HEAD_LASER
} from '../../../constants';
import PresentSelector from './laser/PresentSelector';

function ifDefinitionModified(activeToolListDefinition, currentToolDefinition) {
    return activeToolListDefinition.settings && !Object.entries(activeToolListDefinition.settings).every(([key, setting]) => {
        return currentToolDefinition && currentToolDefinition.settings[key].default_value === setting.default_value;
    });
}

function getFastEditSettingsKeys(toolPath) {
    const { headType, type: toolPathType, gcodeConfig } = toolPath;

    if (headType === HEAD_CNC) {
        if (toolPathType === 'vector') {
            return [
                'pathType', 'targetDepth', 'workSpeed', 'plungeSpeed', 'stepDown', 'stepOver'
            ];
        }
        if (toolPathType === 'image') {
            return [
                'targetDepth', 'workSpeed', 'plungeSpeed', 'stepDown', 'stepOver'
            ];
        }
        if (toolPathType === 'sculpt') {
            if (toolPath.materials.isRotate) {
                return [
                    'sliceMode', 'workSpeed', 'plungeSpeed', 'stepDown', 'stepOver'
                ];
            } else {
                return [
                    'targetDepth', 'workSpeed', 'plungeSpeed', 'stepDown', 'stepOver'
                ];
            }
        }
    }
    if (headType === HEAD_LASER) {
        if (toolPathType === 'vector') {
            const multiPasses = gcodeConfig?.multiPasses;
            const fillEnabled = gcodeConfig?.fillEnabled;
            // Todo
            const isMethodFill = (fillEnabled === 'true' || fillEnabled === true);

            if (isMethodFill) {
                return ['fillEnabled', 'fillInterval', 'workSpeed', 'fixedPower'];
            }
            if (multiPasses === 1) {
                return [
                    'fillEnabled', 'workSpeed', 'multiPasses', 'fixedPower'
                ];
            } else {
                return [
                    'fillEnabled', 'workSpeed', 'multiPasses', 'multiPassDepth', 'fixedPower'
                ];
            }
        }
        if (toolPathType === 'image') {
            const movementMode = gcodeConfig?.movementMode;
            if (movementMode === 'greyscale-line') {
                return [
                    'movementMode', 'fillInterval', 'workSpeed', 'fixedPower'
                ];
            }
            if (movementMode === 'greyscale-dot') {
                return [
                    'movementMode', 'fillInterval', 'dwellTime', 'fixedPower'
                ];
            }
        }
    }
    return [];
}


function ToolPathFastConfigurations({ setEditingToolpath, headType, toolpath }) {
    const activeToolListDefinition = useSelector(state => state[headType]?.activeToolListDefinition, shallowEqual);
    const toolDefinitions = useSelector(state => state[headType]?.toolDefinitions, shallowEqual);

    const dispatch = useDispatch();
    const [toolPath, setToolPath] = useState(toolpath);
    const [currentToolDefinition, setCurrentToolDefinition] = useState(activeToolListDefinition);
    const saveToolPath = async (toolDefinition) => {
        const toolParams = {};
        const gcodeConfig = {
            ...toolPath.gcodeConfig
        };
        if (toolDefinition) {
            toolParams.definitionId = toolDefinition.definitionId;
            toolParams.definitionName = toolDefinition.name;
            if (headType === HEAD_CNC) {
                toolParams.toolDiameter = toolDefinition.settings.diameter.default_value;
                toolParams.toolAngle = toolDefinition.settings.angle.default_value;
                toolParams.toolShaftDiameter = toolDefinition.settings.shaft_diameter.default_value;

                for (const key of Object.keys(toolDefinition.settings)) {
                    if (['diameter', 'angle', 'shaft_diameter'].includes(key)) {
                        continue;
                    }
                    gcodeConfig[toHump(key)] = toolDefinition.settings[key].default_value;
                }
            }
            if (headType === HEAD_LASER) {
                for (const key of Object.keys(toolDefinition.settings)) {
                    gcodeConfig[toHump(key)] = toolDefinition.settings[key].default_value;
                }
            }
        }


        const newToolPath = {
            ...toolPath,
            gcodeConfig,
            toolParams
        };
        setToolPath(newToolPath);
        await dispatch(editorActions.saveToolPath(headType, newToolPath));
    };
    async function handleSelectorChange(value) {
        setCurrentToolDefinition(value);
        if (value?.definitionId !== activeToolListDefinition?.definitionId) {
            await dispatch(editorActions.changeActiveToolListDefinition(headType, value?.definitionId, value?.name, true));
        }
        saveToolPath(value);
        dispatch(editorActions.refreshToolPathPreview(headType));
    }
    function handleSetEditingToolpath() {
        setEditingToolpath(toolPath);
    }
    const updateActiveToolDefinition = async (currentToolPath) => {
        const { toolParams, gcodeConfig } = currentToolPath;
        const activeToolDefinition = _.cloneDeep(activeToolListDefinition);

        const oldTooldefinition = toolDefinitions.find((d) => {
            return d.name === toolParams.definitionName;
        });
        if (oldTooldefinition) {
            activeToolDefinition.definitionId = oldTooldefinition.definitionId;
            activeToolDefinition.name = oldTooldefinition.name;
            if (headType === HEAD_CNC) {
                activeToolDefinition.settings.angle.default_value = toolParams?.toolAngle;
                activeToolDefinition.settings.diameter.default_value = toolParams?.toolDiameter;
                activeToolDefinition.settings.shaft_diameter.default_value = toolParams?.toolShaftDiameter;
                activeToolDefinition.settings.jog_speed.default_value = gcodeConfig?.jogSpeed;
                activeToolDefinition.settings.plunge_speed.default_value = gcodeConfig?.plungeSpeed;
                activeToolDefinition.settings.work_speed.default_value = gcodeConfig?.workSpeed;
                activeToolDefinition.settings.step_down.default_value = gcodeConfig?.stepDown;
                activeToolDefinition.settings.step_over.default_value = gcodeConfig?.stepOver;
            }
            if (headType === HEAD_LASER) {
                activeToolDefinition.settings.fill_enabled.default_value = gcodeConfig?.fillEnabled;
                activeToolDefinition.settings.movement_mode.default_value = gcodeConfig?.movementMode;
                activeToolDefinition.settings.direction.default_value = gcodeConfig?.direction;
                activeToolDefinition.settings.fill_interval.default_value = gcodeConfig?.fillInterval;
                activeToolDefinition.settings.jog_speed.default_value = gcodeConfig?.jogSpeed;
                activeToolDefinition.settings.work_speed.default_value = gcodeConfig?.workSpeed;
                activeToolDefinition.settings.dwell_time.default_value = gcodeConfig?.dwellTime;
                activeToolDefinition.settings.multi_passes.default_value = gcodeConfig?.multiPasses;
                activeToolDefinition.settings.multi_pass_depth.default_value = gcodeConfig?.multiPassDepth;
                activeToolDefinition.settings.fixed_power.default_value = gcodeConfig?.fixedPower;
            }
        }
        if (currentToolDefinition?.definitionId !== activeToolDefinition?.definitionId) {
            await dispatch(editorActions.changeActiveToolListDefinition(headType, activeToolDefinition?.definitionId, activeToolDefinition?.name));
        }
        setCurrentToolDefinition(activeToolDefinition);
    };

    useEffect(() => {
        setToolPath(toolpath);
        if (!_.isNull(toolpath)) {
            updateActiveToolDefinition(toolpath);
        }
    }, [toolpath]);

    const actions = {
        setCurrentValueAsProfile: () => {
            const activeToolDefinition = currentToolDefinition;
            const definitionsWithSameCategory = toolDefinitions.filter(d => d.category === activeToolDefinition.category);
            // make sure name is not repeated
            while (definitionsWithSameCategory.find(d => d.name === activeToolDefinition.name)) {
                activeToolDefinition.name = `#${activeToolDefinition.name}`;
            }

            const popupActions = modal({
                title: i18n._('Create Profile'),
                body: (
                    <React.Fragment>
                        <p>{i18n._('Enter Tool Name')}</p>
                    </React.Fragment>

                ),
                defaultInputValue: activeToolDefinition.name,
                footer: (
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        onClick={async () => {
                            await actions.onDuplicateToolNameDefinition(popupActions.getInputValue());
                            popupActions.close();
                        }}
                    >
                        {i18n._('OK')}
                    </Button>
                )
            });
        },
        updateToolConfig: async (settingName, value) => {
            const option = {};
            option[toHump(settingName)] = value;
            const newToolPath = {
                ...toolPath,
                gcodeConfig: {
                    ...toolPath.gcodeConfig,
                    ...option
                }
            };
            dispatch(editorActions.saveToolPath(headType, newToolPath));
            dispatch(editorActions.refreshToolPathPreview(headType));
        },
        checkIfDefinitionModified() {
            return ifDefinitionModified(activeToolListDefinition, currentToolDefinition);
        },
        onDuplicateToolNameDefinition: async (inputValue) => {
            const newToolDefinition = {
                ...currentToolDefinition,
                name: inputValue
            };
            await dispatch(editorActions.duplicateToolListDefinition(headType, newToolDefinition));
            await dispatch(editorActions.changeActiveToolListDefinition(headType, newToolDefinition.definitionId, newToolDefinition.name));
        },
        updateGcodeConfig: (option) => {
            if (headType === HEAD_LASER) {
                // Movement Mode
                if (option.movementMode === 'greyscale-dot') {
                    option.dwellTime = 5;
                    option.fillInterval = 0.14;
                    option.jogSpeed = 2500;
                    option.workSpeed = 2500;
                    option.fixedPower = 60;
                }
                if (option.movementMode === 'greyscale-line') {
                    option.direction = (!toolPath.materials?.isRotate ? 'Horizontal' : 'Vertical');
                    option.fillInterval = 0.25;
                    option.jogSpeed = 3000;
                    option.workSpeed = 500;
                    option.fixedPower = 100;
                }

                // Fill Enabled
                // if (option.fillEnabled === true) {
                //     option.fillInterval = 0.25;
                //     option.jogSpeed = 3000;
                //     option.workSpeed = 500;
                //     option.fixedPower = 100;
                // }
                // if (option.fillEnabled === false) {
                //     option.jogSpeed = 3000;
                //     option.workSpeed = 140;
                //     option.multiPasses = 2;
                //     option.multiPassDepth = 0.6;
                //     option.fixedPower = 100;
                // }

                // Fiexd Power Enabled
                if (option.fixedPower) {
                    option.fixedPowerEnabled = option.fixedPower > 0;
                }
            }
            const newToolPath = {
                ...toolPath,
                gcodeConfig: {
                    ...toolPath.gcodeConfig,
                    ...option
                }
            };
            // todo merge 'updateGcodeConfig' and 'updateToolConfig' function
            if (currentToolDefinition.settings) {
                let shouldUpdateDefinition = false;
                Object.entries(option).forEach(([itemKey, itemValue]) => {
                    const newKey = toLine(itemKey);
                    if (currentToolDefinition.settings[newKey]) {
                        shouldUpdateDefinition = true;
                        currentToolDefinition.settings[newKey].default_value = itemValue;
                    }
                });
                if (shouldUpdateDefinition) {
                    setCurrentToolDefinition(currentToolDefinition);
                }
            }

            dispatch(editorActions.saveToolPath(headType, newToolPath));
            dispatch(editorActions.refreshToolPathPreview(headType));
        }
    };
    if (!toolPath) {
        return null;
    }

    const fastEditSettings = {};
    if (toolPath) {
        const { gcodeConfig } = toolPath;
        let allDefinition = {};
        if (headType === HEAD_CNC && activeToolListDefinition) {
            allDefinition = _.cloneDeep(CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION);
        }
        if (headType === HEAD_LASER && activeToolListDefinition) {
            allDefinition = _.cloneDeep(LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION);
        }
        Object.keys(allDefinition).forEach((key) => {
            allDefinition[key].default_value = gcodeConfig[key];
            // isGcodeConfig is true means to use updateGcodeConfig, false means to use updateToolConfig
            allDefinition[key].isGcodeConfig = true;
        });
        const fastEditSettingsKeys = getFastEditSettingsKeys(toolPath);
        fastEditSettingsKeys.forEach((key) => {
            if (allDefinition[key]) {
                fastEditSettings[key] = allDefinition[key];
            }
        });
    }
    const isModifiedDefinition = actions.checkIfDefinitionModified();
    return (
        <React.Fragment>
            <div className={classNames(
                'border-default-grey-1',
                'margin-top-16',
                'border-radius-8',
                'clearfix'
            )}
            >
                <div className="sm-flex height-40 border-bottom-normal padding-horizontal-16">
                    <span className="sm-flex-width main-text-normal">{i18n._('General Parameters')}</span>
                </div>
                <div className="padding-horizontal-16 padding-vertical-16">
                    {toolPath.headType === HEAD_CNC && currentToolDefinition && (
                        <ToolSelector
                            toolDefinition={currentToolDefinition}
                            setCurrentToolDefinition={handleSelectorChange}
                            toolDefinitions={toolDefinitions}
                            isModifiedDefinition={isModifiedDefinition}
                            shouldSaveToolpath
                            saveToolPath={saveToolPath}
                            setCurrentValueAsProfile={actions.setCurrentValueAsProfile}
                        />
                    )}
                    {toolPath.headType === HEAD_LASER && currentToolDefinition && (
                        <PresentSelector
                            toolDefinition={currentToolDefinition}
                            setCurrentToolDefinition={handleSelectorChange}
                            toolDefinitions={toolDefinitions}
                            isModifiedDefinition={isModifiedDefinition}
                            shouldSaveToolpath
                            saveToolPath={saveToolPath}
                            setCurrentValueAsProfile={actions.setCurrentValueAsProfile}
                        />
                    )}
                    <ToolParameters
                        styleSize="middle"
                        settings={fastEditSettings}
                        updateToolConfig={actions.updateToolConfig}
                        updateGcodeConfig={actions.updateGcodeConfig}
                        toolPath={toolPath}
                    />
                    <Anchor
                        className={classNames(
                            'float-r',
                            'link-text',
                            'margin-bottom-16'
                        )}
                        onClick={handleSetEditingToolpath}
                    >
                        {`${i18n._('More')} >`}
                    </Anchor>
                </div>
            </div>
        </React.Fragment>
    );
}
ToolPathFastConfigurations.propTypes = {
    setEditingToolpath: PropTypes.func,
    headType: PropTypes.string,
    toolpath: PropTypes.object.isRequired
};
export default ToolPathFastConfigurations;
