import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import classNames from 'classnames';
import { cloneDeep, includes, isNil } from 'lodash';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import i18n from '../../../lib/i18n';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import { actions as machineActions } from '../../../flux/machine';

import {
    HEAD_PRINTING,
    PRINTING_MANAGER_TYPE_QUALITY,
    PRINTING_QUALITY_CONFIG_INDEX,
    PRINTING_QUALITY_CUSTOMIZE_FIELDS,
    PRINTING_QUALITY_CONFIG_GROUP_DUAL,
    PRINTING_QUALITY_CONFIG_GROUP_SINGLE,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2
} from '../../../constants';
import SettingItem from '../../views/ProfileManager/SettingItem';
import ConfigValueBox from '../../views/ProfileManager/ConfigValueBox';
import styles from './styles.styl';
import { getSelectOptions } from '../../utils/profileManager';

const newKeys = cloneDeep(PRINTING_QUALITY_CONFIG_INDEX);
function isOfficialDefinitionKey(key) {
    return includes(cloneDeep(PRINTING_QUALITY_CUSTOMIZE_FIELDS), key);
}
function calculateTextIndex(key) {
    return `${newKeys[key] * 20}px`;
}
function Configurations({ widgetActions }) {
    const [
        selectedSettingDefaultValue,
        setSelectedSettingDefaultValue
    ] = useState(null);
    const [selectedDefinition, setSelectedDefinition] = useState(null);
    const [showCustomConfigPannel, setShowCustomConfigPannel] = useState(false);
    const qualityDefinitions = useSelector(
        (state) => state?.printing?.qualityDefinitions
    );
    const defaultQualityId = useSelector(
        (state) => state?.printing?.defaultQualityId,
        shallowEqual
    );
    let printingCustomConfigs = useSelector(
        (state) => state?.machine?.printingCustomConfigs
    );
    const toolHead = useSelector((state) => state?.machine?.toolHead);
    const printingQualityConfigGroup = toolHead.printingToolhead === SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2
        ? PRINTING_QUALITY_CONFIG_GROUP_SINGLE
        : PRINTING_QUALITY_CONFIG_GROUP_DUAL;
    const dispatch = useDispatch();

    const actions = {
        onChangeSelectedDefinition: (definition) => {
            if (definition) {
                setSelectedSettingDefaultValue(
                    dispatch(
                        printingActions.getDefaultDefinition(
                            definition.definitionId
                        )
                    )
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
        onChangeDefinition: async (definitionKey, value) => {
            if (isNil(value)) {
                // if 'value' does't exit, then reset this value
                value = dispatch(
                    printingActions.getDefaultDefinition(
                        selectedDefinition.definitionId
                    )
                )[definitionKey].default_value;
            }
            const newDefinitionForManager = cloneDeep(selectedDefinition);
            newDefinitionForManager.settings[
                definitionKey
            ].default_value = value;
            const shouldUpdateIsOversteped = definitionKey === 'prime_tower_enable' && value === true;

            await dispatch(
                printingActions.updateCurrentDefinition(
                    newDefinitionForManager,
                    PRINTING_MANAGER_TYPE_QUALITY,
                    undefined,
                    shouldUpdateIsOversteped
                )
            );

            actions.onChangeSelectedDefinition(newDefinitionForManager);
            actions.displayModel();
        },
        onShowMaterialManager: () => {
            dispatch(
                printingActions.updateManagerDisplayType(
                    PRINTING_MANAGER_TYPE_QUALITY
                )
            );
            dispatch(printingActions.updateShowPrintingManager(true));
        },
        updateActiveDefinition: (definition) => {
            dispatch(
                printingActions.updateCurrentDefinition(
                    definition,
                    PRINTING_MANAGER_TYPE_QUALITY
                )
            );
            dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
        },
        /**
         * Select `definition`.
         *
         * @param definition
         */
        onSelectDefinition: (definition) => {
            dispatch(
                printingActions.updateDefaultQualityId(definition.definitionId)
            );
            actions.onChangeSelectedDefinition(definition);
            actions.updateActiveDefinition(definition);
        },
        onSelectCustomDefinitionById: (definitionId) => {
            const definition = qualityDefinitions.find(
                (d) => d.definitionId === definitionId
            );
            actions.onSelectDefinition(definition);
            actions.displayModel();
        }
    };

    const onChangeCustomConfig = useCallback((key, value) => {
        if (value && !includes(printingCustomConfigs, key)) {
            printingCustomConfigs.push(key);
            printingCustomConfigs = [...printingCustomConfigs];
        } else if (!value) {
            printingCustomConfigs = printingCustomConfigs.filter(
                (a) => a !== key
            );
        }
        dispatch(
            machineActions.updatePrintingCustomConfigs(printingCustomConfigs)
        );
    }, []);

    useEffect(() => {
        widgetActions.setTitle(
            i18n._('key-Printing/PrintingConfigurations-Printing Settings')
        );
    }, [widgetActions]);

    useEffect(() => {
        // re-select definition based on new properties

        if (qualityDefinitions.length > 0) {
            const definition = qualityDefinitions.find(
                (d) => d.definitionId === defaultQualityId
            );
            if (!definition) {
                // definition no found, select first official definition
                actions.onSelectDefinition(qualityDefinitions[0]);
            } else {
                actions.onSelectDefinition(definition);
            }
        }
    }, [defaultQualityId, qualityDefinitions]);

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
            <div
                className={classNames(
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
            <div
                className={classNames(
                    'border-default-grey-1',
                    'border-radius-8',
                    'clearfix'
                )}
            >
                <div className="sm-flex height-40 border-bottom-normal padding-horizontal-16">
                    <span className="sm-flex-width main-text-normal">
                        {i18n._(
                            'key-Printing/PrintingConfigurations-General Parameters'
                        )}
                    </span>
                    <SvgIcon
                        name="Manage"
                        size={24}
                        onClick={actions.toggleShowCustomConfigPannel}
                    />
                </div>
                <div className="padding-horizontal-16 padding-vertical-8 overflow-y-auto height-max-400">
                    {printingCustomConfigs.map((key) => {
                        return (
                            <SettingItem
                                styleSize="middle"
                                settings={selectedDefinition?.settings}
                                definitionKey={key}
                                key={key}
                                onChangeDefinition={actions.onChangeDefinition}
                                isDefaultDefinition={
                                    selectedDefinition.isRecommended
                                }
                                defaultValue={{
                                    value:
                                        selectedSettingDefaultValue
                                        && selectedSettingDefaultValue[key]
                                            .default_value
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
                        {i18n._(
                            'key-Printing/PrintingConfigurations-Custom Parameter Visibility'
                        )}
                    </Modal.Header>
                    <Modal.Body>
                        <div className={classNames(styles['manager-content'])}>
                            <ConfigValueBox
                                calculateTextIndex={calculateTextIndex}
                                customConfigs={printingCustomConfigs}
                                definitionForManager={selectedDefinition}
                                optionConfigGroup={printingQualityConfigGroup}
                                isOfficialDefinitionKey={
                                    isOfficialDefinitionKey
                                }
                                type="checkbox"
                                onChangeDefinition={onChangeCustomConfig}
                                onResetDefinition={actions.onChangeDefinition}
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
                            {i18n._(
                                'key-Printing/PrintingConfigurations-Close'
                            )}
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
