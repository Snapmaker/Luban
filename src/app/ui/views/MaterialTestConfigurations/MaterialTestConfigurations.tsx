import React, { useEffect, useState } from 'react';
// import React, { useState, useEffect, useLayoutEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import { Form } from 'antd';
import modal from '../../../lib/modal';
import styles from '../ToolPathConfigurations/styles.styl';

import {
    HEAD_LASER,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2
} from '../../../constants/machines';
import i18n from '../../../lib/i18n';
import { actions as editorActions } from '../../../flux/editor';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import { toHump } from '../../../../shared/lib/utils';
import MaterialTestParameters from './MaterialTestParameters';
import { editorStore } from '../../../store/local-storage';

function getDefaultDefinition(laserToolHead, toolDefinitions = []) {
    let res;
    const lastDefinitionId = editorStore.get(`${HEAD_LASER}LastDefinitionId`);
    // modelMode default is vector
    if (lastDefinitionId) {
        res = toolDefinitions.find(d => d?.definitionId === lastDefinitionId);
    } else if (laserToolHead === LEVEL_ONE_POWER_LASER_FOR_SM2) {
        res = toolDefinitions.find(d => d?.definitionId === 'basswood.cutting_1.5mm');
    } else if (laserToolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
        res = toolDefinitions.find(d => d?.definitionId === 'basswood.cutting_3mm');
    }
    if (!res) {
        res = toolDefinitions[0];
    }
    return res;
}

function getDefaultFormData() {
    const storeData = editorStore.get(`${HEAD_LASER}LastMaterialTest`);
    if (storeData) {
        return Object.fromEntries(Object.entries(JSON.parse(storeData)).map(([key, value]) => [key, Number(value)]));
    } else {
        return {
            rectRows: 10,
            speedMin: 600,
            speedMax: 18000,
            rectHeight: 5,
            rectCols: 10,
            powerMin: 10,
            powerMax: 100,
            rectWidth: 5,
        };
    }
}


interface MaterialTestConfigurationsProps {
    onClose: () => void;
}

