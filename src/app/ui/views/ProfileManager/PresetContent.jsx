import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { includes, isNil } from 'lodash';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';

import { PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import i18n from '../../../lib/i18n';

import { Button } from '../../components/Buttons';

import { actions as printingActions } from '../../../flux/printing';
import definitionManager from '../../../flux/manager/DefinitionManager';
import ParameterFiltersBar from '../PresetModifier/ParameterFiltersBar';
import ParameterPicker from '../PresetModifier/ParameterPicker';
import ParametersTableView from '../PresetModifier/ParametersTableView';

import styles from './styles.styl';


const defaultParamsType = ['all', 'advanced'];


function getFilters(managerType) {
    const materialParamsTypeOptions = [{
        value: 'basic',
        label: i18n._('key-profileManager/Params-Basic')
    }, {
        value: 'all',
        label: i18n._('key-profileManager/Params-All')
    }];
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

    const firstLevelOptions = managerType === PRINTING_MANAGER_TYPE_MATERIAL ? materialParamsTypeOptions : qualityParamsTypeOptions;

    const filters = [];
    for (const option of firstLevelOptions) {
        const filter = {
            name: option.label,
            value: option.value,
        };

        // construct sub filters for [advanced, all] top-level filter
        if (managerType === PRINTING_MANAGER_TYPE_QUALITY && defaultParamsType.includes(filter.value)) {
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

function PresetContent(
    {
        optionConfigGroup,
        showParameters = true,
        onChangePresetSettings,
        selectedSettingDefaultValue,
        definitionForManager,
        customConfigs,
        managerType,
        onChangeCustomConfig
    }
) {
    const dispatch = useDispatch();

    const customMode = useSelector(state => state?.printing?.customMode);
    const { printingParamsType, materialParamsType } = useSelector(state => state?.printing);

    const [selectParamsType, setSelectParamsType] = useState(managerType === PRINTING_MANAGER_TYPE_MATERIAL ? materialParamsType : printingParamsType);
    const [selectQualityDetailType, setSelectQualityDetailType] = useState('all');

    const setCustomMode = (value) => {
        dispatch(printingActions.updateCustomMode(value));
    };

    const onChangeMaterialType = (newCategoryName) => {
        // definitionForManager.i18nCategory = newCategoryName;
        dispatch(printingActions.updateDefinitionCategoryName(managerType, definitionForManager, newCategoryName));
    };

    // useEffect(() => {
    //     if (selectParamsType !== 'custom' || selectQualityDetailType) {
    //         fieldsDom.current = fieldsDom.current.slice(
    //             0,
    //             Object.keys(optionConfigGroup).length
    //         );
    //     } else {
    //         fieldsDom.current = fieldsDom.current.slice(
    //             0,
    //             Object.keys(customConfigs).length
    //         );
    //     }
    // }, [Object.keys(optionConfigGroup), selectParamsType, Object.keys(customConfigs), selectQualityDetailType]);

    // useEffect(() => {
    //     setTempdoms(fieldsDom.current);
    // }, [customMode, selectParamsType, selectQualityDetailType]);

    const handleUpdateParamsType = (value) => {
        setSelectParamsType(value);
        if (!includes(defaultParamsType, value)) {
            setSelectQualityDetailType('all');
        }
        dispatch(printingActions.updateProfileParamsType(managerType, value));
    };

    const filters = getFilters(managerType); // Calculate once only when managerType changed
    const filterValues = [selectParamsType, selectQualityDetailType];

    function parameterConverter(key) {
        const settingItem = definitionForManager.settings[key];

        // check visible
        if (!isNil(settingItem.visible) && (!settingItem.visible || settingItem.visible === 'false')) {
            return null;
        }

        // check filters
        let bypassFilter = true;
        const parameterFilters = filterValues.filter(f => f !== 'all');
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

        // if (settingItem.limit_to_extruder) {
        //     const extruderNumber = getUsedExtruderNumber(settingItem.limit_to_extruder, helpersExtruderConfig);
        //     const stackExtruderNumber = selectedStackId === LEFT_EXTRUDER ? '0' : '1';
        //
        //     displayConfig.disabled = (extruderNumber !== '-1' && extruderNumber !== stackExtruderNumber);
        // }

        return displayConfig;
    }

    return (
        <div className={classNames(styles['config-value-box-wrapper'], 'margin-vertical-16 margin-horizontal-16 background-color-white border-radius-16')}>
            {/* Parameter filters */}
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
                {
                    showParameters && customMode && (
                        <ParameterPicker
                            optionConfigGroup={optionConfigGroup}
                            customConfigs={customConfigs}
                            parameterKeys={definitionManager.qualityProfileArr}
                            settings={definitionForManager.settings}
                            onChangeCustomConfig={onChangeCustomConfig}
                        />
                    )
                }
                {
                    showParameters && !customMode && (
                        <ParametersTableView
                            optionConfigGroup={selectParamsType === 'custom' ? customConfigs : optionConfigGroup}
                            settings={definitionForManager.settings}
                            definitionForManager={definitionForManager}
                            selectedSettingDefaultValue={selectedSettingDefaultValue}
                            onChangePresetSettings={onChangePresetSettings}
                            onChangeMaterialType={onChangeMaterialType}
                            filters={selectParamsType === 'custom' ? [] : filterValues.filter(f => f !== 'all')}
                            flatten={selectParamsType === 'custom'}
                            parameterConverter={parameterConverter}
                        />
                    )
                }
            </div>
        </div>
    );
}

PresetContent.propTypes = {
    definitionForManager: PropTypes.object.isRequired,
    optionConfigGroup: PropTypes.object.isRequired,
    showParameters: PropTypes.bool,
    customConfigs: PropTypes.object,
    onChangePresetSettings: PropTypes.func.isRequired,
    selectedSettingDefaultValue: PropTypes.object,
    managerType: PropTypes.string,
    onChangeCustomConfig: PropTypes.func,
};

export default React.memo(PresetContent);
