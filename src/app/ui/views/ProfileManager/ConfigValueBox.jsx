import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { includes, throttle } from 'lodash';
import classNames from 'classnames';
import i18next from 'i18next';
import { useSelector, useDispatch } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import { actions as printingActions } from '../../../flux/printing';
// import Menu from '../../components/Menu';
import i18n from '../../../lib/i18n';
import SettingItem from './SettingItem';
import CheckboxItem from './CheckboxItem';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import SvgIcon from '../../components/SvgIcon';
// import Dropdown from '../../components/Dropdown';
import Select from '../../components/Select';
import { Button } from '../../components/Buttons';
import api from '../../../api';
import { PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
/* eslint-disable import/no-cycle */
import { ParamItem } from '../../widgets/PrintingConfigurations/Configurations';

const defaultParamsType = ['all', 'advanced'];
const NO_LIMIT = 'no_limit';

function ConfigValueBox({
    optionConfigGroup,
    calculateTextIndex,
    isCategorySelected,
    onChangeDefinition,
    isOfficialDefinitionKey,
    selectedSettingDefaultValue,
    definitionForManager,
    customConfigs,
    showMiddle = false,
    hideMiniTitle = false,
    managerType,
    customMode,
    setCustomMode,
    onChangeCustomConfig
}) {
    const { printingParamsType, materialParamsType, showParamsProfile } = useSelector(state => state?.printing);
    const [activeCateId, setActiveCateId] = useState(2);
    const [selectParamsType, setSelectParamsType] = useState(managerType === PRINTING_MANAGER_TYPE_MATERIAL ? materialParamsType : printingParamsType);
    const [selectProfile, setSelectProfile] = useState('');
    const [selectCategory, setSelectCategory] = useState('');
    const [mdContent, setMdContent] = useState('');
    const [imgPath, setImgPath] = useState('');
    const [selectQualityDetailType, setSelectQualityDetailType] = useState(NO_LIMIT);
    const scrollDom = useRef(null);
    const fieldsDom = useRef([]);
    const [tempDoms, setTempdoms] = useState([]);
    const dispatch = useDispatch();
    const lang = i18next.language;
    useEffect(async () => {
        if (selectCategory && selectProfile) {
            // let urlPre = '';
            // let langDir = '';
            // if (lang.toUpperCase() === 'ZH-CN') {
            //     langDir = 'CN';
            //     urlPre = 'https://snapmaker.oss-cn-beijing.aliyuncs.com/snapmaker.com';
            // } else {
            //     langDir = 'EN';
            //     urlPre = 'https://s3.us-west-2.amazonaws.com/snapmaker.com';
            // }
            // const url = `${urlPre}/${langDir}/${selectCategory}/${selectProfile}.md`;

            try {
                const res = await api.getProfileDocs({ lang, selectCategory, selectProfile });
                setMdContent(res.body?.content);
                setImgPath(res.body?.imagePath);
                // fetch(url, { mode: 'cors',
                //     method: 'GET',
                //     headers: {
                //         'Content-Type': 'text/markdown'
                //     } })
                //     .then((response) => {
                //         response.headers['access-control-allow-origin'] = { value: '*' };
                //         return response.text();
                //     })
                //     .then(result => {
                //         if (result) {
                //             setMdContent(result);
                //         }
                //     });
            } catch (e) {
                console.info(e);
                setMdContent('');
            }
        }
    }, [selectProfile]);
    function setActiveCate(cateId) {
        if (scrollDom.current) {
            const container = scrollDom.current.parentElement;
            const offsetTops = [...scrollDom.current.children].map(
                (i) => i.offsetTop - 92
            );
            if (cateId !== undefined) {
                container.scrollTop = offsetTops[cateId];
            } else {
                cateId = offsetTops.findIndex(
                    (item, idx) => item < container.scrollTop
                        && offsetTops[idx + 1] > container.scrollTop
                );
                cateId = Math.max(cateId, 0);
            }
            setActiveCateId(cateId);
        }
    }
    const handleUpdateProfileKey = (category, profileKey) => {
        setSelectCategory(category);
        setSelectProfile(profileKey);
    };
    const onChangeMaterialType = (newCategoryName) => {
        dispatch(printingActions.updateDefinitionCategoryName(managerType, definitionForManager, newCategoryName));
    };
    const renderCheckboxList = ({
        renderList,
        calculateTextIndex: _calculateTextIndex,
        settings,
        isOfficialDefinitionKey: _isOfficialDefinitionKey,
        onChangeCustomConfig: _onChangeCustomConfig,
        categoryKey
    }) => {
        return renderList && renderList.map(profileKey => {
            if (settings[profileKey].childKey?.length > 0) {
                return (
                    <div key={profileKey} className={`margin-left-${(settings[profileKey].zIndex - 1) * 16}`}>
                        <CheckboxItem
                            calculateTextIndex={_calculateTextIndex}
                            settings={settings}
                            defaultValue={includes(
                                customConfigs ? customConfigs[categoryKey] : [],
                                profileKey
                            )}
                            definitionKey={
                                profileKey
                            }
                            key={profileKey}
                            isOfficialDefinitionKey={_isOfficialDefinitionKey}
                            onChangeDefinition={_onChangeCustomConfig}
                            configCategory={categoryKey}
                        />
                        {renderCheckboxList({
                            // customConfigs: _customConfigs,
                            renderList: settings[profileKey].childKey,
                            calculateTextIndex: _calculateTextIndex,
                            settings,
                            isOfficialDefinitionKey: _isOfficialDefinitionKey,
                            onChangeCustomConfig: _onChangeCustomConfig,
                            categoryKey
                        })}
                    </div>
                );
            }
            return (
                <CheckboxItem
                    calculateTextIndex={_calculateTextIndex}
                    settings={settings}
                    defaultValue={includes(
                        customConfigs ? customConfigs[categoryKey] : [],
                        profileKey
                    )}
                    definitionKey={
                        profileKey
                    }
                    key={profileKey}
                    isOfficialDefinitionKey={_isOfficialDefinitionKey}
                    onChangeDefinition={_onChangeCustomConfig}
                    configCategory={categoryKey}
                />
            );
        });
    };
    const renderSettingItemList = ({
        settings,
        renderList,
        isDefaultDefinition,
        onChangeDefinition: _onChangeCustomConfig,
        managerType: _managerType,
        officalDefinition,
        categoryKey,
        definitionCategory
        // selectParamsType: _selectParamsType
    }) => {
        return renderList && renderList.map(profileKey => {
            if (selectParamsType === 'custom' || (includes((settings[profileKey].filter || []).concat('all'), selectParamsType) && (selectQualityDetailType === NO_LIMIT ? true : includes(settings[profileKey].filter || [], selectQualityDetailType)))) {
                if (settings[profileKey].childKey?.length > 0 && selectParamsType !== 'custom') {
                    return (
                        <div key={profileKey} className={`margin-left-${(settings[profileKey].zIndex - 1) * 16}`}>
                            <SettingItem
                                settings={settings}
                                definitionKey={profileKey}
                                key={profileKey}
                                isDefaultDefinition={isDefaultDefinition}
                                onChangeDefinition={_onChangeCustomConfig}
                                defaultValue={{
                                    value: selectedSettingDefaultValue && selectedSettingDefaultValue[profileKey].default_value
                                }}
                                styleSize="large"
                                managerType={_managerType}
                                officalDefinition={officalDefinition}
                                onClick={handleUpdateProfileKey}
                                categoryKey={categoryKey}
                                definitionCategory={definitionCategory}
                            />
                            {renderSettingItemList({
                                settings,
                                renderList: settings[profileKey].childKey,
                                isDefaultDefinition,
                                onChangeDefinition: _onChangeCustomConfig,
                                managerType: _managerType,
                                definitionCategory,
                                officalDefinition,
                                categoryKey
                            })}
                        </div>
                    );
                }
                return (
                    <div className={selectParamsType !== 'custom' && `margin-left-${(settings[profileKey].zIndex - 1) * 16}`}>
                        <SettingItem
                            settings={settings}
                            definitionKey={profileKey}
                            key={profileKey}
                            isDefaultDefinition={isDefaultDefinition}
                            onChangeDefinition={_onChangeCustomConfig}
                            defaultValue={{
                                value: selectedSettingDefaultValue && selectedSettingDefaultValue[profileKey].default_value
                            }}
                            styleSize="large"
                            managerType={_managerType}
                            officalDefinition={officalDefinition}
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
    }, [selectParamsType, selectQualityDetailType]);

    const handleUpdateParamsType = (e) => {
        setSelectProfile('');
        setSelectParamsType(e.value);
        if (!includes(defaultParamsType, e.value)) {
            setSelectQualityDetailType(NO_LIMIT);
        }
        dispatch(printingActions.updateProfileParamsType(managerType, e.value));
    };
    const materialParamsTypeOptions = [{
        value: 'basic',
        label: i18n._('key-profileManager/Params-Basic')
    }, {
        value: 'all',
        label: i18n._('key-profileManager/Params-All')
    }];
    const qualityParamsTypeOptions = [{
        value: 'recommed',
        label: i18n._('key-profileManager/Params-Recommed')
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

    return (
        <div className={classNames(styles['config-value-box-wrapper'], 'width-percent-100 margin-vertical-16 margin-horizontal-16 background-color-white border-radius-16')}>
            <div className="height-56 sm-flex border-bottom-normal padding-left-16">
                <div className="sm-flex">
                    <div className="sm-flex align-center margin-right-64">
                        <span className="margin-right-8">{i18n._('key-profileManager/param type')}</span>
                        <Select
                            options={managerType === PRINTING_MANAGER_TYPE_MATERIAL ? materialParamsTypeOptions : qualityParamsTypeOptions}
                            clearable={false}
                            size="large"
                            showSearch={false}
                            value={selectParamsType}
                            onChange={(e) => {
                                handleUpdateParamsType(e);
                            }}
                            bordered={false}
                            disabled={customMode}
                        />
                        {managerType === PRINTING_MANAGER_TYPE_QUALITY && defaultParamsType.includes(selectParamsType) && (
                            <Select
                                options={qualityDetailTypeOptions}
                                clearable={false}
                                size="large"
                                showSearch={false}
                                bordered={false}
                                value={selectQualityDetailType}
                                onChange={(e) => {
                                    setSelectQualityDetailType(e.value);
                                }}
                                disabled={customMode}
                            />
                        )}
                    </div>
                    {selectParamsType === 'custom' && (
                        <Button width="160px" priority="levle-two" type="default" className="margin-top-4" onClick={() => setCustomMode(!customMode)}>
                            <span>{customMode ? i18n._('key-profileManager/Finish') : i18n._('key-profileManager/Manager Custom Params')}</span>
                        </Button>
                    )}
                </div>
            </div>
            <div className="sm-flex width-percent-100 height-100-percent-minus-56">
                {selectParamsType !== 'recommed' && (
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
                                                <div key={i18n._(key)}>
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
                                        return (
                                            <div key={i18n._(key)}>
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
                                    {!isCategorySelected
                                        && Object.keys((selectParamsType === 'custom' && !customMode) ? customConfigs : optionConfigGroup).map((key, index) => {
                                            // const eachFieldsDom = fieldsDom.current[index];
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
                                                                {customMode && renderCheckboxList({
                                                                    customConfig: customConfigs,
                                                                    renderList: optionConfigGroup[key],
                                                                    calculateTextIndex,
                                                                    settings: definitionForManager?.settings,
                                                                    isOfficialDefinitionKey,
                                                                    onChangeCustomConfig,
                                                                    categoryKey: key
                                                                })}
                                                                {!customMode && renderSettingItemList({
                                                                    settings: definitionForManager?.settings,
                                                                    renderList: selectParamsType === 'custom' ? customConfigs[key] : optionConfigGroup[key],
                                                                    isDefaultDefinition: definitionForManager?.isRecommended,
                                                                    onChangeDefinition,
                                                                    managerType,
                                                                    officalDefinition: !!definitionForManager?.isDefault,
                                                                    categoryKey: key,
                                                                    definitionCategory: definitionForManager.category
                                                                    // selectParamsType
                                                                })}
                                                            </div>
                                                        </div>
                                                    </>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                            <div className={classNames(styles['manager-params-docs'], styles[showParamsProfile ? 'open-params-profile' : 'close-params-profile'], 'width-percent-40 background-grey-3 border-radius-16 position-re', showParamsProfile ? '' : 'width-1-important min-width-1 margin-right-16')}>
                                <Anchor onClick={() => dispatch(printingActions.updateParamsProfileShow(!showParamsProfile))} className={classNames(styles['profile-params-show-icon'], 'background-color-white border-default-grey-1 border-radius-12 position-ab left-minus-12 bottom-24')}>
                                    <SvgIcon
                                        name="MainToolbarBack"
                                        size={24}
                                        type={['static']}
                                        className={classNames(showParamsProfile ? 'rotate180' : '')}
                                    />
                                </Anchor>
                                {showParamsProfile && (
                                    <div className="padding-vertical-16 padding-horizontal-16 overflow-y-auto height-percent-100">
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
                {selectParamsType === 'recommed' && (
                    <div className="width-percent-100 padding-horizontal-16 padding-vertical-16 sm-flex justify-space-between">
                        <div className="width-percent-70 margin-right-46">
                            <ParamItem
                                selectedDefinitionModel={definitionForManager}
                                allParams={definitionForManager.params}
                            />
                        </div>
                        <div className={classNames(styles['manager-params-docs'], 'width-percent-40 background-grey-3 border-radius-16 position-re', showParamsProfile ? '' : 'width-1-important min-width-1 margin-right-16')}>
                            <Anchor onClick={() => dispatch(printingActions.updateParamsProfileShow(!showParamsProfile))} className="background-color-white border-default-grey-1 border-radius-12 position-ab left-minus-12 bottom-24">
                                <SvgIcon
                                    name="MainToolbarBack"
                                    size={24}
                                    type={['static']}
                                    className={classNames(showParamsProfile ? 'rotate180' : '')}
                                />
                            </Anchor>
                            {showParamsProfile && (
                                <div className="padding-vertical-16 padding-horizontal-16 overflow-y-auto height-percent-100">
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
ConfigValueBox.propTypes = {
    definitionForManager: PropTypes.object.isRequired,
    optionConfigGroup: PropTypes.object.isRequired,
    isCategorySelected: PropTypes.bool,
    customConfigs: PropTypes.object,
    calculateTextIndex: PropTypes.func,
    isOfficialDefinitionKey: PropTypes.func,
    onChangeDefinition: PropTypes.func.isRequired,
    selectedSettingDefaultValue: PropTypes.object,
    showMiddle: PropTypes.bool,
    hideMiniTitle: PropTypes.bool,
    managerType: PropTypes.string,
    onChangeCustomConfig: PropTypes.func,
    customMode: PropTypes.bool,
    setCustomMode: PropTypes.func,
};

export default React.memo(ConfigValueBox);
