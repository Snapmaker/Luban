import React, { useState, useEffect } from 'react';
// import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { isNull, cloneDeep } from 'lodash';
import i18n from '../../../lib/i18n';
import { actions as editorActions } from '../../../flux/editor';
import Anchor from '../../components/Anchor';
import modal from '../../../lib/modal';
import { Button } from '../../components/Buttons';
import { toHump, toLine } from '../../../../shared/lib/utils';
import ToolParameters from './cnc/ToolParameters';
import ToolSelector from './cnc/ToolSelector';
import { editorStore } from '../../../store/local-storage';

import {
    CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION,
    LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION,
    HEAD_CNC,
    HEAD_LASER
} from '../../../constants';
import PresentSelector from './laser/PresentSelector';

function ifDefinitionModified(activeToolListDefinition, currentToolDefinition) {
    return activeToolListDefinition?.settings && !Object.entries(activeToolListDefinition.settings).every(([key, setting]) => {
        if (!currentToolDefinition.settings[key]) {
            currentToolDefinition.settings[key] = {};
        }
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
        const pathType = gcodeConfig?.pathType;
        const allKeys = [];
        if (pathType === 'fill') {
            const movementMode = gcodeConfig?.movementMode;
            if (movementMode === 'greyscale-line') {
                allKeys.push(
                    'movementMode', 'fillInterval', 'workSpeed', 'fixedPower'
                );
            }
            if (movementMode === 'greyscale-dot') {
                allKeys.push(
                    'movementMode', 'fillInterval', 'dwellTime', 'fixedPower'
                );
            }
        } else {
            const multiPasses = gcodeConfig?.multiPasses;
            if (multiPasses === 1) {
                allKeys.push(
                    'workSpeed', 'multiPasses', 'fixedPower'
                );
            } else {
                allKeys.push(
                    'workSpeed', 'multiPasses', 'multiPassDepth', 'fixedPower'
                );
            }
        }
        return allKeys;
    }
    return [];
}


function ToolPathFastConfigurations({ setEditingToolpath, headType, toolpath }) {
    const activeMachine = useSelector(state => state.machine.activeMachine);
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
        if (value.definitionId) {
            editorStore.set(`${headType}LastDefinitionId`, value.definitionId);
        }
        if (value?.definitionId !== activeToolListDefinition?.definitionId) {
            await dispatch(editorActions.changeActiveToolListDefinition(headType, value?.definitionId, value?.name, true));
        }
        saveToolPath(value);
        dispatch(editorActions.refreshToolPathPreview(headType));
    }
    function handleSetEditingToolpath() {
        setEditingToolpath(toolPath);
    }
    const updateActiveToolDefinition = (currentToolPath) => {
        const { toolParams, gcodeConfig } = currentToolPath;
        const activeToolDefinition = cloneDeep(activeToolListDefinition);
        const oldTooldefinition = toolDefinitions?.find((d) => {
            return d.definitionId === toolParams.definitionId;
        });
        if (oldTooldefinition) {
            activeToolDefinition.definitionId = oldTooldefinition.definitionId;
            activeToolDefinition.name = oldTooldefinition.name;
            activeToolDefinition.category = oldTooldefinition.category;
            const newSettings = activeToolDefinition?.settings;
            if (headType === HEAD_CNC) {
                if (newSettings.angle) newSettings.angle.default_value = toolParams?.toolAngle;
                if (newSettings.diameter) newSettings.diameter.default_value = toolParams?.toolDiameter;
                if (newSettings.shaft_diameter) newSettings.shaft_diameter.default_value = toolParams?.toolShaftDiameter;
                if (newSettings.jog_speed) newSettings.jog_speed.default_value = gcodeConfig?.jogSpeed;
                if (newSettings.plunge_speed) newSettings.plunge_speed.default_value = gcodeConfig?.plungeSpeed;
                if (newSettings.work_speed) newSettings.work_speed.default_value = gcodeConfig?.workSpeed;
                if (newSettings.step_down) newSettings.step_down.default_value = gcodeConfig?.stepDown;
                if (newSettings.step_over) newSettings.step_over.default_value = gcodeConfig?.stepOver;
            }
            if (headType === HEAD_LASER) {
                if (newSettings.path_type) newSettings.path_type.default_value = gcodeConfig?.pathType;
                if (newSettings.movement_mode) newSettings.movement_mode.default_value = gcodeConfig?.movementMode;
                if (newSettings.direction) newSettings.direction.default_value = gcodeConfig?.direction;
                if (newSettings.fill_interval) newSettings.fill_interval.default_value = gcodeConfig?.fillInterval;
                if (newSettings.jog_speed) newSettings.jog_speed.default_value = gcodeConfig?.jogSpeed;
                if (newSettings.work_speed) newSettings.work_speed.default_value = gcodeConfig?.workSpeed;
                if (newSettings.dwell_time) newSettings.dwell_time.default_value = gcodeConfig?.dwellTime;
                if (newSettings.initial_height_offset) newSettings.initial_height_offset.default_value = gcodeConfig?.initialHeightOffset;
                if (newSettings.multi_passes) newSettings.multi_passes.default_value = gcodeConfig?.multiPasses;
                if (newSettings.multi_pass_depth) newSettings.multi_pass_depth.default_value = gcodeConfig?.multiPassDepth;
                if (newSettings.fixed_power) newSettings.fixed_power.default_value = gcodeConfig?.fixedPower;
                if (newSettings.fixed_min_power) newSettings.fixed_min_power.default_value = gcodeConfig?.fixedMinPower;
                if (newSettings.power_level_divisions) newSettings.power_level_divisions.default_value = gcodeConfig?.powerLevelDivisions;
                if (newSettings.auxiliary_air_pump) newSettings.auxiliary_air_pump.default_value = gcodeConfig?.auxiliaryAirPump;
                if (newSettings.half_diode_mode) newSettings.half_diode_mode.default_value = gcodeConfig?.halfDiodeMode;
                if (newSettings.constant_power_mode) newSettings.constant_power_mode.default_value = gcodeConfig?.constantPowerMode;
            }
        }
        if (currentToolDefinition?.definitionId !== activeToolDefinition?.definitionId) {
            dispatch(editorActions.changeActiveToolListDefinition(headType, activeToolDefinition?.definitionId, activeToolDefinition?.name));
        }
        setCurrentToolDefinition(activeToolDefinition);
    };

    useEffect(() => {
        setToolPath(toolpath);
        if (!isNull(toolpath)) {
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
                title: i18n._('key-unused-Create Profile'),
                body: (
                    <React.Fragment>
                        <p>{i18n._('key-unused-Enter Tool Name')}</p>
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
                        {i18n._('key-unused-OK')}
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
            return (activeToolListDefinition && currentToolDefinition) && ifDefinitionModified(activeToolListDefinition, currentToolDefinition);
        },
        onDuplicateToolNameDefinition: async (inputValue) => {
            const newToolDefinition = {
                ...currentToolDefinition,
                name: inputValue
            };
            await dispatch(editorActions.duplicateToolListDefinition(headType, newToolDefinition));
            await dispatch(editorActions.changeActiveToolListDefinition(headType, newToolDefinition.definitionId, newToolDefinition.name));
        },

        // only used in setting item
        // option has only one pair (key, value)
        updateGcodeConfig: (option) => {
            if (headType === HEAD_LASER) {
                // Movement Mode
                if (option.movementMode === 'greyscale-dot') {
                    option.dwellTime = 5;
                    option.fillInterval = 0.14;
                    option.jogSpeed = 3000;
                    // option.workSpeed = 2500;
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
                if (option.pathType === 'fill') {
                    option.fillInterval = 0.25;
                    option.jogSpeed = 3000;
                    option.workSpeed = 500;
                    option.fixedPower = 100;
                    option.multiPasses = 1;
                }
                if (option.pathType === 'path') {
                    option.jogSpeed = 3000;
                    option.workSpeed = 140;
                    option.multiPasses = 2;
                    option.multiPassDepth = 0.6;
                    option.fixedPower = 100;
                }

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
            allDefinition = cloneDeep(CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION);
        }
        if (headType === HEAD_LASER && activeToolListDefinition) {
            allDefinition = cloneDeep(LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION);
            if (activeMachine && activeMachine.metadata.size.z === 0) {
                if (allDefinition.multiPassDepth) {
                    delete allDefinition.multiPassDepth;
                }
            }
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
                    <span className="sm-flex-width main-text-normal">{i18n._('key-unused-General Parameters')}</span>
                </div>
                <div className="padding-horizontal-16">
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
                        {`${i18n._('key-unused-More')} >`}
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
