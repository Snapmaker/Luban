import React, { useEffect, useState } from 'react';
// import React, { useState, useEffect, useLayoutEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import modal from '../../../lib/modal';
import styles from './styles.styl';
import { PROCESS_MODE_VECTOR } from '../../../constants';
import {
    HEAD_CNC,
    HEAD_LASER,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2
} from '../../../constants/machines';
import i18n from '../../../lib/i18n';
import { actions as editorActions } from '../../../flux/editor';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import CncParameters from './cnc/CncParameters';
import { toHump } from '../../../../shared/lib/utils';
import LaserParameters from './laser/LaserParameters';
import { editorStore } from '../../../store/local-storage';

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
}

const ToolPathConfigurations: React.FC<ToolPathConfigurationsProps> = ({ toolpath, onClose, headType }) => {
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
    if (!toolPath) {
        return null;
    }
    const isModifiedDefinition = actions.checkIfDefinitionModified();
    return (
        <React.Fragment>
            <Modal
                className={classNames(styles['manager-body'])}
                style={{ width: '468px' }}
                size="lg"
                onClose={actions.cancelUpdateToolPath}
            >
                <Modal.Header>
                    {/* <Modal.Title> */}
                    {i18n._('key-unused-Toolpath Settings')}
                    {/* </Modal.Title> */}
                </Modal.Header>
                <Modal.Body style={{ height: '540px', overflow: 'initial' }}>
                    {headType === HEAD_CNC && (
                        <CncParameters
                            toolPath={toolPath}
                            setCurrentToolDefinition={(definition) => actions.setToolDefinitionAndRemember(definition)}
                            toolDefinitions={toolDefinitions}
                            isModifiedDefinition={isModifiedDefinition}
                            activeToolDefinition={currentToolDefinition}
                            updateToolPath={actions.updateToolPath}
                            updateToolConfig={actions.updateToolConfig}
                            setCurrentValueAsProfile={actions.setCurrentValueAsProfile}
                            updateGcodeConfig={actions.updateGcodeConfig}
                            isModel
                        />
                    )}
                    {headType === HEAD_LASER && (
                        <LaserParameters
                            toolPath={toolPath}
                            setCurrentToolDefinition={(definition) => actions.setToolDefinitionAndRemember(definition)}
                            toolDefinitions={toolDefinitions}
                            isModifiedDefinition={isModifiedDefinition}
                            activeToolDefinition={currentToolDefinition}
                            updateToolPath={actions.updateToolPath}
                            updateToolConfig={actions.updateToolConfig}
                            setCurrentValueAsProfile={actions.setCurrentValueAsProfile}
                            updateGcodeConfig={actions.updateGcodeConfig}
                            isModel
                        />
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        type="default"
                        onClick={actions.cancelUpdateToolPath}
                    >
                        {i18n._('key-unused-Cancel')}
                    </Button>
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        onClick={actions.saveToolPath}
                    >
                        {i18n._('key-unused-Save')}
                    </Button>
                </Modal.Footer>
            </Modal>
        </React.Fragment>
    );
};
ToolPathConfigurations.propTypes = {
    onClose: PropTypes.func,
    headType: PropTypes.string,
    toolpath: PropTypes.object.isRequired
};
export default ToolPathConfigurations;
