import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import modal from '../../lib/modal';
import styles from './styles.styl';
import { HEAD_CNC, HEAD_LASER } from '../../constants';
import i18n from '../../lib/i18n';
import { actions as editorActions } from '../../flux/editor';
import { actions as cncActions } from '../../flux/cnc';
import Modal from '../../components/Modal';
import CncParameters from './cnc/CncParameters';
import { toHump } from '../../../shared/lib/utils';
import LaserParameters from './laser/LaserParameters';

const ToolPathConfigurations = (props) => {
    const headTypeState = useSelector(state => state[props.headType]);
    const activeToolListDefinition = headTypeState?.activeToolListDefinition;
    const updatingToolPath = headTypeState?.updatingToolPath;
    const toolDefinitions = headTypeState?.toolDefinitions;
    const dispatch = useDispatch();

    const [currentToolDefinition, setCurrentToolDefinition] = useState(activeToolListDefinition);
    useEffect(() => {
        setCurrentToolDefinition(_.cloneDeep(activeToolListDefinition));
    }, [activeToolListDefinition]);

    const updateCncActiveToolDefinition = async (toolPath) => {
        const { toolParams, gcodeConfig } = toolPath;
        let activeToolDefinition = activeToolListDefinition;
        toolDefinitions.forEach((d) => {
            d.toolList.forEach((toolDefinition) => {
                const config = toolDefinition.config;
                if (config.diameter.default_value === toolParams.toolDiameter && config.angle.default_value === toolParams.toolAngle && config.shaft_diameter.default_value === toolParams.toolShaftDiameter) {
                    activeToolDefinition = { ...toolDefinition };
                    activeToolDefinition.definitionId = d.definitionId;
                    if (config.jog_speed.default_value !== gcodeConfig.jogSpeed) {
                        config.jog_speed.default_value = gcodeConfig.jogSpeed;
                    }
                    if (config.plunge_speed.default_value !== gcodeConfig.plungeSpeed) {
                        config.plunge_speed.default_value = gcodeConfig.plungeSpeed;
                    }
                    if (config.work_speed.default_value !== gcodeConfig.workSpeed) {
                        config.work_speed.default_value = gcodeConfig.workSpeed;
                    }
                    if (config.step_down.default_value !== gcodeConfig.stepDown) {
                        config.step_down.default_value = gcodeConfig.stepDown;
                    }
                    if (config.density.default_value !== gcodeConfig.density) {
                        config.density.default_value = gcodeConfig.density;
                    }
                }
            });
        });
        await dispatch(cncActions.changeActiveToolListDefinition(activeToolDefinition.definitionId, activeToolDefinition.name));
        setCurrentToolDefinition(activeToolDefinition);
    };

    const [toolPath, setToolPath] = useState(updatingToolPath);
    useEffect(() => {
        const newToolPath = _.cloneDeep(updatingToolPath);
        setToolPath(newToolPath);

        if (!_.isNull(updatingToolPath) && props.headType === HEAD_CNC) {
            updateCncActiveToolDefinition(newToolPath);
        }
    }, [updatingToolPath]);

    const actions = {
        updateToolConfig: (key, value) => {
            const newDefinition = _.cloneDeep(currentToolDefinition);
            newDefinition.config[key].default_value = value;
            setCurrentToolDefinition(newDefinition);
        },
        checkIfDefinitionModified() {
            if (props.headType === HEAD_CNC) {
                return !Object.entries(activeToolListDefinition.config).every(([key, setting]) => {
                    return currentToolDefinition && currentToolDefinition.config[key].default_value === setting.default_value;
                });
            } else {
                return false;
            }
        },
        cancelUpdateToolPath: () => {
            dispatch(editorActions.cancelUpdateToolPath(props.headType));
        },
        saveToolPath: () => {
            const toolParams = {};
            const gcodeConfig = {
                ...toolPath.gcodeConfig
            };

            if (currentToolDefinition) {
                toolParams.definitionId = currentToolDefinition.definitionId;
                toolParams.definitionName = currentToolDefinition.name;
                toolParams.toolDiameter = currentToolDefinition.config.diameter.default_value;
                toolParams.toolAngle = currentToolDefinition.config.angle.default_value;
                toolParams.toolShaftDiameter = currentToolDefinition.config.shaft_diameter.default_value;

                for (const key of Object.keys(currentToolDefinition.config)) {
                    if (['diameter', 'angle', 'shaft_diameter'].includes(key)) {
                        continue;
                    }
                    gcodeConfig[toHump(key)] = currentToolDefinition.config[key].default_value;
                }
            }

            const newToolPath = {
                ...toolPath,
                gcodeConfig,
                toolParams
            };
            dispatch(editorActions.saveToolPath(props.headType, newToolPath));
        },
        updateToolPath: (option) => {
            setToolPath({
                ...toolPath,
                ...option
            });
        },
        onDuplicateToolNameDefinition: async (inputValue) => {
            const activeToolCategory = toolDefinitions.find(d => d.definitionId === currentToolDefinition.definitionId) || toolDefinitions.find(d => d.definitionId === 'Default');
            const newToolDefinition = {
                ...currentToolDefinition,
                name: inputValue
            };
            await dispatch(cncActions.duplicateToolListDefinition(activeToolCategory, newToolDefinition));
            await dispatch(cncActions.changeActiveToolListDefinition(newToolDefinition.definitionId, newToolDefinition.name));
        },
        setCurrentValueAsProfile: () => {
            const activeToolDefinition = currentToolDefinition;
            const activeToolCategoryDefinition = toolDefinitions.find(d => d.definitionId === activeToolDefinition.definitionId);

            // make sure name is not repeated
            while (activeToolCategoryDefinition.toolList.find(d => d.name === activeToolDefinition.name)) {
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
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={async () => {
                            await actions.onDuplicateToolNameDefinition(popupActions.getInputValue());
                            popupActions.close();
                        }}
                    >
                        {i18n._('OK')}
                    </button>
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
        },
        updateCncActiveToolDefinition: async (updatingToolPath) => {
            const { toolDefinitions } = this.props;
            const { toolParams, gcodeConfig } = updatingToolPath;
            const activeToolDefinition = _.cloneDeep(this.props.activeToolListDefinition);
            toolDefinitions.forEach((d) => {
                if (d.definitionId === toolParams.definitionId) {
                    d.toolList.forEach((toolDefinition) => {
                        if (toolDefinition.name === toolParams.definitionName) {
                            activeToolDefinition.definitionId = d.definitionId;
                            activeToolDefinition.name = toolDefinition.name;
                            activeToolDefinition.config.angle.default_value = toolParams?.toolAngle;
                            activeToolDefinition.config.diameter.default_value = toolParams?.toolDiameter;
                            activeToolDefinition.config.shaft_diameter.default_value = toolParams?.toolShaftDiameter;
                            activeToolDefinition.config.jog_speed.default_value = gcodeConfig?.jogSpeed;
                            activeToolDefinition.config.plunge_speed.default_value = gcodeConfig?.plungeSpeed;
                            activeToolDefinition.config.work_speed.default_value = gcodeConfig?.workSpeed;
                            activeToolDefinition.config.step_down.default_value = gcodeConfig?.stepDown;
                            activeToolDefinition.config.density.default_value = gcodeConfig?.density;
                        }
                    });
                }
            });
            await this.props.changeActiveToolListDefinition(activeToolDefinition.definitionId, activeToolDefinition.name);
            this.setState({
                activeToolDefinition
            });
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
                    <Modal.Title>
                        {i18n._('Configurations')}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{
                    overflowY: 'auto',
                    height: '546px'
                }}
                >
                    {props.headType === HEAD_CNC && (
                        <CncParameters
                            toolPath={toolPath}
                            toolDefinitions={toolDefinitions}
                            isModifiedDefinition={isModifiedDefinition}
                            activeToolDefinition={currentToolDefinition}
                            updateToolPath={actions.updateToolPath}
                            updateToolConfig={actions.updateToolConfig}
                            setCurrentValueAsProfile={actions.setCurrentValueAsProfile}
                            updateGcodeConfig={actions.updateGcodeConfig}
                        />
                    )}
                    {props.headType === HEAD_LASER && (
                        <LaserParameters
                            toolPath={toolPath}
                            updateToolPath={actions.updateToolPath}
                            updateGcodeConfig={actions.updateGcodeConfig}
                        />
                    )}
                </Modal.Body>
                <Modal.Footer style={{
                    bottom: '0px',
                    position: 'absolute',
                    width: '100%'
                }}
                >
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={actions.cancelUpdateToolPath}
                    >
                        {i18n._('Cancel')}
                    </button>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={actions.saveToolPath}
                    >
                        {i18n._('Save')}
                    </button>
                </Modal.Footer>
            </Modal>
        </React.Fragment>
    );
};
ToolPathConfigurations.propTypes = {
    headType: PropTypes.string
};
export default ToolPathConfigurations;
