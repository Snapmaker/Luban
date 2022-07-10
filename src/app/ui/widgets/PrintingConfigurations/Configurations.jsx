import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import { cloneDeep, includes, isNil, uniqWith } from 'lodash';
import modal from '../../../lib/modal';
import DefinitionCreator from '../../views/DefinitionCreator';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import Modal from '../../components/Modal';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import TipTrigger from '../../components/TipTrigger';
import { printingStore } from '../../../store/local-storage';

import Segmented from '../../components/Segmented/index';
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
/* eslint-disable import/no-cycle */
import ConfigValueBox from '../../views/ProfileManager/ConfigValueBox';
import styles from './styles.styl';
import { getPresetOptions } from '../../utils/profileManager';

const newKeys = cloneDeep(PRINTING_QUALITY_CONFIG_INDEX);
const DEFAULT_DISPLAY_TYPE = 'key-default_category-Default';
const CONFIG_DISPLAY_TYPES = ['Recommended', 'Customized'];
const CONFIG_DISPLAY_TYPES_OPTIONS = CONFIG_DISPLAY_TYPES.map((item) => {
    return { value: item, label: item };
});
function isOfficialDefinitionKey(key) {
    return includes(cloneDeep(PRINTING_QUALITY_CUSTOMIZE_FIELDS), key);
}
function calculateTextIndex(key) {
    return `${newKeys[key] * 20}px`;
}


export function ParamItem({ selectedDefinitionModel, allParams }) {
    const selectedDefinitionSettings = selectedDefinitionModel.settings;
    const dispatch = useDispatch();

    async function onChangeParam(newValue, paramSetting) {
        const actualOptions = paramSetting.affectByType ? paramSetting[selectedDefinitionModel.typeOfPrinting] : paramSetting.options;
        const findedAffect = actualOptions[newValue]?.affect;
        const changedSettingArray = [];
        Object.entries(findedAffect).forEach(([affectKey, affectValue]) => {
            selectedDefinitionModel.settings[
                affectKey
            ].default_value = affectValue;
            changedSettingArray.push([affectKey, affectValue]);
        });
        await dispatch(
            printingActions.updateCurrentDefinition({
                definitionModel: selectedDefinitionModel,
                managerDisplayType: PRINTING_MANAGER_TYPE_QUALITY,
                changedSettingArray
            })
        );
        dispatch(printingActions.destroyGcodeLine());
        dispatch(printingActions.displayModel());
    }
    return (
        <div>
            {Object.entries(allParams).map(([paramName, paramSetting]) => {
                const actualOptions = paramSetting.affectByType ? paramSetting[selectedDefinitionModel.typeOfPrinting] : paramSetting.options;
                const allParamsName = [];
                let SegmentedValue = null;
                const options = Object.entries(actualOptions).map(([keyName, keyValue]) => {
                    allParamsName.push(keyName);
                    return {
                        label: (
                            <span>{i18n._(keyValue.label)}</span>
                        ),
                        value: keyName
                    };
                });
                if (allParamsName.includes(paramSetting.current_value)) {
                    SegmentedValue = paramSetting.current_value;
                }
                const eachParamObject = selectedDefinitionSettings[paramName];
                // // TODO: add 'model_structure_type' select
                // if (paramName === 'infill_sparse_density') {
                //     eachParamObject = selectedDefinitionSettings['model_structure_type']
                // }
                return (
                    <div key={paramName} className="margin-vertical-16">
                        <div className="height-24 margin-bottom-4">
                            <SvgIcon
                                className="border-default-black-5 margin-right-8"
                                name="PrintingSettingNormal"
                                type={['static']}
                                size={24}
                                disabled
                            />
                            <span className="color-black-3">
                                {i18n._(eachParamObject?.label)}
                            </span>
                            <span className="float-r color-black-3">
                                {eachParamObject?.default_value}
                            </span>
                        </div>
                        <Segmented
                            options={options}
                            value={SegmentedValue}
                            onChange={(value) => { onChangeParam(value, paramSetting); }}
                        />
                    </div>
                );
            })}
        </div>
    );
}
ParamItem.propTypes = {
    selectedDefinitionModel: PropTypes.object,
    allParams: PropTypes.object
};


