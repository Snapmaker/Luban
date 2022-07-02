import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { includes, throttle } from 'lodash';
import classNames from 'classnames';
import Menu from '../../components/Menu';
import i18n from '../../../lib/i18n';
import SettingItem from './SettingItem';
import CheckboxItem from './CheckboxItem';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import SvgIcon from '../../components/SvgIcon';
import Dropdown from '../../components/Dropdown';
import { Button } from '../../components/Buttons';
import { PRINTING_MANAGER_TYPE_MATERIAL } from '../../../constants';

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
    onChangeCustomConfig
}) {
    const [activeCateId, setActiveCateId] = useState(2);
    const [selectParamsType, setSelectParamsType] = useState('basic');
    const [customMode, setCustomMode] = useState(false);
    const scrollDom = useRef(null);
    const fieldsDom = useRef([]);
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
    const renderCheckboxList = ({
        renderList,
        calculateTextIndex: _calculateTextIndex,
        settings,
        isOfficialDefinitionKey: _isOfficialDefinitionKey,
        onChangeCustomConfig: _onChangeCustomConfig,
        categoryKey
    }) => {
        return renderList && renderList.map(profileKey => {
            if (settings[profileKey].childKey.length > 0) {
                return (
                    <div className={`margin-left-${(settings[profileKey].zIndex - 1) * 16}`}>
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
        // selectParamsType: _selectParamsType
    }) => {
        return renderList && renderList.map(profileKey => {
            if (selectParamsType === 'custom' || includes(settings[profileKey].filter, selectParamsType)) {
                if (settings[profileKey].childKey.length > 0) {
                    return (
                        <div className={`margin-left-${(settings[profileKey].zIndex - 1) * 16}`}>
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
                            />
                            {renderSettingItemList({
                                settings,
                                renderList: settings[profileKey].childKey,
                                isDefaultDefinition,
                                onChangeDefinition: _onChangeCustomConfig,
                                managerType: _managerType,
                                officalDefinition
                            })}
                        </div>
                    );
                }
                return (
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
                    />
                );
            } else {
                return null;
            }
        });
    };
    useEffect(() => {
        if (selectParamsType !== 'custom') {
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
    }, [Object.keys(optionConfigGroup), selectParamsType, Object.keys(customConfigs)]);

    const materialParamsType = (
        <Menu>
            <Menu.Item onClick={() => setSelectParamsType('basic')}>
                <span>{i18n._('key-profileManager/params basic')}</span>
            </Menu.Item>
            <Menu.Item onClick={() => setSelectParamsType('all')}>
                <span>{i18n._('key-profileManager/params all')}</span>
            </Menu.Item>
        </Menu>
    );
    const qualityParamsType = (
        <Menu>
            <Menu.Item onClick={() => setSelectParamsType('recommed')}>
                <span>{i18n._('key-profileManager/params recommed')}</span>
            </Menu.Item>
            <Menu.Item onClick={() => setSelectParamsType('custom')}>
                <span>{i18n._('key-profileManager/params custom')}</span>
            </Menu.Item>
            <Menu.Item>
                <div className="border-bottom-normal" />
            </Menu.Item>
            <Menu.Item onClick={() => setSelectParamsType('basic')}>
                <span>{i18n._('key-profileManager/params basic')}</span>
            </Menu.Item>
            <Menu.Item onClick={() => setSelectParamsType('advanced')}>
                <span>{i18n._('key-profileManager/params advanced')}</span>
            </Menu.Item>
            <Menu.Item onClick={() => setSelectParamsType('all')}>
                <span>{i18n._('key-profileManager/params all')}</span>
            </Menu.Item>
        </Menu>
    );
    return (
        <div className={classNames(styles['config-value-box-wrapper'], 'width-percent-100 margin-vertical-16 margin-horizontal-16 background-color-white border-radius-16')}>
            <div className="height-56 sm-flex border-bottom-normal padding-left-16">
                <div className="sm-flex">
                    <div className="sm-flex align-center margin-right-64">
                        <span className="margin-right-8">{i18n._('key-profileManager/param type')}</span>
                        <Dropdown trigger={['click']} overlay={managerType === PRINTING_MANAGER_TYPE_MATERIAL ? materialParamsType : qualityParamsType}>
                            <div>{i18n._(`key-profileManager/${selectParamsType}`)}</div>
                        </Dropdown>
                    </div>
                    {selectParamsType === 'custom' && (
                        <Button width="120px" priority="levle-two" type="default" className="margin-top-12" onClick={() => setCustomMode(!customMode)}>
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
                                                <div key={i18n._(index)}>
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
                                                            {i18n._(key)}
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
                                            <div key={i18n._(index)}>
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
                                                        {i18n._(key)}
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
                            'sm-flex'
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
                                            const eachFieldsDom = fieldsDom.current[index];
                                            return (
                                                <div key={key}>
                                                    <>
                                                        {!hideMiniTitle && key && (eachFieldsDom ? eachFieldsDom.childNodes?.length > 0 : true) && (
                                                            <div className="border-bottom-normal padding-bottom-8 margin-vertical-16">
                                                                <SvgIcon
                                                                    name="TitleSetting"
                                                                    type={['static']}
                                                                />
                                                                <span className="margin-left-2">
                                                                    {i18n._(key)}
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
                            <div className={classNames(styles['manager-params-docs'], 'width-percent-40 background-grey-3 border-radius-16')}> params detail </div>
                        </div>
                    </>
                )}
                {selectParamsType === 'recommed' && (
                    <div className="width-percent-100 padding-horizontal-16 padding-vertical-16">
                        <div className="width-percent-70">
                            Recommed Params
                        </div>
                        <div className="width-percent-30 background-grey-3 border-radius-16"> params detail </div>
                    </div>
                )}
            </div>
        </div>
    );
}
ConfigValueBox.propTypes = {
    definitionForManager: PropTypes.object.isRequired,
    optionConfigGroup: PropTypes.array.isRequired,
    isCategorySelected: PropTypes.bool,
    customConfigs: PropTypes.array,
    calculateTextIndex: PropTypes.func,
    isOfficialDefinitionKey: PropTypes.func,
    onChangeDefinition: PropTypes.func.isRequired,
    selectedSettingDefaultValue: PropTypes.object,
    showMiddle: PropTypes.bool,
    hideMiniTitle: PropTypes.bool,
    managerType: PropTypes.string,
    onChangeCustomConfig: PropTypes.func,
    // isFromPrinting: PropTypes.bool
};

export default React.memo(ConfigValueBox);
