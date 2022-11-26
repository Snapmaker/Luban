import { Menu, Spin } from 'antd';
import classNames from 'classnames';
import { cloneDeep, find, isNil, uniqWith } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { KEY_DEFAULT_CATEGORY_CUSTOM, PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import { HEAD_PRINTING } from '../../../constants/machines';
import { PRESET_CATEGORY_DEFAULT, DEFAULT_PRESET_IDS } from '../../../constants/preset';

import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import { printingStore } from '../../../store/local-storage';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import Dropdown from '../../components/Dropdown';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import Tooltip from '../../components/Tooltip';
import { getPresetOptions } from '../../utils/profileManager';
import DefinitionCreator from '../../views/DefinitionCreator';
import ParamItem from '../../views/ParamItem';
import PrintingManager from '../../views/PrintingManager';
/* eslint-disable import/no-cycle */
import SettingItem from '../../views/ProfileManager/SettingItem';

import styles from './styles.styl';


const DEFAULT_DISPLAY_TYPE = 'key-default_category-Default';
const CONFIG_DISPLAY_TYPES = ['Recommended', 'Customized'];
const CONFIG_DISPLAY_TYPES_OPTIONS = CONFIG_DISPLAY_TYPES.map((item) => {
    return { value: item, label: `key-Printing/PrintingConfigurations-${item}` };
});


function checkIsAllDefault(definitionModelSettings, selectedModelDefaultSetting) {
    return Object.keys(definitionModelSettings).every((key) => {
        if (definitionModelSettings[key] && definitionModelSettings[key]?.enabled && selectedModelDefaultSetting[key]) {
            return definitionModelSettings[key].default_value === selectedModelDefaultSetting[key].default_value;
        } else {
            return true;
        }
    });
}


// {i18n._(`key-Printing/PrintingConfigurations-${optionItem.typeOfPrinting}`)}
function Configurations() {
    const defaultQualityId = useSelector((state) => state?.printing?.defaultQualityId);
    const qualityDefinitionModels = useSelector((state) => state?.printing?.qualityDefinitions);
    const printingCustomConfigsWithCategory = useSelector((state) => state?.machine?.printingCustomConfigsWithCategory);
    const refCreateModal = useRef(null);
    const dispatch = useDispatch();

    const [presetCategory, setPresetCategory] = useState(PRESET_CATEGORY_DEFAULT);
    const [selectedDefinition, setSelectedDefinition] = useState(null);
    const [initialized, setInitialized] = useState(false);
    const [configDisplayType, setConfigDisplayType] = useState(printingStore.get('printingSettingDisplayType') || CONFIG_DISPLAY_TYPES[0]);

    const [selectedSettingDefaultValue, setSelectedSettingDefaultValue] = useState(null);

    const presetOptionsObj = getPresetOptions(qualityDefinitionModels);

    const presetCategoryOptions = Object.entries(presetOptionsObj).map(([key, item]) => {
        return {
            value: key,
            label: key,
            category: item.category,
            i18nCategory: item.i18nCategory
        };
    });

    const i18nContent = {
        'quality.fast_print': i18n._('key-Luban/Preset/Prints in a fast mode. The printing time is short, but the outcome might be rough.'),
        'quality.normal_quality': i18n._('key-Luban/Preset/Prints with general settings. The printing outcome has a standard quality.'),
        'quality.normal_tpu_quality': i18n._('key-Luban/Preset/Prints with general settings. The printing outcome has a standard quality.'),
        'quality.normal_other_quality': i18n._('key-Luban/Preset/Prints with general settings. The printing outcome has a standard quality.'),
        'quality.high_quality': i18n._('key-Luban/Preset/Prints the surface of the model more meticulously. It takes longer  time but produces higher-quality surface for the print.'),
        'quality.engineering_print': i18n._('key-Luban/Preset/Enhances dimensional accuracy and overall strength of the model. It takes longer time, but produces robust prints with precise dimensions. This mode is suitable for printing precision machined parts.'),
    };

    const getPresetToolTip = (definitionId, name) => {
        return (
            <div className="padding-vertical-16 padding-horizontal-16">
                <div className="font-weight-bold padding-bottom-16 border-bottom-white">
                    {name}
                </div>
                <div className="margin-top-16">
                    {i18nContent[definitionId]}
                </div>
            </div>
        );
    };


    const actions = {
        getDefaultDefinition: (definitionId) => {
            return dispatch(printingActions.getDefaultDefinition(definitionId));
        },
        onChangeConfigDisplayType: (newDisplayType) => {
            setConfigDisplayType(newDisplayType);
            printingStore.set('printingSettingDisplayType', newDisplayType);
        },
        onChangePresetDisplayType: (options) => {
            setPresetCategory(options.value);
            const firstDefinitionId = presetOptionsObj[options.value]?.options[0]?.definitionId;
            firstDefinitionId && actions.onSelectCustomDefinitionById(firstDefinitionId);
        },
        resetPreset: () => {
            dispatch(
                printingActions.resetDefinitionById(
                    'quality',
                    selectedDefinition?.definitionId
                )
            );
        },
        showInputModal: () => {
            const newSelectedDefinition = cloneDeep(selectedDefinition.getSerializableDefinition());
            const title = i18n._('key-Printing/ProfileManager-Copy Profile');
            const copyType = 'Item';

            const copyCategoryName = (newSelectedDefinition.category !== i18n._(DEFAULT_DISPLAY_TYPE)) ? newSelectedDefinition.category : '';
            const copyCategoryI18n = newSelectedDefinition.i18nCategory;
            const copyItemName = newSelectedDefinition.name;
            const isCreate = false;
            let materialOptions = presetCategoryOptions
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
            if (materialOptions.length === 0) {
                materialOptions.push({
                    label: i18n._(KEY_DEFAULT_CATEGORY_CUSTOM),
                    value: i18n._(KEY_DEFAULT_CATEGORY_CUSTOM),
                    i18n: KEY_DEFAULT_CATEGORY_CUSTOM
                });
            }
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
                            if (data.categoryName === i18n._(KEY_DEFAULT_CATEGORY_CUSTOM)) {
                                newSelectedDefinition.category = '';
                                newSelectedDefinition.i18nCategory = '';
                            } else {
                                newSelectedDefinition.category = data.categoryName;
                                newSelectedDefinition.i18nCategory = data.categoryI18n;
                            }
                            newSelectedDefinition.name = newName;

                            // TODO: need update
                            const createdDefinitionModel = await dispatch(
                                printingActions.duplicateDefinitionByType(
                                    'quality',
                                    newSelectedDefinition,
                                    undefined,
                                    newName
                                )
                            );
                            actions.onSelectOfficialDefinition(createdDefinitionModel);
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
            dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_QUALITY));
            dispatch(printingActions.updateCustomMode(true));
            dispatch(printingActions.updateProfileParamsType(PRINTING_MANAGER_TYPE_QUALITY, 'custom'));
            dispatch(printingActions.updateShowPrintingManager(true));
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

            actions.onChangeSelectedDefinition(selectedDefinition);
            actions.displayModel();
        },
        updateActiveDefinition: (definition, shouldSaveEnv = true) => {
            dispatch(
                printingActions.updateCurrentDefinition(
                    definition,
                    PRINTING_MANAGER_TYPE_QUALITY
                )
            );
            shouldSaveEnv && dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
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
        },
    };

    /**
     * Preset operation menu.
     */
    const renderPresetMenu = () => {
        const isRecommended = selectedDefinition.isRecommended;
        let isAllValueDefault = true;
        if (isRecommended) {
            const selectedDefaultSetting = actions.getDefaultDefinition(selectedDefinition.definitionId);
            if (selectedDefaultSetting) {
                isAllValueDefault = checkIsAllDefault(selectedDefinition.settings, selectedDefaultSetting);
            }
        }
        return (
            <Menu>
                {isRecommended && !isAllValueDefault && (
                    <Menu.Item>
                        <Anchor onClick={actions.resetPreset}>
                            <div className="width-120 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Reset')}</div>
                        </Anchor>
                    </Menu.Item>
                )}
                <Menu.Item>
                    <Anchor onClick={actions.showInputModal}>
                        <div className="width-120 text-overflow-ellipsis">{i18n._('key-App/Menu-Copy')}</div>
                    </Anchor>
                </Menu.Item>
            </Menu>
        );
    };

    useEffect(() => {
        // re-select definition based on new properties
        if (qualityDefinitionModels.length > 0) {
            if (!initialized) {
                setInitialized(true);
            }
            const definition = qualityDefinitionModels.find(
                (d) => d.definitionId === defaultQualityId
            );
            if (!definition) {
                // definition no found, select first official definition
                actions.onSelectOfficialDefinition(qualityDefinitionModels[0], false);
                setPresetCategory(qualityDefinitionModels[0].category);
            } else {
                actions.onSelectOfficialDefinition(definition, false);
                setPresetCategory(definition.category);
            }
        }
    }, [defaultQualityId, qualityDefinitionModels]);

    if (!initialized) {
        return (
            <div className="height-528">
                <div className="text-align-center absolute-center">
                    <Spin />
                    <div>{i18n._('key-Workspace/Page-Loading...')}</div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="margin-top-16">
                <Select
                    clearable={false}
                    size="328px"
                    options={presetCategoryOptions}
                    value={presetCategory}
                    onChange={actions.onChangePresetDisplayType}
                />
                {
                    presetCategory === PRESET_CATEGORY_DEFAULT && (
                        <div className={classNames(styles['preset-recommended'], 'sm-flex', 'margin-vertical-16', 'align-c', 'justify-space-between')}>
                            {
                                DEFAULT_PRESET_IDS.map((presetId) => {
                                    const optionItem = find(presetOptionsObj[presetCategory].options, { definitionId: presetId });
                                    if (optionItem) {
                                        return (
                                            <div
                                                key={optionItem.typeOfPrinting}
                                                className={classNames(
                                                    selectedDefinition.typeOfPrinting === optionItem.typeOfPrinting ? styles.selected : styles.unselected,
                                                )}
                                            >
                                                <Tooltip
                                                    title={getPresetToolTip(optionItem?.definitionId, optionItem.name)}
                                                    zIndex={10}
                                                    placement="left"
                                                >
                                                    <Anchor onClick={() => actions.onSelectCustomDefinitionById(optionItem.definitionId)}>
                                                        <div
                                                            className={classNames(
                                                                styles['preset-recommended__icon'],
                                                                styles[`preset-recommended__icon-${optionItem.typeOfPrinting}`],
                                                            )}
                                                        >
                                                            <Dropdown
                                                                placement="bottomRight"
                                                                style={{ maxWidth: '160px' }}
                                                                overlay={renderPresetMenu(presetCategory)}
                                                                trigger={['click']}
                                                            >
                                                                <SvgIcon
                                                                    className={classNames(
                                                                        styles['preset-hover'],
                                                                    )}
                                                                    type={['static']}
                                                                    size={24}
                                                                    name="More"
                                                                />
                                                            </Dropdown>
                                                        </div>
                                                    </Anchor>
                                                </Tooltip>
                                                <span className="max-width-76 text-overflow-ellipsis-line-2 height-32-half-line margin-top-4 margin-bottom-8">
                                                    {optionItem.name}
                                                </span>
                                            </div>
                                        );
                                    } else {
                                        return null;
                                    }
                                })
                            }
                        </div>
                    )
                }
                {
                    presetCategory !== PRESET_CATEGORY_DEFAULT && (
                        <div className={classNames(styles['preset-customized'], 'margin-top-8')}>
                            {
                                presetOptionsObj[presetCategory] && presetOptionsObj[presetCategory].options.map((optionItem, index) => {
                                    return (
                                        <div
                                            key={(optionItem.i18nName + index) || (optionItem.name + index)}
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
                                                <Dropdown
                                                    placement="left"
                                                    className="display-inline float-right"
                                                    overlay={renderPresetMenu(presetCategory)}
                                                    trigger={['click']}
                                                >
                                                    <SvgIcon
                                                        className={classNames(
                                                            styles['preset-hover'],
                                                        )}
                                                        type={['static']}
                                                        size={24}
                                                        name="More"
                                                    />
                                                </Dropdown>
                                            </Anchor>

                                        </div>
                                    );
                                })
                            }
                        </div>
                    )
                }
            </div>
            <div className={classNames(styles['printing-settings-wrapper'], 'background-grey-1', 'margin-bottom-16')}>
                <div className={classNames(styles['printing-settings'], 'height-32', 'background-color-white', 'padding-horizontal-16')}>
                    <span className={classNames(styles['printing-settings-text'], 'align-c', 'white-space-nowrap')}>
                        {i18n._('key-Printing/PrintingConfigurations-Printing Settings')}
                    </span>
                </div>
            </div>
            <div className="margin-bottom-16 margin-top-16">
                <div
                    className={classNames(
                        'border-default-grey-1',
                        'border-radius-8',
                        'padding-top-24',
                        'padding-bottom-24',
                        'width-328',
                        'padding-horizontal-16',
                        // 'clearfix'
                    )}
                >
                    <div className="margin-bottom-16 height-32 sm-flex justify-space-between">
                        <div className="display-inline-block">
                            <span className="color-black-5 margin-right-8">
                                {i18n._('key-Printing/PrintingConfigurations-Parameter Display :')}
                            </span>
                            <Select
                                clearable={false}
                                style={{ border: 'none', width: '100px' }}
                                bordered={false}
                                options={CONFIG_DISPLAY_TYPES_OPTIONS}
                                value={configDisplayType}
                                onChange={(options) => {
                                    actions.onChangeConfigDisplayType(options.value);
                                }}
                            />
                        </div>
                        {
                            configDisplayType === CONFIG_DISPLAY_TYPES[1] && (
                                <SvgIcon
                                    name="Manage"
                                    size={24}
                                    onClick={actions.toggleShowCustomConfigPannel}
                                />
                            )
                        }
                    </div>
                    {
                        configDisplayType === CONFIG_DISPLAY_TYPES[0] && (
                            <div>
                                <ParamItem
                                    selectedDefinitionModel={selectedDefinition}
                                    onChangeDefinition={actions.onChangeDefinition}
                                    setSelectedDefinition={setSelectedDefinition}
                                />
                            </div>
                        )
                    }
                    {
                        configDisplayType === CONFIG_DISPLAY_TYPES[1] && (
                            <div className="overflow-y-auto height-max-400 margin-bottom-8">
                                {Object.keys(printingCustomConfigsWithCategory).map((category) => (
                                    <div key={category}>
                                        {printingCustomConfigsWithCategory[category].map(key => {
                                            return (
                                                <SettingItem
                                                    styleSize="middle"
                                                    settings={selectedDefinition?.settings}
                                                    definitionKey={key}
                                                    showTooltip
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
                                ))}
                                <PrintingManager />
                            </div>
                        )
                    }
                    <Anchor
                        className={classNames('link-text', 'float-r')}
                        onClick={actions.onShowMaterialManager}
                    >
                        {i18n._('key-Printing/PrintingConfigurations-More Parameters >')}
                    </Anchor>
                </div>
            </div>
        </div>
    );
}

Configurations.propTypes = {
    // widgetActions: PropTypes.object
};
export default Configurations;