// {i18n._(`key-Printing/PrintingConfigurations-${optionItem.typeOfPrinting}`)}
function Configurations() {
    const [selectedDefinition, setSelectedDefinition] = useState(null);
    const [minimized, setMinimized] = useState(printingStore.get('printingSettingMinimized') || false);
    const [showCustomConfigPannel, setShowCustomConfigPannel] = useState(false);
    const [presetDisplayType, setPresetDisplayType] = useState();
    const [configDisplayType, setConfigDisplayType] = useState(printingStore.get('printingSettingDisplayType') || CONFIG_DISPLAY_TYPES[0]);
    const defaultQualityId = useSelector((state) => state?.printing?.defaultQualityId);
    const defaultMaterialId = useSelector((state) => state?.printing?.defaultMaterialId);
    const qualityDefinitionModels = useSelector((state) => state?.printing?.qualityDefinitions);

    let printingCustomConfigs = useSelector(
        (state) => state?.machine?.printingCustomConfigs
    );
    const toolHead = useSelector((state) => state?.machine?.toolHead);
    const [
        selectedSettingDefaultValue,
        setSelectedSettingDefaultValue
    ] = useState(null);
    const printingQualityConfigGroup = toolHead.printingToolhead === SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2
        ? PRINTING_QUALITY_CONFIG_GROUP_SINGLE
        : PRINTING_QUALITY_CONFIG_GROUP_DUAL;
    const refCreateModal = useRef(null);
    const dispatch = useDispatch();


    const presetOptionsObj = getPresetOptions(qualityDefinitionModels);

    const presetDisplayTypeOptions = Object.entries(presetOptionsObj).map(([key, item]) => {
        return { value: key, label: key, category: item.category, i18nCategory: item.i18nCategory };
    });

    const actions = {
        onChangeConfigDisplayType: (newDisplayType) => {
            setConfigDisplayType(newDisplayType);
            printingStore.set('printingSettingDisplayType', newDisplayType);
        },
        toggleMinimized: () => {
            const newMinimized = !minimized;
            setMinimized(newMinimized);
            printingStore.set('printingSettingMinimized', newMinimized);
        },
        onChangePresetDisplayType: (options) => {
            setPresetDisplayType(options.value);
            const firstDefinitionId = presetOptionsObj[options.value]?.options[0]?.definitionId;
            firstDefinitionId && actions.onSelectCustomDefinitionById(firstDefinitionId);
        },
        resetPreset: () => {
            setTimeout(() => {
                dispatch(
                    printingActions.resetDefinitionById(
                        'quality',
                        selectedDefinition?.definitionId
                    )
                );
            }, 50);
        },
        showInputModal: () => {
            const newSelectedDefinition = cloneDeep(selectedDefinition.getSerializableDefinition());
            const title = i18n._('key-Printing/ProfileManager-Copy Profile');
            const copyType = 'Item';

            const copyCategoryName = newSelectedDefinition.category | 'CUSTOM';
            const copyCategoryI18n = newSelectedDefinition.i18nCategory;
            const copyItemName = newSelectedDefinition.name;
            const isCreate = false;
            let materialOptions = presetDisplayTypeOptions
                .filter((option) => {
                    return option.category !== i18n._(DEFAULT_DISPLAY_TYPE);
                })
                .map(option => {
                    return {
                        label: option.category,
                        value: option.category,
                        i18n: option.i18nCategory
                    };
                });
            materialOptions = uniqWith(materialOptions, (a, b) => {
                return a.label === b.label;
            });

            const popupActions = modal({
                title: title,
                body: (
                    <React.Fragment>
                        <DefinitionCreator
                            managerType="quality"
                            isCreate={isCreate}
                            ref={refCreateModal}
                            materialOptions={materialOptions}
                            copyType={copyType}
                            copyCategoryName={copyCategoryName}
                            copyCategoryI18n={copyCategoryI18n}
                            copyItemName={copyItemName}
                        />
                    </React.Fragment>
                ),
                footer: (
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        onClick={async () => {
                            const data = refCreateModal.current.getData();
                            const newName = data.itemName;
                            popupActions.close();
                            newSelectedDefinition.category = data.categoryName === 'Default' ? 'Custom' : data.categoryName;
                            newSelectedDefinition.i18nCategory = data.categoryI18n;
                            newSelectedDefinition.name = newName;

                            // TODO: need update
                            await dispatch(
                                printingActions.duplicateDefinitionByType(
                                    'quality',
                                    newSelectedDefinition,
                                    undefined,
                                    newName
                                )
                            );
                        }}
                    >
                        {i18n._('key-Printing/ProfileManager-Save')}
                    </Button>
                )
            });
        },
        onShowMaterialManager: () => {
            dispatch(
                printingActions.updateManagerDisplayType(
                    PRINTING_MANAGER_TYPE_QUALITY
                )
            );
            dispatch(printingActions.updateShowPrintingManager(true));
        },
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
            selectedDefinition.settings[
                definitionKey
            ].default_value = value;
            const shouldUpdateIsOversteped = definitionKey === 'prime_tower_enable' && value === true;

            await dispatch(
                printingActions.updateCurrentDefinition({
                    definitionModel: selectedDefinition,
                    managerDisplayType: PRINTING_MANAGER_TYPE_QUALITY,
                    changedSettingArray: [[definitionKey, value]],
                    shouldUpdateIsOversteped
                })
            );

            // actions.onChangeSelectedDefinition(newDefinitionForManager);
            actions.displayModel();
        },
        /**
         * Select `definition`.
         *
         * @param definition
         */
        onSelectOfficialDefinition: (definition, shouldSaveEnv = true) => {
            actions.onChangeSelectedDefinition(definition);
            dispatch(printingActions.updateDefaultQualityId(definition.definitionId));
            shouldSaveEnv && dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
        },
        onSelectCustomDefinitionById: (definitionId) => {
            const definition = qualityDefinitionModels.find(d => d.definitionId === definitionId);
            actions.onSelectOfficialDefinition(definition);
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
    const renderProfileMenu = (displayType) => {
        const hasResetButton = displayType === i18n._(DEFAULT_DISPLAY_TYPE);
        return (
            <div>
                {hasResetButton && (
                    <Button
                        priority="level-two"
                        width="128px"
                        onClick={actions.resetPreset}
                    >
                        {i18n._('key-Printing/ProfileManager-Reset')}
                    </Button>
                )}
                <Button
                    priority="level-two"
                    width="128px"
                    onClick={actions.showInputModal}
                >
                    {i18n._('key-Printing/ProfileManager-Copy')}
                </Button>
            </div>
        );
    };
    useEffect(() => {
        // re-select definition based on new properties
        if (qualityDefinitionModels.length > 0) {
            const definition = qualityDefinitionModels.find(
                (d) => d.definitionId === defaultQualityId
            );
            if (!definition) {
                // definition no found, select first official definition
                actions.onSelectOfficialDefinition(qualityDefinitionModels[0], false);
                setPresetDisplayType(qualityDefinitionModels[0].category);
            } else {
                actions.onSelectOfficialDefinition(definition, false);
                setPresetDisplayType(definition.category);
            }
        }
    }, [defaultQualityId, qualityDefinitionModels]);

    useEffect(() => {
        console.log('defaultMaterialId');
    }, [defaultMaterialId]);
    if (!selectedDefinition) {
        return null;
    }
    return (
        <div>
            <div
                className={classNames(
                    'margin-top-16'
                )}
            >
                <Select
                    clearable={false}
                    size="328px"
                    options={presetDisplayTypeOptions}
                    value={presetDisplayType}
                    onChange={actions.onChangePresetDisplayType}
                />
                {presetDisplayType === i18n._(DEFAULT_DISPLAY_TYPE) && (
                    <div className={classNames(styles['preset-recommended'], 'sm-flex', 'margin-vertical-16', 'align-c', 'justify-space-between')}>
                        {presetOptionsObj[presetDisplayType].options.map((optionItem) => {
                            return (
                                <div
                                    key={optionItem.typeOfPrinting}
                                    className={classNames(
                                        selectedDefinition.typeOfPrinting === optionItem.typeOfPrinting ? styles.selected : styles.unselected,
                                    )}
                                >
                                    <Anchor
                                        onClick={() => actions.onSelectCustomDefinitionById(optionItem.definitionId)}
                                    >
                                        <div className={classNames(
                                            styles[`preset-recommended__icon-${optionItem.typeOfPrinting}`],
                                            styles['preset-recommended__icon']
                                        )}
                                        >
                                            <TipTrigger
                                                placement="bottom"
                                                style={{ maxWidth: '160px' }}
                                                content={renderProfileMenu(presetDisplayType)}
                                                trigger="click"
                                            >
                                                <SvgIcon
                                                    className={classNames(
                                                        styles['preset-hover'],
                                                    )}
                                                    type={['static']}
                                                    size={24}
                                                    name="PrintingSettingNormal"
                                                />
                                            </TipTrigger>
                                        </div>
                                    </Anchor>
                                    <span className="max-width-76 text-overflow-ellipsis-line-2 height-16 margin-top-4 margin-bottom-8">
                                        {optionItem.typeOfPrinting}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
                {presetDisplayType !== i18n._(DEFAULT_DISPLAY_TYPE) && (
                    <div className={classNames(styles['preset-customized'], 'margin-top-8')}>
                        {presetOptionsObj[presetDisplayType] && presetOptionsObj[presetDisplayType].options.map((optionItem) => {
                            return (
                                <div
                                    key={optionItem.i18nName || optionItem.name}
                                    className={classNames(
                                        optionItem.definitionId === selectedDefinition.definitionId ? styles.selected : null,
                                        'border-radius-4',
                                    )}
                                >
                                    <Anchor
                                        className={classNames(
                                            styles['preset-item'],
                                            'height-32',
                                            'display-block',
                                            'padding-left-8',
                                            'border-radius-4',
                                        )}
                                        onClick={() => actions.onSelectCustomDefinitionById(optionItem.definitionId)}
                                    >
                                        <span>
                                            {i18n._(optionItem.i18nName || optionItem.name)}
                                        </span>
                                        <TipTrigger
                                            placement="left"
                                            content={renderProfileMenu(presetDisplayType)}
                                            trigger="click"
                                        >
                                            <SvgIcon
                                                className={classNames(
                                                    styles['preset-hover'],
                                                    'float-right'
                                                )}
                                                type={['static']}
                                                size={24}
                                                name="PrintingSettingNormal"
                                            />
                                        </TipTrigger>
                                    </Anchor>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className={classNames(
                styles['divided-line'],
                'background-grey-1',
                minimized ? styles['opacity-1'] : styles['opacity-0']
            )}
            />
            <div className={classNames(styles['printing-settings-wrapper'], 'background-grey-1', 'margin-bottom-16')}>
                <div className={classNames(styles['printing-settings'], 'height-32', 'background-color-white', 'padding-horizontal-24')}>
                    <span className={classNames(styles['printing-settings-text'], 'align-c')}>
                        {i18n._('key-Printing/PrintingConfigurations-Printing Settings')}
                    </span>
                    <SvgIcon
                        title={minimized ? i18n._('key-Widget/CommonDropdownButton-Expand') : i18n._('key-Widget/CommonDropdownButton-Collapse')}
                        onClick={() => actions.toggleMinimized()}
                        name="DropdownLine"
                        size={24}
                        type={['static']}
                        className={classNames(
                            !minimized ? '' : 'rotate180'
                        )}
                    />
                </div>
            </div>
            {!minimized && (
                <div
                    className={classNames(
                        'sm-flex',
                        'margin-bottom-16',
                        'margin-top-negative-16'
                    )}
                >
                    <div
                        className={classNames(
                            'border-default-grey-1',
                            'border-radius-8',
                            'padding-bottom-16',
                            'padding-top-24',
                            'width-328',
                            'padding-horizontal-16',
                            // 'clearfix'
                        )}
                    >
                        <div className="margin-bottom-16 height-32 sm-flex justify-space-between">
                            <div className="display-inline-block">
                                <span className="color-black-5 margin-right-8">
                                    {i18n._(
                                        'key-Printing/PrintingConfigurations-Parameter Display'
                                    )}:
                                </span>
                                <Select
                                    clearable={false}
                                    style={{ border: 'none' }}
                                    size="100px"
                                    bordered={false}
                                    options={CONFIG_DISPLAY_TYPES_OPTIONS}
                                    value={configDisplayType}
                                    onChange={(options) => {
                                        actions.onChangeConfigDisplayType(options.value);
                                    }}
                                />
                            </div>
                            {configDisplayType === CONFIG_DISPLAY_TYPES[1] && (
                                <SvgIcon
                                    name="Manage"
                                    size={24}
                                    onClick={actions.toggleShowCustomConfigPannel}
                                />
                            )}
                        </div>
                        {configDisplayType === CONFIG_DISPLAY_TYPES[0] && (
                            <div>
                                <ParamItem
                                    selectedDefinitionModel={selectedDefinition}
                                    allParams={selectedDefinition.params}
                                />
                            </div>
                        )}
                        {configDisplayType === CONFIG_DISPLAY_TYPES[1] && (
                            <div className="overflow-y-auto height-max-400">
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
                        )}
                        <Anchor
                            className={classNames(
                                'link-text',
                                'float-r'
                            )}
                            onClick={actions.onShowMaterialManager}
                        >
                            {i18n._('key-Printing/PrintingConfigurations-More Parameters >')}
                        </Anchor>
                    </div>

                </div>
            )}
        </div>
    );
}
Configurations.propTypes = {
    // widgetActions: PropTypes.object
};
export default Configurations;
