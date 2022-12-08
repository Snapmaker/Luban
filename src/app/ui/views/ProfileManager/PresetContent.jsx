import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { includes, throttle } from 'lodash';
import classNames from 'classnames';
import i18next from 'i18next';
import { useDispatch, useSelector } from 'react-redux';
import ReactMarkdown from 'react-markdown';

import { PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import i18n from '../../../lib/i18n';
import api from '../../../api';

import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';

import { actions as printingActions } from '../../../flux/printing';
import definitionManager from '../../../flux/manager/DefinitionManager';
import ParameterFiltersBar from '../PresetModifier/ParameterFiltersBar';
import ParameterPicker from '../PresetModifier/ParameterPicker';

import SettingItem from './SettingItem';
import ParamItem from '../ParamItem';
import styles from './styles.styl';


const defaultParamsType = ['all', 'advanced'];
const NO_LIMIT = 'no_limit';


function getFilters(managerType) {
    const materialParamsTypeOptions = [{
        value: 'basic',
        label: i18n._('key-profileManager/Params-Basic')
    }, {
        value: 'all',
        label: i18n._('key-profileManager/Params-All')
    }];
    const qualityParamsTypeOptions = [{
        value: 'recommend',
        label: i18n._('key-profileManager/Params-Recommend')
    }, {
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
        value: 'no_limit',
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
        calculateTextIndex,
        showParameters = true,
        onChangePresetSettings,
        selectedSettingDefaultValue,
        definitionForManager,
        customConfigs,
        showMiddle = false,
        hideMiniTitle = false,
        managerType,
        onChangeCustomConfig
    }
) {
    const dispatch = useDispatch();

    const customMode = useSelector(state => state?.printing?.customMode);

    const { printingParamsType, materialParamsType, showParamsProfile } = useSelector(state => state?.printing);
    const [activeCateId, setActiveCateId] = useState(2);
    // recommended, basic, advanced, all
    const [selectParamsType, setSelectParamsType] = useState(managerType === PRINTING_MANAGER_TYPE_MATERIAL ? materialParamsType : printingParamsType);
    const [selectProfile, setSelectProfile] = useState('');
    const [selectCategory, setSelectCategory] = useState('');
    const [mdContent, setMdContent] = useState('');
    const [imgPath, setImgPath] = useState('');
    const [selectQualityDetailType, setSelectQualityDetailType] = useState(NO_LIMIT);
    const [profileDomOffset, setProfileDomOffset] = useState(0);
    const scrollDom = useRef(null);
    const fieldsDom = useRef([]);
    const [tempDoms, setTempdoms] = useState([]);
    const lang = i18next.language;
    useEffect(async () => {
        if (selectCategory && selectProfile) {
            try {
                const res = await api.getProfileDocs({ lang, selectCategory, selectProfile });
                setMdContent(res.body?.content);
                setImgPath(res.body?.imagePath);
            } catch (e) {
                console.info(e);
                setMdContent('');
            }
        }
    }, [selectProfile]);

    const setCustomMode = (value) => {
        dispatch(printingActions.updateCustomMode(value));
    };

    function setActiveCate(cateId) {
        if (scrollDom.current) {
            const container = scrollDom.current.parentElement;
            const offsetTops = [...scrollDom.current.children].map(
                (i) => i.offsetTop
            );
            if (cateId !== undefined) {
                container.scrollTop = offsetTops[cateId];
            } else {
                cateId = offsetTops.findIndex((item, idx) => {
                    if (idx < offsetTops.length - 1) {
                        return item < container.scrollTop
                            && offsetTops[idx + 1] > container.scrollTop;
                    } else {
                        return item < container.scrollTop;
                    }
                });
                cateId = Math.max(cateId, 0);
            }
            setActiveCateId(cateId);
        }
    }

    const handleUpdateProfileKey = (category, profileKey, e) => {
        const scrollTop = e.target.offsetParent?.scrollTop || 0;
        const offsetTop = e.target.offsetTop;
        setSelectCategory(category);
        setSelectProfile(profileKey);
        setProfileDomOffset(offsetTop - scrollTop);
    };
    const onChangeMaterialType = (newCategoryName) => {
        definitionForManager.i18nCategory = newCategoryName;
        dispatch(printingActions.updateDefinitionCategoryName(managerType, definitionForManager, newCategoryName));
    };

    const renderSettingItemList = (
        {
            settings,
            renderList,
            isDefaultDefinition,
            onChangePresetSettings: _onChangeCustomConfig,
            managerType: _managerType,
            officialDefinition,
            categoryKey,
            definitionCategory
            // selectParamsType: _selectParamsType
        }
    ) => {
        return renderList && renderList.map(profileKey => {
            const isCustom = selectParamsType === 'custom';
            const parameterVisibleTypeIncluded = includes((settings[profileKey].filter || []).concat('all'), selectParamsType);
            const parameterDetailVisibleTypeIncluded = (managerType !== PRINTING_MANAGER_TYPE_QUALITY || selectQualityDetailType === NO_LIMIT || includes(settings[profileKey].filter || [], selectQualityDetailType));

            if (isCustom || parameterVisibleTypeIncluded && parameterDetailVisibleTypeIncluded) {
                if (settings[profileKey].childKey?.length > 0 && selectParamsType !== 'custom') {
                    return (
                        <div key={profileKey} className={`margin-left-${(settings[profileKey].zIndex - 1) * 16}`}>
                            <SettingItem
                                settings={settings}
                                definitionKey={profileKey}
                                key={profileKey}
                                isDefaultDefinition={isDefaultDefinition}
                                onChangePresetSettings={_onChangeCustomConfig}
                                defaultValue={{
                                    value: selectedSettingDefaultValue && selectedSettingDefaultValue[profileKey].default_value
                                }}
                                styleSize="large"
                                managerType={_managerType}
                                officialDefinition={officialDefinition}
                                onClick={handleUpdateProfileKey}
                                categoryKey={categoryKey}
                                definitionCategory={definitionCategory}
                            />
                            {renderSettingItemList({
                                settings,
                                renderList: settings[profileKey].childKey,
                                isDefaultDefinition,
                                onChangePresetSettings: _onChangeCustomConfig,
                                managerType: _managerType,
                                definitionCategory,
                                officialDefinition,
                                categoryKey
                            })}
                        </div>
                    );
                }
                return (
                    <div key={profileKey} className={selectParamsType !== 'custom' ? `margin-left-${(settings[profileKey].zIndex - 1) * 16}` : ''}>
                        <SettingItem
                            settings={settings}
                            definitionKey={profileKey}
                            key={profileKey}
                            isDefaultDefinition={isDefaultDefinition}
                            onChangePresetSettings={_onChangeCustomConfig}
                            defaultValue={{
                                value: selectedSettingDefaultValue && selectedSettingDefaultValue[profileKey].default_value
                            }}
                            styleSize="large"
                            managerType={_managerType}
                            officialDefinition={officialDefinition}
                            onClick={handleUpdateProfileKey}
                            categoryKey={categoryKey}
                            definitionCategory={definitionCategory}
                            onChangeMaterialType={onChangeMaterialType}
                        />
                    </div>
                );
            } else {
                return null;
            }
        });
    };
    useEffect(() => {
        if (selectParamsType !== 'custom' || selectQualityDetailType) {
            fieldsDom.current = fieldsDom.current.slice(
                0,
                Object.keys(optionConfigGroup).length
            );
        } else {
            fieldsDom.current = fieldsDom.current.slice(
                0,
                Object.keys(customConfigs).length
            );
        }
    }, [Object.keys(optionConfigGroup), selectParamsType, Object.keys(customConfigs), selectQualityDetailType]);

    useEffect(() => {
        setTempdoms(fieldsDom.current);
    }, [customMode, selectParamsType, selectQualityDetailType]);

    const handleUpdateParamsType = (value) => {
        setSelectProfile('');
        setSelectParamsType(value);
        if (!includes(defaultParamsType, value)) {
            setSelectQualityDetailType(NO_LIMIT);
        }
        dispatch(printingActions.updateProfileParamsType(managerType, value));
    };

    const filters = getFilters(managerType); // Calculate once only when managerType changed
    const filterValues = [selectParamsType, selectQualityDetailType];

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
                            definitionManager={definitionManager}
                            optionConfigGroup={optionConfigGroup}
                            customConfigs={customConfigs}
                            definitionForManager={definitionForManager}
                            onChangeCustomConfig={onChangeCustomConfig}
                            calculateTextIndex={calculateTextIndex}
                        />
                    )
                }
                {/* Other Basic, All, etc */}
                {selectParamsType !== 'recommend' && !customMode && (
                    <>
                        {showMiddle && (
                            <div
                                className={classNames(
                                    styles['manager-grouplist'],
                                    // 'border-default-grey-1',
                                    'padding-vertical-16',
                                    // 'border-radius-8'
                                )}
                            >
                                {(selectParamsType !== 'custom' || customMode) && (
                                    <div className="sm-parameter-container">
                                        {Object.keys(optionConfigGroup).map((key, index) => {
                                            return (
                                                <div key={key}>
                                                    <Anchor
                                                        className={classNames(styles.item, {
                                                            [styles.selected]:
                                                            index === activeCateId
                                                        })}
                                                        onClick={() => {
                                                            setActiveCate(index);
                                                        }}
                                                    >
                                                        <span className="sm-parameter-header__title">
                                                            {i18n._(`key-Definition/Catagory-${key}`)}
                                                        </span>
                                                    </Anchor>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {selectParamsType === 'custom' && !customMode && (
                                    Object.keys(customConfigs).map((key, index) => {
                                        if (customConfigs[key] && customConfigs[key].length) {
                                            return (
                                                <div key={key}>
                                                    <Anchor
                                                        className={classNames(styles.item, {
                                                            [styles.selected]:
                                                            index === activeCateId
                                                        })}
                                                        onClick={() => {
                                                            setActiveCate(index);
                                                        }}
                                                    >
                                                        <span className="sm-parameter-header__title">
                                                            {i18n._(`key-Definition/Catagory-${key}`)}
                                                        </span>
                                                    </Anchor>
                                                </div>
                                            );
                                        } else {
                                            return null;
                                        }
                                    })
                                )}
                            </div>
                        )}
                        <div className={classNames(
                            styles['manager-detail-and-docs'],
                            'sm-flex',
                            'justify-space-between'
                        )}
                        >
                            <div
                                className={classNames(
                                    styles['manager-details'],
                                    // 'border-default-grey-1',
                                    'border-radius-8',
                                    'width-percent-60 '
                                )}
                                onWheel={throttle(
                                    () => {
                                        setActiveCate();
                                    },
                                    200,
                                    { leading: false, trailing: true }
                                )}
                            >
                                <div className="sm-parameter-container" ref={scrollDom}>
                                    {
                                        showParameters && Object.keys((selectParamsType === 'custom' && !customMode) ? customConfigs : optionConfigGroup).map((key, index) => {
                                            return (
                                                <div key={key}>
                                                    <>
                                                        {!hideMiniTitle && key && (tempDoms[index]?.clientHeight > 0) && (
                                                            <div className="border-bottom-normal padding-bottom-8 margin-vertical-16">
                                                                <SvgIcon
                                                                    name="TitleSetting"
                                                                    type={['static']}
                                                                />
                                                                <span className="margin-left-2">
                                                                    {i18n._(`key-Definition/Catagory-${key}`)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {/* eslint no-return-assign: 0*/}
                                                        <div>
                                                            <div ref={(el) => (fieldsDom.current[index] = el)}>
                                                                {!customMode && renderSettingItemList({
                                                                    settings: definitionForManager?.settings,
                                                                    renderList: selectParamsType === 'custom' ? customConfigs[key] : optionConfigGroup[key],
                                                                    isDefaultDefinition: definitionForManager?.isRecommended,
                                                                    onChangePresetSettings: onChangePresetSettings,
                                                                    managerType,
                                                                    officialDefinition: !!definitionForManager?.isDefault,
                                                                    categoryKey: key,
                                                                    definitionCategory: definitionForManager.category
                                                                    // selectParamsType
                                                                })}
                                                            </div>
                                                        </div>
                                                    </>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </div>
                            <div className={classNames(styles['manager-params-docs'], styles[showParamsProfile ? 'open-params-profile' : 'close-params-profile'], 'width-percent-40 background-grey-3 border-radius-16 position-re', showParamsProfile ? '' : 'width-1-important min-width-1 margin-right-16')}>
                                <Anchor onClick={() => dispatch(printingActions.updateParamsProfileShow(!showParamsProfile))} className={classNames(styles['profile-params-show-icon'], 'background-color-white border-default-grey-1 border-radius-12 position-absolute left-minus-12 bottom-24')}>
                                    <SvgIcon
                                        name="MainToolbarBack"
                                        size={24}
                                        type={['static']}
                                        className={classNames(showParamsProfile ? 'rotate180' : '')}
                                    />
                                </Anchor>
                                <div
                                    className="position-absolute"
                                    style={{
                                        left: -12,
                                        top: (profileDomOffset || 0) + 6,
                                        visibility: `${(profileDomOffset !== null && profileDomOffset > 0) ? 'visible' : 'hidden'}`
                                    }}
                                >
                                    <SvgIcon
                                        name="PointingArrow"
                                        size={24}
                                        type={['static']}
                                        color="#F5F5F7"
                                    />
                                </div>
                                {showParamsProfile && (
                                    <div className={classNames(styles['manager-params-docs-content'], 'padding-vertical-16 padding-horizontal-16 overflow-y-auto height-percent-100')}>
                                        <ReactMarkdown transformImageUri={(input) => (`atom:///${imgPath}/${input.slice(3)}`)}>
                                            {mdContent}
                                        </ReactMarkdown>
                                    </div>
                                )}
                                {/*  transformImageUri={() => (`${imgPath}/test.png`)} */}
                            </div>
                        </div>
                    </>
                )}
                {/* Recommended */}
                {selectParamsType === 'recommend' && (
                    <div className="width-percent-100 padding-horizontal-16 padding-vertical-16 sm-flex justify-space-between">
                        <div className="width-percent-70 margin-right-46">
                            <ParamItem
                                selectedDefinitionModel={definitionForManager} // not Preset Model
                                onChangePresetSettings={onChangePresetSettings}
                            />
                        </div>
                        <div className={classNames(styles['manager-params-docs'], 'width-percent-40 background-grey-3 border-radius-16 position-re', showParamsProfile ? '' : 'width-1-important min-width-1 margin-right-16')}>
                            <Anchor onClick={() => dispatch(printingActions.updateParamsProfileShow(!showParamsProfile))} className="background-color-white border-default-grey-1 border-radius-12 position-absolute left-minus-12 bottom-24">
                                <SvgIcon
                                    name="MainToolbarBack"
                                    size={24}
                                    type={['static']}
                                    className={classNames(showParamsProfile ? 'rotate180' : '')}
                                />
                            </Anchor>
                            {showParamsProfile && (
                                <div className={classNames(styles['manager-params-docs-content'], 'padding-vertical-16 padding-horizontal-16 overflow-y-auto height-percent-100')}>
                                    <ReactMarkdown transformImageUri={(input) => (`atom:///${imgPath}/${input.slice(3)}`)}>
                                        {mdContent}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

PresetContent.propTypes = {
    definitionForManager: PropTypes.object.isRequired,
    optionConfigGroup: PropTypes.object.isRequired,
    showParameters: PropTypes.bool,
    customConfigs: PropTypes.object,
    calculateTextIndex: PropTypes.func,
    onChangePresetSettings: PropTypes.func.isRequired,
    selectedSettingDefaultValue: PropTypes.object,
    showMiddle: PropTypes.bool,
    hideMiniTitle: PropTypes.bool,
    managerType: PropTypes.string,
    onChangeCustomConfig: PropTypes.func,
};

export default React.memo(PresetContent);
