import React, { useState, useEffect } from 'react';
// import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import modal from '../../../lib/modal';
import styles from './styles.styl';
import { HEAD_CNC, HEAD_LASER } from '../../../constants';
import i18n from '../../../lib/i18n';
import { actions as editorActions } from '../../../flux/editor';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import CncParameters from './cnc/CncParameters';
import { toHump } from '../../../../shared/lib/utils';
import LaserParameters from './laser/LaserParameters';

function ToolPathConfigurations({ toolpath, onClose, headType }) {
    const toolDefinitions = useSelector(state => state[headType]?.toolDefinitions, shallowEqual);

    const dispatch = useDispatch();

    const [currentToolDefinition, setCurrentToolDefinition] = useState(toolDefinitions[0]);

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
            }
            if (headType === HEAD_LASER) {
                if (newSettings.path_type) newSettings.path_type.default_value = gcodeConfig?.pathType;
                if (newSettings.movement_mode) newSettings.movement_mode.default_value = gcodeConfig?.movementMode;
                if (newSettings.direction) newSettings.direction.default_value = gcodeConfig?.direction;
                if (newSettings.fill_interval) newSettings.fill_interval.default_value = gcodeConfig?.fillInterval;
                if (newSettings.jog_speed) newSettings.jog_speed.default_value = gcodeConfig?.jogSpeed;
                if (newSettings.work_speed) newSettings.work_speed.default_value = gcodeConfig?.workSpeed;
                if (newSettings.dwell_time) newSettings.dwell_time.default_value = gcodeConfig?.dwellTime;
                if (newSettings.multi_passes) newSettings.multi_passes.default_value = gcodeConfig?.multiPasses;
                if (newSettings.multi_pass_depth) newSettings.multi_pass_depth.default_value = gcodeConfig?.multiPassDepth;
                if (newSettings.fixed_power) newSettings.fixed_power.default_value = gcodeConfig?.fixedPower;
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
        updateToolConfig(key, value) {
            const newDefinition = _.cloneDeep(currentToolDefinition);
            newDefinition.settings[key].default_value = value;
            if (headType === HEAD_LASER) {
                // Movement Mode
                if (key === 'movement_mode' && value === 'greyscale-dot') {
                    newDefinition.settings.dwell_time.default_value = 5;
                    newDefinition.settings.fill_interval.default_value = 0.14;
                    newDefinition.settings.jog_speed.default_value = 2500;
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
            setCurrentToolDefinition(newDefinition);
        },
        checkIfDefinitionModified() {
            const oldTooldefinition = toolDefinitions.find((d) => {
                return d.definitionId === currentToolDefinition?.definitionId;
            });
            return oldTooldefinition?.settings && !Object.entries(oldTooldefinition.settings).every(([key, setting]) => {
                return currentToolDefinition && currentToolDefinition.settings[key] && currentToolDefinition.settings[key].default_value === setting.default_value;
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
                    // TODO
                    if (gcodeConfig.pathType === 'fill') {
                        gcodeConfig.multiPassEnabled = false;
                        gcodeConfig.multiPasses = 1;
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
                style={{ width: '468px', height: '660px', paddingBottom: '0px' }}
                size="lg"
                onClose={actions.cancelUpdateToolPath}
            >
                <Modal.Header>
                    {/* <Modal.Title> */}
                    {i18n._('key-unused-Toolpath Settings')}
                    {/* </Modal.Title> */}
                </Modal.Header>
                <Modal.Body>
                    {headType === HEAD_CNC && (
                        <CncParameters
                            toolPath={toolPath}
                            setCurrentToolDefinition={setCurrentToolDefinition}
                            toolDefinitions={toolDefinitions}
                            isModifiedDefinition={isModifiedDefinition}
                            activeToolDefinition={currentToolDefinition}
                            updateToolPath={actions.updateToolPath}
                            updateToolConfig={actions.updateToolConfig}
                            setCurrentValueAsProfile={actions.setCurrentValueAsProfile}
                            updateGcodeConfig={actions.updateGcodeConfig}
                        />
                    )}
                    {headType === HEAD_LASER && (
                        <LaserParameters
                            toolPath={toolPath}
                            setCurrentToolDefinition={setCurrentToolDefinition}
                            toolDefinitions={toolDefinitions}
                            isModifiedDefinition={isModifiedDefinition}
                            activeToolDefinition={currentToolDefinition}
                            updateToolPath={actions.updateToolPath}
                            updateToolConfig={actions.updateToolConfig}
                            setCurrentValueAsProfile={actions.setCurrentValueAsProfile}
                            updateGcodeConfig={actions.updateGcodeConfig}
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
}
ToolPathConfigurations.propTypes = {
    onClose: PropTypes.func,
    headType: PropTypes.string,
    toolpath: PropTypes.object.isRequired
};
export default ToolPathConfigurations;
