import classNames from 'classnames';
import { includes, isUndefined } from 'lodash';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { LEFT_EXTRUDER, PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import { getQualityPresetLevelForRightExtruder, getUsedExtruderNumber } from '../../../constants/preset';
import { actions as machineActions } from '../../../flux/machine';
import definitionManager from '../../../flux/manager/DefinitionManager';
import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import ParameterFiltersBar from './ParameterFiltersBar';
import ParameterPicker from './ParameterPicker';
import ParametersTableView from './ParametersTableView';
import styles from './styles.styl';
import { printingStore } from '../../../store/local-storage';
// import SvgIcon from '../../components/SvgIcon';


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
    const helpersExtruderConfig = useSelector((state) => state.printing.helpersExtruderConfig);
    const supportExtruderConfig = useSelector((state) => state.printing.supportExtruderConfig);

    const {
        qualityDefinitions: qualityPresetModels,
        // printingParamsType,
        customMode,
    } = useSelector(state => state?.printing);

    // custom configs: category -> list of keys
    const customConfigs = useSelector(state => state?.machine?.printingCustomConfigsWithCategory);

    const [presetModel, setPresetModel] = useState(null);
    const [optionConfigGroup, setOptionConfigGroup] = useState({});

    // Update preset model and option config group
    useEffect(() => {
        const newPresetModel = qualityPresetModels.find(p => p.definitionId === selectedPresetId);
        setPresetModel(newPresetModel);

        if (selectedStackId === LEFT_EXTRUDER) {
            setOptionConfigGroup(printingProfileLevel);
        } else {
            const level = getQualityPresetLevelForRightExtruder();
            setOptionConfigGroup(level);
        }
    }, [selectedStackId, selectedPresetId]);

    // Filters
    const [selectParamsType, setSelectParamsType] = useState(printingStore.get('preset-filter:grade', 'basic'));
    const [selectQualityDetailType, setSelectQualityDetailType] = useState('all');

    const handleUpdateParamsType = (value) => {
        setSelectParamsType(value);
        printingStore.set('preset-filter:grade', value);

        if (!includes(defaultParamsType, value)) {
            setSelectQualityDetailType('all');
        }
        dispatch(printingActions.updateProfileParamsType(PRINTING_MANAGER_TYPE_QUALITY, value));
    };

    const setCustomMode = (value) => {
        dispatch(printingActions.updateCustomMode(value));
    };

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


    function onChangePresetValue(key, value) {
        dispatch(
            printingActions.updateCurrentDefinition({
                direction: selectedStackId,
                definitionModel: presetModel,
                changedSettingArray: [[key, value]],
                managerDisplayType: PRINTING_MANAGER_TYPE_QUALITY,
            })
        );
    }

    const filters = getFilters(); // Calculate once only when managerType changed
    const filterValues = [selectParamsType, selectQualityDetailType];

    function parameterConverter(key) {
        const settingItem = presetModel.settings[key];

        // check visible
        if (!isUndefined(settingItem.visible) && !settingItem.visible) {
            return null;
        }

        // check filters
        let bypassFilter = true;
        const parameterFilters = filterValues.filter(f => f !== 'all' && f !== 'custom');
        for (const filter of parameterFilters) {
            if (!settingItem.filter || !settingItem.filter.includes(filter)) {
                bypassFilter = false;
                break;
            }
        }
        if (!bypassFilter) {
            return null;
        }

        const displayConfig = {
            key,
            value: settingItem.default_value,
            disabled: false,
        };

        if (settingItem.limit_to_extruder) {
            const extruderNumber = getUsedExtruderNumber(settingItem.limit_to_extruder, helpersExtruderConfig, supportExtruderConfig);
            const stackExtruderNumber = selectedStackId === LEFT_EXTRUDER ? '0' : '1';

            displayConfig.disabled = (extruderNumber !== '-1' && extruderNumber !== stackExtruderNumber);
        }

        return displayConfig;
    }

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
                    {/* Custom Mode */
                        selectParamsType === 'custom' && (
                            <Button width="160px" priority="level-two" type="default" className="margin-top-4" onClick={() => setCustomMode(!customMode)}>
                                <span>{customMode ? i18n._('key-profileManager/Finish') : i18n._('key-profileManager/Manager Custom Params')}</span>
                            </Button>
                        )
                    }
                </div>
            </div>
            <div className="sm-flex width-percent-100 height-100-percent-minus-56">
                {
                    presetModel && !customMode && (
                        <ParametersTableView
                            optionConfigGroup={selectParamsType === 'custom' ? customConfigs : optionConfigGroup}
                            settings={presetModel.settings}
                            definitionForManager={presetModel}
                            selectedSettingDefaultValue={selectedPresetDefaultValues}
                            onChangePresetSettings={onChangePresetValue}
                            filters={selectParamsType === 'custom' ? [] : filterValues.filter(f => f !== 'all')}
                            flatten={selectParamsType === 'custom'}
                            parameterConverter={parameterConverter}
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
