import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import classNames from 'classnames';
import { cloneDeep, includes } from 'lodash';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import i18n from '../../../lib/i18n';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import { actions as machineActions } from '../../../flux/machine';

import { HEAD_PRINTING, PRINTING_MANAGER_TYPE_QUALITY, PRINTING_QUALITY_CONFIG_INDEX,
    PRINTING_QUALITY_CUSTOMIZE_FIELDS, PRINTING_QUALITY_CONFIG_GROUP } from '../../../constants';
import SettingItem from '../../views/ProfileManager/SettingItem';
import ConfigValueBox from '../../views/ProfileManager/ConfigValueBox';
import styles from './styles.styl';
import { getSelectOptions } from '../../utils/profileManager';

const newKeys = cloneDeep(PRINTING_QUALITY_CONFIG_INDEX);
const ALL_DEFAULT_DEFINITION_ID_ARRAY = ['material.pla', 'material.abs', 'material.petg', 'quality.fast_print', 'quality.normal_quality', 'quality.high_quality'];
function isOfficialDefinition(key) {
    return includes(cloneDeep(PRINTING_QUALITY_CUSTOMIZE_FIELDS), key);
}
function calculateTextIndex(key) {
    return `${newKeys[key] * 20}px`;
}
function Configurations({ widgetActions }) {
    const [selectedSettingDefaultValue, setSelectedSettingDefaultValue] = useState(null);
    const [selectedDefinition, setSelectedDefinition] = useState(null);
    const [showCustomConfigPannel, setShowCustomConfigPannel] = useState(false);
    const qualityDefinitions = useSelector(state => state?.printing?.qualityDefinitions);
    const defaultQualityId = useSelector(state => state?.printing?.defaultQualityId, shallowEqual);
    let printingCustomConfigs = useSelector(state => state?.machine?.printingCustomConfigs);
    const dispatch = useDispatch();

    const actions = {
        onChangeSelectedDefinition: (definition) => {
            if (definition) {
                setSelectedSettingDefaultValue(
                    dispatch(printingActions.getDefaultDefinition(definition.definitionId))
                );
                setSelectedDefinition(definition);
            }
        },
        toggleShowCustomConfigPannel: () => {
            setShowCustomConfigPannel(!showCustomConfigPannel);
        },
        closePannel: () => {
            setShowCustomConfigPannel(false);
        },
        displayModel: () => {
            dispatch(printingActions.destroyGcodeLine());
            dispatch(printingActions.displayModel());
        },
        onChangeDefinition: async (key, value) => {
            // const {} = this.state;
            const newDefinitionForManager = cloneDeep(selectedDefinition);
            newDefinitionForManager.settings[key].default_value = value;

            const newDefinitionSettings = {};
            newDefinitionSettings[key] = { 'default_value': value };

            await dispatch(printingActions.updateDefinitionSettings(selectedDefinition, newDefinitionSettings));
            await dispatch(printingActions.updateDefinitionsForManager(selectedDefinition.definitionId, 'quality'));

            actions.onChangeSelectedDefinition(newDefinitionForManager);
            actions.displayModel();
        },
        onResetDefinition: async (definitionKey) => {
            const value = dispatch(printingActions.getDefaultDefinition(selectedDefinition.definitionId))[definitionKey].default_value;
            const newDefinitionForManager = cloneDeep(selectedDefinition);
            newDefinitionForManager.settings[definitionKey].default_value = value;

            const newDefinitionSettings = {};
            newDefinitionSettings[definitionKey] = { 'default_value': value };

            await dispatch(printingActions.updateDefinitionSettings(selectedDefinition, newDefinitionSettings));
            await dispatch(printingActions.updateDefinitionsForManager(selectedDefinition.definitionId, 'quality'));

            actions.onChangeSelectedDefinition(newDefinitionForManager);
            actions.displayModel();
        },
        onShowMaterialManager: () => {
            dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_QUALITY));
            dispatch(printingActions.updateShowPrintingManager(true));
        },
        updateActiveDefinition: (definition) => {
            dispatch(printingActions.updateActiveDefinition(definition));
            dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
        },
        /**
         * Select `definition`.
         *
         * @param definition
         */
        onSelectOfficialDefinition: (definition) => {
            actions.onChangeSelectedDefinition(definition);
            dispatch(printingActions.updateDefaultQualityId(definition.definitionId));
            actions.updateActiveDefinition(definition);
        },
        onSelectCustomDefinitionById: (definitionId) => {
            const definition = qualityDefinitions.find(d => d.definitionId === definitionId);
            // has to update defaultQualityId
            dispatch(printingActions.updateDefaultQualityId(definitionId));
            actions.onSelectCustomDefinition(definition);
            actions.displayModel();
        },
        onSelectCustomDefinition: (definition) => {
            actions.onChangeSelectedDefinition(definition);
            actions.updateActiveDefinition(definition);
        }
    };

    const onChangeCustomConfig = useCallback((key, value) => {
        if (value && !includes(printingCustomConfigs, key)) {
            printingCustomConfigs.push(key);
            printingCustomConfigs = [...printingCustomConfigs];
        } else if (!value) {
            printingCustomConfigs = printingCustomConfigs.filter((a) => a !== key);
        }
        dispatch(machineActions.updatePrintingCustomConfigs(printingCustomConfigs));
    }, []);

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Printing/PrintingConfigurations-Printing Settings'));
    }, [widgetActions]);

    useEffect(() => {
        // re-select definition based on new properties

        if (qualityDefinitions.length > 0) {
            const definition = qualityDefinitions.find(d => d.definitionId === defaultQualityId);
            if (!definition) {
                // definition no found, select first official definition
                actions.onSelectOfficialDefinition(qualityDefinitions[0]);
            } else {
                actions.onSelectCustomDefinition(definition);
            }
        }
    }, [defaultQualityId, qualityDefinitions]);

    const isProfile = defaultQualityId
        && includes(ALL_DEFAULT_DEFINITION_ID_ARRAY, defaultQualityId);


    if (!selectedDefinition) {
        return null;
    }
    const toolDefinitionOptions = getSelectOptions(qualityDefinitions);
    const valueObj = {
        firstKey: 'definitionId',
        firstValue: selectedDefinition?.definitionId
    };
    return (
        <div>
            <div className={classNames(
                'sm-flex',
                'margin-bottom-16',
                'margin-top-8'
            )}
            >
                <Select
                    clearable={false}
                    isGroup
                    size="292px"
                    valueObj={valueObj}
                    options={toolDefinitionOptions}
                    value={selectedDefinition.definitionId}
                    onChange={(option) => {
                        actions.onSelectCustomDefinitionById(option.value);
                    }}
                />
                <SvgIcon
                    className="border-default-black-5 margin-left-4"
                    name="PrintingSettingNormal"
                    onClick={actions.onShowMaterialManager}
                    borderRadius={8}
                />
            </div>
            <div className={classNames(
                'border-default-grey-1',
                'border-radius-8',
                'clearfix'
            )}
            >
                <div className="sm-flex height-40 border-bottom-normal padding-horizontal-16">
                    <span className="sm-flex-width main-text-normal">{i18n._('key-Printing/PrintingConfigurations-General Parameters')}</span>
                    <SvgIcon
                        name="Manage"
                        size={24}
                        onClick={actions.toggleShowCustomConfigPannel}
                    />
                </div>
                <div className="padding-horizontal-16 padding-vertical-8 overflow-y-auto height-max-400">
                    { printingCustomConfigs.map((key) => {
                        return (
                            <SettingItem
                                styleSize="middle"
                                settings={selectedDefinition?.settings}
                                definitionKey={key}
                                key={key}
                                onChangeDefinition={actions.onChangeDefinition}
                                isDefaultDefinition={() => {
                                    return !isProfile;
                                }}
                                defaultValue={{
                                    value: selectedSettingDefaultValue && selectedSettingDefaultValue[key].default_value
                                }}
                            />
                        );
                    })}
                </div>

            </div>
            {showCustomConfigPannel && (
                <Modal
                    className={classNames(styles['manager-body'])}
                    style={{ minWidth: '700px' }}
                    onClose={actions.closePannel}
                >
                    <Modal.Header>
                        {i18n._('key-Printing/PrintingConfigurations-Custom Parameter Visibility')}
                    </Modal.Header>
                    <Modal.Body>
                        <div
                            className={classNames(styles['manager-content'])}
                        >
                            <ConfigValueBox
                                calculateTextIndex={calculateTextIndex}
                                customConfigs={printingCustomConfigs}
                                definitionForManager={selectedDefinition}
                                optionConfigGroup={PRINTING_QUALITY_CONFIG_GROUP}
                                isOfficialDefinition={isOfficialDefinition}
                                type="checkbox"
                                onChangeDefinition={onChangeCustomConfig}
                                onResetDefinition={actions.onResetDefinition}
                                showMiddle
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            onClick={actions.closePannel}
                            type="default"
                            width="96px"
                            priority="level-two"
                        >
                            {i18n._('key-Printing/PrintingConfigurations-Close')}
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}
        </div>
    );
}
Configurations.propTypes = {
    widgetActions: PropTypes.object
};
export default Configurations;
