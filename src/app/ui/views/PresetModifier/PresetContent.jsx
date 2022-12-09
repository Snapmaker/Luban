import classNames from 'classnames';
import { includes, cloneDeep } from 'lodash';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
// import ReactMarkdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';

import { LEFT_EXTRUDER, PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import { getQualityPresetLevelForRightExtruder } from '../../../constants/preset';
import { actions as machineActions } from '../../../flux/machine';
import definitionManager from '../../../flux/manager/DefinitionManager';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
// import SvgIcon from '../../components/SvgIcon';

import { actions as printingActions } from '../../../flux/printing';
import ParameterFiltersBar from './ParameterFiltersBar';
import ParameterPicker from './ParameterPicker';
import ParameterTable from './ParameterTable';
import styles from './styles.styl';


const defaultParamsType = ['all', 'advanced'];

function getFilters() {
    const qualityParamsTypeOptions = [/* {
        value: 'recommend',
        label: i18n._('key-profileManager/Params-Recommend')
    }, */{
            value: 'custom',
            label: i18n._('key-profileManager/Params-Custom')
        }, {
            value: 'basic',
            label: i18n._('key-profileManager/Params-Basic')
        }, {
            value: 'advanced',
            label: i18n._('key-profileManager/Params-Advanced')
        }, {
            value: 'all',
            label: i18n._('key-profileManager/Params-All')
        }];
    const qualityDetailTypeOptions = [{
        value: 'all',
        label: i18n._('key-profileManager/Params-No Limit')
    }, {
        value: 'efficiency',
        label: i18n._('key-profileManager/Params-Efficiency')
    }, {
        value: 'strength',
        label: i18n._('key-profileManager/Params-Strength')
    }, {
        value: 'surface_quality',
        label: i18n._('key-profileManager/Params-Surface_quality')
    }, {
        value: 'accuracy',
        label: i18n._('key-profileManager/Params-Accuracy')
    }, {
        value: 'material',
        label: i18n._('key-profileManager/Params-Material')
    }, {
        value: 'success',
        label: i18n._('key-profileManager/Params-Success')
    }];

    const firstLevelOptions = qualityParamsTypeOptions;

    const filters = [];
    for (const option of firstLevelOptions) {
        const filter = {
            name: option.label,
            value: option.value,
        };

        // construct sub filters for [advanced, all] top-level filter
        if (defaultParamsType.includes(filter.value)) {
            const subFilters = [];
            for (const subOption of qualityDetailTypeOptions) {
                const subFilter = {
                    name: subOption.label,
                    value: subOption.value,
                };
                subFilters.push(subFilter);
            }

            filter.filters = subFilters;
        }

        filters.push(filter);
    }

    return filters;
}


/**
 * Preset parameter modifier content.
 *
 * @param selectedStackId stack id
 * @param selectedPresetId preset id
 * @param selectedPresetDefaultValues default values for preset, TODO: refactor this
 */
const PresetContent = (
    {
        selectedStackId,
        selectedPresetId,
        selectedPresetDefaultValues,
    }
) => {
    const dispatch = useDispatch();
    const printingProfileLevel = useSelector((state) => state?.printing?.printingProfileLevel);

    const {
        qualityDefinitions,
        qualityDefinitionsRight,
        printingParamsType,
    } = useSelector(state => state?.printing);

    const [presetModel, setPresetModel] = useState(null);

    const [optionConfigGroup, setOptionConfigGroup] = useState({});

    const customMode = useSelector(state => state.printing.customMode);
    const customConfigs = useSelector(state => state?.machine?.printingCustomConfigsWithCategory);
    const onChangeCustomConfig = useCallback((key, checked, category) => {
        const newCustomConfig = { ...customConfigs };
        if (checked && !includes(newCustomConfig[category], key)) {
            newCustomConfig[category] = newCustomConfig[category] || [];
            newCustomConfig[category].push(key);
        } else if (!checked) {
            newCustomConfig[category] = newCustomConfig[category].filter(a => a !== key);
        }

        dispatch(machineActions.updatePrintingCustomConfigsWithCategory(newCustomConfig[category], category));
    }, [customConfigs]);

    const [selectParamsType, setSelectParamsType] = useState(printingParamsType);
    const [selectQualityDetailType, setSelectQualityDetailType] = useState('all');

    // const [mdContent, setMdContent] = useState(null);
    // const [imgPath, setImgPath] = useState('');

    // Update preset model
    useEffect(() => {
        const presetModels = selectedStackId === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight;
        const targetPresetModel = presetModels.find(p => p.definitionId === selectedPresetId);
        setPresetModel(targetPresetModel);

        if (selectedStackId === LEFT_EXTRUDER) {
            setOptionConfigGroup(printingProfileLevel);
        } else {
            const level = getQualityPresetLevelForRightExtruder();
            setOptionConfigGroup(level);
        }
    }, [selectedStackId, selectedPresetId]);

    const handleUpdateParamsType = (value) => {
        setSelectParamsType(value);
        if (!includes(defaultParamsType, value)) {
            setSelectQualityDetailType('all');
        }
        dispatch(printingActions.updateProfileParamsType(PRINTING_MANAGER_TYPE_QUALITY, value));
    };

    const setCustomMode = (value) => {
        dispatch(printingActions.updateCustomMode(value));
    };

    function onChangePresetValue(key, value) {
        const newPresetModel = cloneDeep(presetModel);
        newPresetModel.settings[key].default_value = value;
        setPresetModel(newPresetModel);

        dispatch(
            printingActions.updateCurrentDefinition({
                direction: selectedStackId,
                definitionModel: newPresetModel,
                changedSettingArray: [[key, value]],
                managerDisplayType: PRINTING_MANAGER_TYPE_QUALITY,
            })
        );
    }

    /**
     * Get parameter docs.
     *
     * @param key
     * @param category
     */
    /*
    const getParameterDocs = async (key, category) => {
        try {
            const res = await api.getProfileDocs({
                lang: i18next.language,
                selectCategory: category,
                selectProfile: key
            });
            setMdContent(res.body?.content);
            setImgPath(res.body?.imagePath);
        } catch (e) {
            console.info(e);
            setMdContent('');
        }
    };
    */

    /**
     * Render SettingItemList
     *
     * Check ConfigValueBox.jsx
     */
    /*
    function renderSettingItemList(
        {
            settings = {},
            renderList = [],
            isDefaultDefinition = true,
            onChangePresetSettings = () => {
            },
            managerType,
            officialDefinition,
            categoryKey,
            definitionCategory = '',
        }
    ) {
        return renderList && renderList.map((key) => {
            const hasDefaultValue = !!selectedPresetDefaultValues[key];
            if (!hasDefaultValue) {
                return null;
            }

            return (
                <div key={key} className={`margin-left-${(settings[key].zIndex - 1) * 16}`}>
                    <SettingItem
                        settings={settings}
                        definitionKey={key}
                        key={key}
                        isDefaultDefinition={isDefaultDefinition}
                        onChangePresetSettings={onChangePresetSettings}
                        defaultValue={{
                            value: selectedPresetDefaultValues[key].default_value
                        }}
                        styleSize="large"
                        managerType={managerType}
                        officialDefinition={officialDefinition}
                        onClick={() => getParameterDocs(key, categoryKey)}
                        categoryKey={categoryKey}
                        definitionCategory={definitionCategory}
                    />
                    {
                        settings[key].childKey && renderSettingItemList({
                            settings,
                            renderList: settings[key].childKey,
                            isDefaultDefinition,
                            onChangePresetSettings,
                            managerType,
                            definitionCategory,
                            categoryKey,
                            officialDefinition,
                        })
                    }
                </div>
            );
        });
    }
    */

    const filters = getFilters(); // Calculate once only when managerType changed
    const filterValues = [selectParamsType, selectQualityDetailType];

    return (
        <div className={classNames(styles['config-value-box-wrapper'], 'margin-vertical-16 margin-horizontal-16 background-color-white border-radius-16')}>
            <div className="height-56 sm-flex border-bottom-normal">
                <div className="sm-flex margin-left-16 margin-right-64">
                    <span className="margin-right-8">{i18n._('key-profileManager/param type')}</span>
                    <ParameterFiltersBar
                        disabled={customMode}
                        filters={filters}
                        filterValues={filterValues}
                        onChangeFilterValues={(index, value) => {
                            if (index === 0) {
                                handleUpdateParamsType(value);
                            } else if (index === 1) {
                                setSelectQualityDetailType(value);
                            }
                        }}
                    />
                    {
                        selectParamsType === 'custom' && (
                            <Button width="160px" priority="level-two" type="default" className="margin-top-4" onClick={() => setCustomMode(!customMode)}>
                                <span>{customMode ? i18n._('key-profileManager/Finish') : i18n._('key-profileManager/Manager Custom Params')}</span>
                            </Button>
                        )
                    }
                </div>
            </div>
            <div className="sm-flex width-percent-100 height-100-percent-minus-56">
                {/* Display preset
                    presetModel && (
                        <div className={classNames('sm-flex height-percent-100 overflow-x-auto margin-right-16', styles['manager-params-docs'])}>
                            <div
                                className={classNames('width-percent-60 padding-16 overflow-y-auto')}
                                style={{
                                    minWidth: '528px'
                                }}
                            >
                                {
                                    Object.keys(optionConfigGroup).map((category) => {
                                        return (
                                            <div key={category}>
                                                <div className="border-bottom-normal padding-bottom-8 margin-vertical-16">
                                                    <SvgIcon
                                                        name="TitleSetting"
                                                        type={['static']}
                                                    />
                                                    <span className="margin-left-2">
                                                        {i18n._(`key-Definition/Catagory-${category}`)}
                                                    </span>
                                                </div>
                                                <div>
                                                    {
                                                        renderSettingItemList({
                                                            settings: presetModel.settings,
                                                            renderList: optionConfigGroup[category],
                                                            isDefaultDefinition: presetModel.isRecommended,
                                                            onChangePresetSettings: onChangePresetValue,
                                                            managerType: PRINTING_MANAGER_TYPE_QUALITY,
                                                            officialDefinition: !!presetModel?.isDefault,
                                                            categoryKey: category,
                                                            definitionCategory: presetModel.category,
                                                        })
                                                    }
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                            <div
                                className={classNames(
                                    'width-percent-40 background-grey-3 height-perccent-100 overflow-y-auto',
                                    'margin-top-16 margin-left-16 margin-bottom-48 border-radius-16',
                                )}
                                style={{
                                    minWidth: '356px'
                                }}
                            >
                                <div className={classNames(styles['manager-params-docs-content'], 'padding-16 overflow-y-auto')}>
                                    <ReactMarkdown transformImageUri={(input) => (`atom:///${imgPath}/${input.slice(3)}`)}>
                                        {mdContent}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    )
                */}
                {
                    presetModel && (
                        <ParameterTable
                            optionConfigGroup={selectParamsType === 'custom' ? customConfigs : optionConfigGroup}
                            settings={presetModel.settings}
                            definitionForManager={presetModel}
                            selectedSettingDefaultValue={selectedPresetDefaultValues}
                            onChangePresetSettings={onChangePresetValue}
                            filters={selectParamsType === 'custom' ? [] : filterValues.filter(f => f !== 'all')}
                            flatten={selectParamsType === 'custom'}
                        />
                    )
                }
                {
                    presetModel && customMode && (
                        <ParameterPicker
                            optionConfigGroup={optionConfigGroup}
                            customConfigs={customConfigs}
                            parameterKeys={definitionManager.qualityProfileArr}
                            settings={presetModel.settings}
                            onChangeCustomConfig={onChangeCustomConfig}
                        />
                    )
                }
            </div>
        </div>
    );
};

PresetContent.propTypes = {
    selectedStackId: PropTypes.string.isRequired,
    selectedPresetId: PropTypes.string.isRequired,
    selectedPresetDefaultValues: PropTypes.object.isRequired,
};

export default PresetContent;
