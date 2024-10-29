import React, { useState, useEffect } from 'react';
import { connect, shallowEqual, useDispatch, useSelector } from 'react-redux';
import _, { includes } from 'lodash';

import { PROCESS_MODE_VECTOR } from '../../../../constants';

import {
    HEAD_CNC,
    HEAD_LASER,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2
} from '../../../../constants/machines';
// import i18n from '../../../../lib/i18n';
import { actions as editorActions } from '../../../../flux/editor';
import { toHump } from '../../../../../shared/lib/utils';

import { editorStore } from '../../../../store/local-storage';
import { L20WLaserToolModule, L40WLaserToolModule } from '../../../../machines/snapmaker-2-toolheads';

import GcodeParameters from '../../ToolPathConfigurations/laser/GcodeParameters';

// import modal from '../../../../lib/modal';

// import { Button } from '../../../components/Buttons';

function getDefaultDefinition(headType, laserToolHead, modelMode, toolDefinitions = []) {
    let res;
    const lastDefinitionId = editorStore.get(`${headType}LastDefinitionId`);
    if (headType === HEAD_LASER) {
        if (lastDefinitionId) {
            res = toolDefinitions.find(d => d?.definitionId === lastDefinitionId);
        } else if (laserToolHead === LEVEL_ONE_POWER_LASER_FOR_SM2) {
            if (modelMode === PROCESS_MODE_VECTOR) {
                res = toolDefinitions.find(d => d?.definitionId === 'basswood.cutting_1.5mm');
            } else {
                res = toolDefinitions.find(d => d?.definitionId === 'basswood.dot_filled_engraving');
            }
        } else if (laserToolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
            if (modelMode === PROCESS_MODE_VECTOR) {
                res = toolDefinitions.find(d => d?.definitionId === 'basswood.cutting_3mm');
            } else {
                res = toolDefinitions.find(d => d?.definitionId === 'basswood.dot_filled_engraving');
            }
        }
    } else {
        if (lastDefinitionId) {
            res = toolDefinitions.find(d => d?.definitionId === lastDefinitionId);
        }
    }
    if (!res) {
        res = toolDefinitions[0];
    }
    return res;
}
interface ToolPathConfigurationsProps {
    onClose: () => void;
    headType: string;
    toolpath: object;
    saveToolPathFlag: boolean;
    fixedPower: number,
    workSpeed: number;
}

