import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import modal from '../../../lib/modal';
import styles from './styles.styl';
import { HEAD_CNC, HEAD_LASER } from '../../../constants';
import i18n from '../../../lib/i18n';
import { actions as editorActions } from '../../../flux/editor';
import { actions as cncActions } from '../../../flux/cnc';
import Modal from '../../components/Modal';
import CncParameters from './cnc/CncParameters';
import { toHump } from '../../../../shared/lib/utils';
import LaserParameters from './laser/LaserParameters';

function ToolPathConfigurations(props) {
    const activeToolListDefinition = useSelector(state => state[props.headType]?.activeToolListDefinition, shallowEqual);
    const toolpath = props.toolpath;
    const toolDefinitions = useSelector(state => state[props.headType]?.toolDefinitions, shallowEqual);

    const dispatch = useDispatch();

    const [currentToolDefinition, setCurrentToolDefinition] = useState(activeToolListDefinition);
    useEffect(() => {
        setCurrentToolDefinition(_.cloneDeep(activeToolListDefinition));
    }, [activeToolListDefinition]);

    const updateCncActiveToolDefinition = async (toolPath) => {
        const { toolParams, gcodeConfig } = toolPath;
        const activeToolDefinition = _.cloneDeep(activeToolListDefinition);

        const oldTooldefinition = toolDefinitions.find((d) => {
            return d.name === toolParams.definitionName && d.definitionId === toolParams.definitionId;
        });
        if (oldTooldefinition) {
            activeToolDefinition.definitionId = oldTooldefinition.definitionId;
            activeToolDefinition.name = oldTooldefinition.name;
            activeToolDefinition.settings.angle.default_value = toolParams?.toolAngle;
            activeToolDefinition.settings.diameter.default_value = toolParams?.toolDiameter;
            activeToolDefinition.settings.shaft_diameter.default_value = toolParams?.toolShaftDiameter;
            activeToolDefinition.settings.jog_speed.default_value = gcodeConfig?.jogSpeed;
            activeToolDefinition.settings.plunge_speed.default_value = gcodeConfig?.plungeSpeed;
            activeToolDefinition.settings.work_speed.default_value = gcodeConfig?.workSpeed;
            activeToolDefinition.settings.step_down.default_value = gcodeConfig?.stepDown;
            activeToolDefinition.settings.density.default_value = gcodeConfig?.density;
        }
        await dispatch(cncActions.changeActiveToolListDefinition(activeToolDefinition.definitionId, activeToolDefinition.name));
        setCurrentToolDefinition(activeToolDefinition);
    };

    const [toolPath, setToolPath] = useState(toolpath);
    useEffect(() => {
        const newToolPath = _.cloneDeep(toolpath);
        setToolPath(newToolPath);
        if (!_.isNull(toolpath) && props.headType === HEAD_CNC) {
            updateCncActiveToolDefinition(newToolPath);
        }
    }, [toolpath]);

    const actions = {
        updateToolConfig(key, value) {
            const newDefinition = _.cloneDeep(currentToolDefinition);
            newDefinition.settings[key].default_value = value;
            setCurrentToolDefinition(newDefinition);
        },
        checkIfDefinitionModified() {
            if (props.headType === HEAD_CNC) {
                return !Object.entries(activeToolListDefinition.settings).every(([key, setting]) => {
                    return currentToolDefinition && currentToolDefinition.settings[key].default_value === setting.default_value;
                });
            } else {
                return false;
            }
        },
        cancelUpdateToolPath() {
            props.onClose && props.onClose();
        },
        saveToolPath() {
            const toolParams = {};
            const gcodeConfig = {
                ...toolPath.gcodeConfig
            };

            if (currentToolDefinition) {
                toolParams.definitionId = currentToolDefinition.definitionId;
                toolParams.definitionName = currentToolDefinition.name;
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

            const newToolPath = {
                ...toolPath,
                gcodeConfig,
                toolParams
            };
            dispatch(editorActions.saveToolPath(props.headType, newToolPath));
            props.onClose && props.onClose();
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
            await dispatch(cncActions.duplicateToolListDefinition(newToolDefinition));
            await dispatch(cncActions.changeActiveToolListDefinition(newToolDefinition.definitionId, newToolDefinition.name));
        },
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
}
ToolPathConfigurations.propTypes = {
    onClose: PropTypes.func,
    headType: PropTypes.string,
    toolpath: PropTypes.object.isRequired

};
export default ToolPathConfigurations;