const MaterialTestConfigurations: React.FC<MaterialTestConfigurationsProps> = ({ onClose }) => {
    const toolDefinitions = useSelector(state => state[HEAD_LASER]?.toolDefinitions, shallowEqual);
    const laserToolHead = useSelector(state => state?.machine?.toolHead?.laserToolhead, shallowEqual);
    const materials = useSelector(state => state[HEAD_LASER]?.materials, shallowEqual);
    const dispatch = useDispatch();

    const [currentToolDefinition, setCurrentToolDefinition] = useState(getDefaultDefinition(laserToolHead, toolDefinitions));

    /**
     *
     * @params {
     *     gcodeConfig: g-code config default value
     *     toolParams: toolPath's definition id and name
     * }
     **/
    const updateActiveToolDefinition = async (toolParams, gcodeConfig) => {
        const activeToolDefinition = _.cloneDeep(currentToolDefinition);

        const oldTooldefinition = toolDefinitions?.find((d) => {
            return d.definitionId === toolParams.definitionId;
        });
        if (oldTooldefinition) {
            activeToolDefinition.definitionId = oldTooldefinition.definitionId;
            activeToolDefinition.name = oldTooldefinition.name;
            activeToolDefinition.category = oldTooldefinition.category;
            const newSettings = activeToolDefinition.settings;
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
        setCurrentToolDefinition(activeToolDefinition);
    };

    const [toolParams, setToolParams] = useState({});
    const [gcodeConfig, setGcodeConfig] = useState({});
    const [formData, setFormData] = useState(getDefaultFormData());
    const [form] = Form.useForm();

    useEffect(() => {
        if (!_.isNull(toolParams) && !_.isNull(gcodeConfig)) {
            setToolParams(toolParams);
            setGcodeConfig(gcodeConfig);
            updateActiveToolDefinition(toolParams, gcodeConfig);
        }
    }, [toolParams, gcodeConfig]);
    useEffect(() => {
        if (formData) {
            form.setFieldsValue(formData);
        }
    }, [form, formData]);
    const saveFormData = (nFormData: any) => {
        setFormData(nFormData);
        editorStore.set(`${HEAD_LASER}LastMaterialTest`, JSON.stringify(nFormData));
    };

    const actions = {
        setToolDefinitionAndRemember(definition) {
            setCurrentToolDefinition(definition);
            if (definition.definitionId) {
                editorStore.set(`${HEAD_LASER}LastDefinitionId`, definition.definitionId);
            }
        },
        updateToolDefinition(key, value) {
            const newDefinition = _.cloneDeep(currentToolDefinition);
            newDefinition.settings[key].default_value = value;
            // Movement Mode
            if (key === 'movement_mode' && value === 'greyscale-dot') {
                newDefinition.settings.dwell_time.default_value = 5;
                newDefinition.settings.direction.default_value = 'Horizontal';
                newDefinition.settings.fill_interval.default_value = 0.14;
                newDefinition.settings.jog_speed.default_value = 3000;
            }
            if (key === 'movement_mode' && value === 'greyscale-line') {
                newDefinition.settings.direction.default_value = (!materials?.isRotate ? 'Horizontal' : 'Vertical');
                newDefinition.settings.fill_interval.default_value = 0.25;
                newDefinition.settings.jog_speed.default_value = 3000;
            }

            // Fill Enabled
            if (key === 'path_type' && value === 'fill') {
                newDefinition.settings.fill_interval.default_value = 0.25;
                newDefinition.settings.jog_speed.default_value = 3000;
                newDefinition.settings.multi_passes.default_value = 1;
            }
            if (key === 'path_type' && value === 'path') {
                newDefinition.settings.jog_speed.default_value = 3000;
                newDefinition.settings.multi_passes.default_value = 2;
                newDefinition.settings.multi_pass_depth.default_value = 0.6;
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
        cancel() {
            onClose && onClose();
        },
        async genSvgsAndToolPaths() {
            if (currentToolDefinition) {
                toolParams.definitionId = currentToolDefinition.definitionId;
                toolParams.definitionName = currentToolDefinition.name;
                for (const key of Object.keys(currentToolDefinition.settings)) {
                    gcodeConfig[toHump(key)] = currentToolDefinition.settings[key].default_value;
                }
                if (gcodeConfig.pathType === 'fill') {
                    gcodeConfig.multiPassEnabled = false;
                    gcodeConfig.multiPasses = 1;
                } else {
                    gcodeConfig.multiPassEnabled = true;
                }
                setToolParams(toolParams);
            }
            form.validateFields()
                .then((values) => {
                    const nFormData = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)]));
                    saveFormData(values); // 保存数据到 localStorage
                    dispatch(editorActions.createElementAndGenToolPath(HEAD_LASER, nFormData, gcodeConfig, toolParams));
                })
                .catch((error) => {
                    console.error('Validation Failed:', error);
                });
            onClose && onClose();
        },
        onDuplicateToolNameDefinition: async (inputValue) => {
            //TODO 复制,不关注
            const newToolDefinition = {
                ...currentToolDefinition,
                name: inputValue
            };
            await dispatch(editorActions.duplicateToolListDefinition(HEAD_LASER, newToolDefinition));
        },
        setCurrentValueAsProfile: () => {
            //TODO 不关注
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
            const nGcodeConfig = {
                ...gcodeConfig,
                ...option
            };
            setGcodeConfig(nGcodeConfig);
        }
    };

    const isModifiedDefinition = actions.checkIfDefinitionModified();
    return (
        <React.Fragment>
            <Modal
                className={classNames(styles['manager-body'])}
                style={{ width: '468px' }}
                size="lg"
                onClose={actions.cancel}
            >
                <Modal.Header>
                    {/* <Modal.Title> */}
                    {i18n._('key-Laser/MainToolBar-MaterialTesting')}
                    {/* </Modal.Title> */}
                </Modal.Header>
                <Modal.Body style={{ height: '540px', overflow: 'initial' }}>
                    <MaterialTestParameters
                        setCurrentToolDefinition={(definition) => actions.setToolDefinitionAndRemember(definition)}
                        gcodeConfig={gcodeConfig}
                        toolDefinitions={toolDefinitions}
                        isModifiedDefinition={isModifiedDefinition}
                        activeToolDefinition={currentToolDefinition}
                        updateToolConfig={actions.updateToolDefinition}
                        setCurrentValueAsProfile={actions.setCurrentValueAsProfile}
                        updateGcodeConfig={actions.updateGcodeConfig}
                        form={form}
                        isModel
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        type="default"
                        onClick={actions.cancel}
                    >
                        {i18n._('key-unused-Cancel')}
                    </Button>
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        onClick={actions.genSvgsAndToolPaths}
                    >
                        {i18n._('key-unused-Save')}
                    </Button>
                </Modal.Footer>
            </Modal>
        </React.Fragment>
    );
};
MaterialTestConfigurations.propTypes = {
    onClose: PropTypes.func
};
export default MaterialTestConfigurations;