const ToolPathConfig: React.FC<ToolPathConfigurationsProps> = (props) => {
    const needName = true;
    const { toolpath, onClose, headType, fixedPower, workSpeed } = props;
    const { activeMachine, toolHeadIdentifier } = props;

    const toolDefinitions = useSelector(state => state[headType]?.toolDefinitions, shallowEqual);
    const laserToolHead = useSelector(state => state?.machine?.toolHead?.laserToolhead, shallowEqual);
    const dispatch = useDispatch();

    const [currentToolDefinition, setCurrentToolDefinition] = useState(getDefaultDefinition(headType, laserToolHead, toolpath?.modelMode, toolDefinitions));

    /**
     *
     * @params {
     *     gcodeConfig: g-code config default value
     *     toolParams: toolPath's definition id and name
     * }
     **/
    const updateActiveToolDefinition = async (toolPath) => {
        const { toolParams, gcodeConfig } = toolPath;
        const activeToolDefinition = _.cloneDeep(currentToolDefinition);

        const oldTooldefinition = toolDefinitions?.find((d) => {
            return d.definitionId === toolParams.definitionId;
        });
        if (oldTooldefinition) {
            activeToolDefinition.definitionId = oldTooldefinition.definitionId;
            activeToolDefinition.name = oldTooldefinition.name;
            activeToolDefinition.category = oldTooldefinition.category;
            const newSettings = activeToolDefinition.settings;
            if (headType === HEAD_CNC) {
                if (newSettings.angle) newSettings.angle.default_value = toolParams?.toolAngle;
                if (newSettings.diameter) newSettings.diameter.default_value = toolParams?.toolDiameter;
                if (newSettings.shaft_diameter) newSettings.shaft_diameter.default_value = toolParams?.toolShaftDiameter;
                if (newSettings.jog_speed) newSettings.jog_speed.default_value = gcodeConfig?.jogSpeed;
                if (newSettings.plunge_speed) newSettings.plunge_speed.default_value = gcodeConfig?.plungeSpeed;
                if (newSettings.work_speed) newSettings.work_speed.default_value = gcodeConfig?.workSpeed;
                if (newSettings.step_down) newSettings.step_down.default_value = gcodeConfig?.stepDown;
                if (newSettings.step_over) newSettings.step_over.default_value = gcodeConfig?.stepOver;
                if (newSettings.tool_type) newSettings.tool_type.default_value = gcodeConfig?.toolType;
                if (newSettings.tool_extension_enabled) newSettings.tool_extension_enabled.default_value = gcodeConfig?.toolExtensionEnabled;
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
                if (newSettings.dot_with_compensation) newSettings.dot_with_compensation.default_value = gcodeConfig?.dotWithCompensation;
                if (newSettings.scanning_pre_accel_ratio) newSettings.scanning_pre_accel_ratio.default_value = gcodeConfig?.scanningPreAccelRatio;
                if (newSettings.scanning_offset) newSettings.scanning_offset.default_value = gcodeConfig?.scanningOffset;
            }
        }

        setCurrentToolDefinition(activeToolDefinition);
    };

    const [toolPath, setToolPath] = useState(toolpath);
    useEffect(() => {
        setToolPath(toolpath);
        if (!_.isNull(toolpath)) {
            updateActiveToolDefinition(toolpath);
        }
    }, [toolpath]);

    const actions = {
        setToolDefinitionAndRemember(definition) {
            setCurrentToolDefinition(definition);
            if (definition.definitionId) {
                editorStore.set(`${headType}LastDefinitionId`, definition.definitionId);
            }
        },
        updateToolConfig(key, value) {
            const newDefinition = _.cloneDeep(currentToolDefinition);
            newDefinition.settings[key].default_value = value;
            if (headType === HEAD_LASER) {
                // Movement Mode
                if (key === 'movement_mode' && value === 'greyscale-dot') {
                    newDefinition.settings.dwell_time.default_value = 5;
                    newDefinition.settings.direction.default_value = 'Horizontal';
                    newDefinition.settings.fill_interval.default_value = 0.14;
                    newDefinition.settings.jog_speed.default_value = 3000;
                    newDefinition.settings.work_speed.default_value = 2500;
                    newDefinition.settings.fixed_power.default_value = 60;
                }
                if (key === 'movement_mode' && value === 'greyscale-line') {
                    newDefinition.settings.direction.default_value = (!toolPath.materials?.isRotate ? 'Horizontal' : 'Vertical');
                    newDefinition.settings.fill_interval.default_value = 0.25;
                    newDefinition.settings.jog_speed.default_value = 3000;
                    newDefinition.settings.work_speed.default_value = 500;
                    newDefinition.settings.fixed_power.default_value = 100;
                }

                // Fill Enabled
                if (key === 'path_type' && value === 'fill') {
                    newDefinition.settings.fill_interval.default_value = 0.25;
                    newDefinition.settings.jog_speed.default_value = 3000;
                    newDefinition.settings.work_speed.default_value = 500;
                    newDefinition.settings.fixed_power.default_value = 100;
                    newDefinition.settings.multi_passes.default_value = 1;
                }
                if (key === 'path_type' && value === 'path') {
                    newDefinition.settings.jog_speed.default_value = 3000;
                    newDefinition.settings.work_speed.default_value = 140;
                    newDefinition.settings.multi_passes.default_value = 2;
                    newDefinition.settings.multi_pass_depth.default_value = 0.6;
                    newDefinition.settings.fixed_power.default_value = 100;
                    newDefinition.settings.movement_mode.default_value = 'greyscale-line';
                }

                // Fiexd Power Enabled
                if (key === 'fixed_power') {
                    if (value > 0) {
                        newDefinition.settings.fixed_power_enabled.default_value = true;
                    } else {
                        newDefinition.settings.fixed_power_enabled.default_value = false;
                    }
                }
            }
            actions.setToolDefinitionAndRemember(newDefinition);
        },
        checkIfDefinitionModified() {
            const oldTooldefinition = toolDefinitions.find((d) => {
                return d.definitionId === currentToolDefinition?.definitionId;
            });
            return oldTooldefinition?.settings && !Object.entries(oldTooldefinition.settings).every(([key, setting]) => {
                return currentToolDefinition
                    && currentToolDefinition.settings[key]
                    && currentToolDefinition.settings[key].default_value === setting.default_value;
            });
        },
        cancelUpdateToolPath() {
            onClose && onClose();
        },
        async saveToolPath() {
            const toolParams = {};
            const gcodeConfig = {
                ...toolPath.gcodeConfig
            };
            if (currentToolDefinition) {
                toolParams.definitionId = currentToolDefinition.definitionId;
                toolParams.definitionName = currentToolDefinition.name;
                if (headType === HEAD_CNC) {
                    toolParams.toolDiameter = currentToolDefinition.settings.diameter.default_value;
                    toolParams.toolAngle = currentToolDefinition.settings.angle.default_value;
                    toolParams.toolShaftDiameter = currentToolDefinition.settings.shaft_diameter.default_value;

                    for (const key of Object.keys(currentToolDefinition.settings)) {
                        if (['diameter', 'angle', 'shaft_diameter'].includes(key)) {
                            continue;
                        }
                        gcodeConfig[toHump(key)] = currentToolDefinition.settings[key].default_value;
                    }
                }
                if (headType === HEAD_LASER) {
                    for (const key of Object.keys(currentToolDefinition.settings)) {
                        gcodeConfig[toHump(key)] = currentToolDefinition.settings[key].default_value;
                    }
                    if (gcodeConfig.pathType === 'fill') {
                        gcodeConfig.multiPassEnabled = false;
                        gcodeConfig.multiPasses = 1;
                    } else {
                        gcodeConfig.multiPassEnabled = true;
                    }
                }
            }

            const newToolPath = {
                ...toolPath,
                gcodeConfig,
                toolParams
            };
            gcodeConfig.fixedPower = fixedPower;
            gcodeConfig.workSpeed = workSpeed;
            await dispatch(editorActions.saveToolPath(headType, newToolPath));
            await dispatch(editorActions.changeActiveToolListDefinition(headType, currentToolDefinition?.definitionId, currentToolDefinition?.name));
            await dispatch(editorActions.selectToolPathById(headType));
            await dispatch(editorActions.selectToolPathById(headType, toolpath?.id));

            dispatch(editorActions.refreshToolPathPreview(headType));
            onClose && onClose();
        },
        updateToolPath(option) {
            setToolPath({
                ...toolPath,
                ...option
            });
        },
        onDuplicateToolNameDefinition: async (inputValue) => {
            const newToolDefinition = {
                ...currentToolDefinition,
                name: inputValue
            };
            await dispatch(editorActions.duplicateToolListDefinition(headType, newToolDefinition));
        },
        setCurrentValueAsProfile: async (save) => {
            const activeToolDefinition = currentToolDefinition;
            const definitionsWithSameCategory = toolDefinitions.filter(d => d.category === activeToolDefinition.category);
            // make sure name is not repeated
            while (definitionsWithSameCategory.find(d => d.name === activeToolDefinition.name)) {
                activeToolDefinition.name = `#${activeToolDefinition.name}`;
            }
            if (save) {
                await actions.onDuplicateToolNameDefinition('1');
                // actions.cancelUpdateToolPath();
            } else {
                actions.cancelUpdateToolPath();
            }
        },
        updateGcodeConfig: (option) => {
            const nToolPath = {
                ...toolPath,
                gcodeConfig: {
                    ...toolPath.gcodeConfig,
                    ...option
                }
            };
            setToolPath(nToolPath);
        }
    };
    const updateGcodeConfig = (option) => {
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
        if (option.pathType === true) {
            option.fillInterval = 0.25;
            option.jogSpeed = 3000;
            option.workSpeed = 500;
            option.fixedPower = 100;
            option.multiPasses = 1;
        }
        if (option.pathType === false) {
            option.jogSpeed = 3000;
            option.workSpeed = 140;
            option.multiPasses = 2;
            option.multiPassDepth = 0.6;
            option.fixedPower = 100;
        }

        // Fiexd Power Enabled
        if (option.fixedPower && option.fixedPower > 0) {
            option.fixedPowerEnabled = true;
        } else {
            option.fixedPowerEnabled = false;
        }
        actions.updateGcodeConfig(option);
    };

    const isModifiedDefinition = actions.checkIfDefinitionModified();

    const zOffsetEnabled = activeMachine.metadata.size.z > 0;
    const halfDiodeModeEnabled = includes([L40WLaserToolModule.identifier], toolHeadIdentifier);
    const auxiliaryAirPumpEnabled = includes([L20WLaserToolModule.identifier, L40WLaserToolModule.identifier], toolHeadIdentifier);

    useEffect(() => {
        if (props.saveToolPathFlag) {
            actions.saveToolPath();
        }
    }, [props.saveToolPathFlag]);

    return (
        <>
            <div>
                <GcodeParameters
                    toolPath={toolPath}
                    activeToolDefinition={currentToolDefinition}
                    updateGcodeConfig={updateGcodeConfig}
                    updateToolConfig={actions.updateToolConfig}
                    toolDefinitions={toolDefinitions}
                    isModifiedDefinition={isModifiedDefinition}
                    setCurrentToolDefinition={setCurrentToolDefinition}
                    setCurrentValueAsProfile={actions.setCurrentValueAsProfile}
                    isModel
                    zOffsetEnabled={zOffsetEnabled}
                    halfDiodeModeEnabled={halfDiodeModeEnabled}
                    auxiliaryAirPumpEnabled={auxiliaryAirPumpEnabled}
                    noNeedName={needName}
                />
            </div>
        </>
    );
};

// export default ToolPathConfig;
const mapStateToProps = (state) => {
    const activeMachine = state.machine.activeMachine;
    const { multipleEngine, toolHead } = state.machine;
    const { materials } = state.laser;
    return {
        multipleEngine,
        materials,
        activeMachine,
        toolHeadIdentifier: toolHead.laserToolhead,
    };
};

export default connect(mapStateToProps, null)(ToolPathConfig);
