import { Menu, Spin } from 'antd';
import classNames from 'classnames';
import { cloneDeep, find, isNil, uniqWith } from 'lodash';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
    KEY_DEFAULT_CATEGORY_CUSTOM,
    LEFT_EXTRUDER,
    PRINTING_MANAGER_TYPE_QUALITY,
    RIGHT_EXTRUDER
} from '../../../constants';
import { isDualExtruder } from '../../../constants/machines';
import { DEFAULT_PRESET_IDS, PRESET_CATEGORY_DEFAULT } from '../../../constants/preset';

import { RootState } from '../../../flux/index.def';
import { actions as printingActions } from '../../../flux/printing';
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
import ParametersQuickSettingsView from '../../views/PresetModifier/ParametersQuickSettingsView';
import PrintingManager from '../../views/PrintingManager';
import SettingItem from '../../views/ProfileManager/SettingItem';

import styles from './styles.styl';


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

/**
 * ConfigurationView is a minimized version of PresetModifier.
 */
const ConfigurationView: React.FC<{}> = () => {
    const dispatch = useDispatch();

    // machine
    const { toolHead: { printingToolhead } } = useSelector((state: RootState) => state.machine);
    const isDual = isDualExtruder(printingToolhead);

    const {
        // quality
        qualityDefinitions: qualityDefinitionModels,
        qualityDefinitionsRight: qualityDefinitionModelsRight,
        activePresetIds,

        // material
        materialDefinitions,
        defaultMaterialId,
        defaultMaterialIdRight,
    } = useSelector((state: RootState) => state.printing);

    const printingCustomConfigsWithCategory = useSelector((state: RootState) => state?.machine?.printingCustomConfigsWithCategory);

    const refCreateModal = useRef(null);

    // stack
    const [selectedStackId, setSelectedStackId] = useState(LEFT_EXTRUDER);
    // preset model
    const [selectedPresetModel, setSelectedPresetModel] = useState(null);

    // preset category to display (for selection)
    const [selectedPresetCategory, setSelectedPresetCategory] = useState(PRESET_CATEGORY_DEFAULT);
    // display
    const [configDisplayType, setConfigDisplayType] = useState(printingStore.get('printingSettingDisplayType') || CONFIG_DISPLAY_TYPES[0]);

    const [selectedSettingDefaultValue, setSelectedSettingDefaultValue] = useState(null);

    // UI state
    const [initialized, setInitialized] = useState(false);

    const materialPreset = materialDefinitions.find(p => p.definitionId === defaultMaterialId);
    const materialPresetRight = materialDefinitions.find(p => p.definitionId === defaultMaterialIdRight);

    let presetOptionsObj;
    if (selectedStackId === LEFT_EXTRUDER) {
        presetOptionsObj = getPresetOptions(qualityDefinitionModels, materialPreset);
    } else {
        presetOptionsObj = getPresetOptions(qualityDefinitionModelsRight, materialPresetRight);
    }

    const presetCategoryOptions = Object.values(presetOptionsObj).map((item) => {
        return {
            // @ts-ignore
            value: item.category,
            // @ts-ignore
            label: item.category,
            // @ts-ignore
            category: item.category,
            // @ts-ignore
            i18nCategory: item.i18nCategory
        };
    });

    /**
     * Select stack for display.
     *
     * @param {string} stackId - stack ID
     */
    const selectStack = useCallback((stackId: string): void => {
        if ([LEFT_EXTRUDER, RIGHT_EXTRUDER].includes(stackId)) {
            setSelectedStackId(stackId);
        }
    }, []);


    const displayModel = () => {
        dispatch(printingActions.destroyGcodeLine());
        dispatch(printingActions.displayModel());
    };

    /**
     * Change quality preset.
     *
     * @param stackId
     * @param presetModel
     */
    const onChangePreset = (stackId, presetModel) => {
        if (presetModel) {
            dispatch(printingActions.updateActiveQualityPresetId(stackId, presetModel.definitionId));
            displayModel();
        }
    };

    // TODO: Move this logic to flux?
    useEffect(() => {
        // re-select definition based on new properties
        if (!initialized) {
            if (qualityDefinitionModels.length > 0) {
                setInitialized(true);
            }
        }
    }, [qualityDefinitionModels]);

    // Update preset model
    useEffect(() => {
        const presetId = activePresetIds[selectedStackId];

        const allModels = selectedStackId === LEFT_EXTRUDER ? qualityDefinitionModels : qualityDefinitionModelsRight;
        const presetModel = allModels.find(p => p.definitionId === presetId);

        // Update currently selected preset model
        if (presetModel) {
            setSelectedPresetModel(presetModel);

            const defaultSettings = dispatch(printingActions.getDefaultDefinition(presetModel.definitionId));
            setSelectedSettingDefaultValue(defaultSettings);

            setSelectedPresetCategory(presetModel.category);

            // refresh the scene on preset model changed
            displayModel();
        }
    }, [selectedStackId, activePresetIds, qualityDefinitionModels, qualityDefinitionModelsRight]);


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

        /**
         * Change selected preset category, and then select one of the presets.
         *
         * @param option
         */
        onChangeSelectedPresetCategory: (option) => {
            setSelectedPresetCategory(option.value);

            const firstOption = presetOptionsObj[option.value].options[0];
            if (firstOption) {
                actions.onChangePresetById(firstOption.definitionId);
            }
        },
        resetPreset: () => {
            dispatch(
                printingActions.resetDefinitionById(
                    'quality',
                    selectedPresetModel?.definitionId
                )
            );
        },
        showInputModal: () => {
            const newSelectedDefinition = cloneDeep(selectedPresetModel.getSerializableDefinition());
            const title = i18n._('key-Printing/ProfileManager-Copy Profile');
            const copyType = 'Item';

            const copyCategoryName = newSelectedDefinition.category !== PRESET_CATEGORY_DEFAULT ? newSelectedDefinition.category : '';
            const copyItemName = newSelectedDefinition.name;
            const isCreate = false;
            let materialOptions = presetCategoryOptions
                .filter((option) => {
                    return option.category !== PRESET_CATEGORY_DEFAULT;
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

                            newSelectedDefinition.name = newName;
                            newSelectedDefinition.category = data.categoryName;

                            // TODO: need update
                            const createdDefinitionModel = await dispatch(
                                printingActions.duplicateDefinitionByType(
                                    'quality',
                                    newSelectedDefinition,
                                    undefined,
                                    newName
                                )
                            );
                            onChangePreset(selectedStackId, createdDefinitionModel);
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

        toggleShowCustomConfigPannel: () => {
            dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_QUALITY));
            dispatch(printingActions.updateCustomMode(true));
            dispatch(printingActions.updateProfileParamsType(PRINTING_MANAGER_TYPE_QUALITY, 'custom'));
            dispatch(printingActions.updateShowPrintingManager(true));
        },

        /**
         * Change quality preset by preset id.
         *
         * @param presetId
         */
        onChangePresetById: (presetId) => {
            const presetModel = qualityDefinitionModels.find(d => d.definitionId === presetId);
            onChangePreset(selectedStackId, presetModel);
        },

        /**
         * Change quality preset settings.
         *
         * @param {string} key
         * @param {any} value
         */
        onChangePresetSettings: async (key: string, value: any) => {
            console.log('change settings', key, value);
            if (isNil(value)) {
                // if 'value' does't exit, then reset this value
                const defaultPresetSettings = dispatch(printingActions.getDefaultDefinition(selectedPresetModel.definitionId));
                value = defaultPresetSettings[key].default_value;
            }
            selectedPresetModel.settings[key].default_value = value;

            await dispatch(
                printingActions.updateCurrentDefinition({
                    managerDisplayType: PRINTING_MANAGER_TYPE_QUALITY,
                    direction: selectedStackId,
                    definitionModel: selectedPresetModel,
                    changedSettingArray: [[key, value]],
                })
            );

            // actions.onChangeSelectedDefinition(selectedPreset); // Is this needed?
            displayModel();
        },
    };

    /**
     * Preset operation menu.
     */
    const renderPresetMenu = () => {
        const isRecommended = selectedPresetModel.isRecommended;
        let isAllValueDefault = true;
        if (isRecommended) {
            const selectedDefaultSetting = actions.getDefaultDefinition(selectedPresetModel.definitionId);
            if (selectedDefaultSetting) {
                isAllValueDefault = checkIsAllDefault(selectedPresetModel.settings, selectedDefaultSetting);
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

    if (!initialized) {
        return (
            <div className="configuration-view height-528 position-re">
                <div className="text-align-center absolute-center">
                    <Spin />
                    <div>{i18n._('key-Workspace/Page-Loading...')}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="configuration-view">
            {/* Stack Selection */}
            {
                isDual && (
                    // add negative margin to cancel out padding of widget container
                    <div
                        className="height-40 border-bottom-normal"
                        style={{
                            marginLeft: '-16px',
                            marginRight: '-16px',
                        }}
                    >
                        <div className="sm-flex justify-space-around padding-horizontal-16">
                            <Anchor
                                className={classNames(
                                    'display-block height-40',
                                    {
                                        'border-bottom-black-3 font-weight-bold': selectedStackId === LEFT_EXTRUDER,
                                    }
                                )}
                                onClick={() => selectStack(LEFT_EXTRUDER)}
                            >
                                <span className="display-block height-40 font-size-middle">
                                    <SvgIcon
                                        name="Information"
                                        size={24}
                                        type={['static']}
                                    />
                                    {i18n._('Left Extruder')}
                                </span>
                            </Anchor>
                            <Anchor
                                className={classNames(
                                    'display-block height-40',
                                    {
                                        'border-bottom-black-3 font-weight-bold': selectedStackId === RIGHT_EXTRUDER,
                                    }
                                )}
                                onClick={() => selectStack(RIGHT_EXTRUDER)}
                            >
                                <span className="display-block height-40 font-size-middle">
                                    {i18n._('Right Extruder')}
                                </span>
                            </Anchor>
                        </div>
                    </div>
                )
            }
            {/* Preset Selection */}
            <div className="margin-top-16">
                <Select
                    clearable={false}
                    size="328px"
                    options={presetCategoryOptions}
                    value={selectedPresetCategory}
                    onChange={actions.onChangeSelectedPresetCategory}
                />
                {
                    selectedPresetCategory === PRESET_CATEGORY_DEFAULT && (
                        <div className={classNames(styles['preset-recommended'], 'sm-flex', 'margin-vertical-16', 'align-c', 'justify-space-between')}>
                            {
                                DEFAULT_PRESET_IDS.map((presetId) => {
                                    const options = presetOptionsObj[selectedPresetCategory].options;
                                    if (!options) {
                                        return null;
                                    }

                                    const optionItem = find(options, { definitionId: presetId });
                                    if (!optionItem) {
                                        return null;
                                    }

                                    const isSelected = selectedPresetModel && selectedPresetModel.definitionId === optionItem.definitionId;
                                    // selectedPresetModel && selectedPresetModel.typeOfPrinting === optionItem.typeOfPrinting ?

                                    return (
                                        <div
                                            key={optionItem.typeOfPrinting}
                                            className={classNames({
                                                [styles.selected]: isSelected,
                                                [styles.unselected]: !isSelected,
                                            })}
                                        >
                                            <Tooltip
                                                title={getPresetToolTip(optionItem?.definitionId, optionItem.name)}
                                                zIndex={10}
                                                placement="left"
                                            >
                                                <Anchor onClick={() => actions.onChangePresetById(optionItem.definitionId)}>
                                                    <div
                                                        className={classNames(
                                                            styles['preset-recommended__icon'],
                                                            styles[`preset-recommended__icon-${optionItem.typeOfPrinting}`],
                                                        )}
                                                    >
                                                        {
                                                            isSelected && (
                                                                <Dropdown
                                                                    placement="bottomRight"
                                                                    style={{ maxWidth: '160px' }}
                                                                    overlay={renderPresetMenu(selectedPresetCategory)}
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
                                                            )
                                                        }
                                                    </div>
                                                </Anchor>
                                            </Tooltip>
                                            <span className="max-width-76 text-overflow-ellipsis-line-2 height-32-half-line margin-top-4 margin-bottom-8">
                                                {optionItem.name}
                                            </span>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    )
                }
                {
                    selectedPresetCategory !== PRESET_CATEGORY_DEFAULT && (
                        <div className={classNames(styles['preset-customized'], 'margin-vertical-16')}>
                            {
                                presetOptionsObj[selectedPresetCategory] && presetOptionsObj[selectedPresetCategory].options.map((optionItem, index) => {
                                    const isSelected = selectedPresetModel && selectedPresetModel.definitionId === optionItem.definitionId;

                                    return (
                                        <div
                                            key={(optionItem.i18nName + index) || (optionItem.name + index)}
                                            className={classNames(
                                                'border-radius-4',
                                                {
                                                    [styles.selected]: isSelected,
                                                }
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
                                                onClick={() => actions.onChangePresetById(optionItem.definitionId)}
                                            >
                                                <span>
                                                    {i18n._(optionItem.i18nName || optionItem.name)}
                                                </span>
                                                {// actions for selected preset model
                                                    isSelected && (
                                                        <Dropdown
                                                            placement="left"
                                                            className="display-inline float-right"
                                                            overlay={renderPresetMenu()}
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
                                                    )
                                                }
                                            </Anchor>

                                        </div>
                                    );
                                })
                            }
                        </div>
                    )
                }
            </div>
            {/* Preset Content */}
            <div className="margin-bottom-16 margin-top-16">
                <div
                    className={classNames(
                        'width-328',
                        'border-default-grey-1',
                        'border-radius-8',
                        'padding-top-8',
                        'padding-bottom-8',
                        'padding-horizontal-16',
                    )}
                >
                    <div className="margin-bottom-16 height-32 sm-flex justify-space-between">
                        <div className="display-inline-block">
                            <span className="color-black-5 margin-right-8">
                                {i18n._('key-Printing/PrintingConfigurations-Parameter Display :')}
                            </span>
                            <Select
                                clearable={false}
                                showSearch={false}
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
                        selectedPresetModel && configDisplayType === CONFIG_DISPLAY_TYPES[0] && (
                            <div>
                                <ParametersQuickSettingsView
                                    selectedStackId={selectedStackId}
                                    selectedPresetModel={selectedPresetModel}
                                    onChangePresetSettings={actions.onChangePresetSettings}
                                />
                            </div>
                        )
                    }
                    {
                        selectedPresetModel && configDisplayType === CONFIG_DISPLAY_TYPES[1] && (
                            <div className="overflow-y-auto height-max-400 margin-bottom-8">
                                {Object.keys(printingCustomConfigsWithCategory).map((category) => (
                                    <div key={category}>
                                        {printingCustomConfigsWithCategory[category].map(key => {
                                            return (
                                                <SettingItem
                                                    styleSize="middle"
                                                    settings={selectedPresetModel?.settings}
                                                    definitionKey={key}
                                                    showTooltip
                                                    key={key}
                                                    onChangePresetSettings={actions.onChangePresetSettings}
                                                    isDefaultDefinition={selectedPresetModel.isRecommended}
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
                    {
                        isDual && (
                            <div className="sm-flex justify-flex-end margin-top-8" style={{ marginBottom: '-8px' }}>
                                <Anchor
                                    className={classNames('link-text', 'float-r')}
                                    onClick={() => {
                                        dispatch(printingActions.updateState({
                                            showPrintParameterModifierDialog: selectedStackId,
                                        }));
                                    }}
                                >
                                    {i18n._('More Settings')} {'>'}
                                </Anchor>
                            </div>
                        )
                    }
                    <div className="sm-flex justify-flex-end margin-top-16" style={{ marginBottom: '0' }}>
                        <Anchor
                            className={classNames('link-text', 'float-r')}
                            onClick={actions.onShowMaterialManager}
                        >
                            More Settings (Classic)
                        </Anchor>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationView;
