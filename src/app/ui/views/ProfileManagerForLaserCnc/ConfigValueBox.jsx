import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { includes, throttle } from 'lodash';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import SettingItem from './SettingItem';
import CheckboxItem from './CheckboxItem';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import SvgIcon from '../../components/SvgIcon';
import { HEAD_CNC } from '../../../constants';

function ConfigValueBox({
    optionConfigGroup,
    calculateTextIndex,
    isCategorySelected,
    type = 'input',
    onChangePresetSettings,
    isOfficialDefinitionKey,
    selectedSettingDefaultValue,
    definitionForManager,
    customConfigs,
    showMiddle = false,
    hideMiniTitle = false,
    managerType
}) {
    const [activeCateId, setActiveCateId] = useState(2);
    const scrollDom = useRef(null);
    const fieldsDom = useRef([]);
    const [currentFields, setCurrentFields] = useState(fieldsDom.current);
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
    useEffect(() => {
        fieldsDom.current = fieldsDom.current.slice(
            0,
            Object.keys(optionConfigGroup).length
        );
    }, [Object.keys(optionConfigGroup)]);

    useEffect(() => {
        setCurrentFields(fieldsDom.current);
    }, [definitionForManager]);

    return (
        <div className="sm-flex">
            {showMiddle && (
                <div
                    className={classNames(
                        styles['manager-grouplist'],
                        'border-default-grey-1',
                        'padding-vertical-4',
                        'border-radius-8'
                    )}
                >
                    <div className="sm-parameter-container">
                        {optionConfigGroup.map((group, idx) => {
                            return (
                                <div key={i18n._(idx)}>
                                    {group.name && (
                                        <Anchor
                                            className={classNames(styles.item, {
                                                [styles.selected]:
                                                    idx === activeCateId
                                            })}
                                            onClick={() => {
                                                setActiveCate(idx);
                                            }}
                                        >
                                            <span className="sm-parameter-header__title">
                                                {i18n._(group.name)}
                                            </span>
                                        </Anchor>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            <div
                className={classNames(
                    styles['manager-details'],
                    'border-default-grey-1',
                    'border-radius-8'
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
                        && optionConfigGroup.map((group, index) => {
                            const eachFieldsDom = currentFields[index];
                            return (
                                <div key={group.name || group.fields[0]}>
                                    <>
                                        {!hideMiniTitle
                                            && group.name
                                            && (eachFieldsDom
                                                ? eachFieldsDom.childNodes
                                                    ?.length > 0
                                                : true) && (
                                            <div className="border-bottom-normal padding-bottom-8 margin-vertical-16">
                                                <SvgIcon
                                                    name="TitleSetting"
                                                    type={['static']}
                                                />
                                                <span className="margin-left-2">
                                                    {i18n._(group.name)}
                                                </span>
                                            </div>
                                        )}
                                        {/* eslint no-return-assign: 0*/}
                                        <div
                                            className={`${
                                                managerType === HEAD_CNC
                                                && group.name === 'Carving Tool'
                                                && 'sm-flex justify-space-between'
                                            }`}
                                        >
                                            <div
                                                ref={(el) => (fieldsDom.current[
                                                    index
                                                ] = el)}
                                                className={`${
                                                    managerType === HEAD_CNC
                                                    && group.name
                                                        === 'Carving Tool'
                                                    && 'width-percent-100'
                                                }`}
                                            >
                                                {group.fields
                                                    && group.fields.map((key) => {
                                                        if (type === 'input') {
                                                            return (
                                                                <SettingItem
                                                                    settings={
                                                                        definitionForManager?.settings
                                                                    }
                                                                    definitionKey={
                                                                        key
                                                                    }
                                                                    // width={managerType === HEAD_CNC && group.name === 'Carving Tool' ? '120px' : '160px'}
                                                                    key={key}
                                                                    isDefaultDefinition={
                                                                        definitionForManager?.isRecommended
                                                                    }
                                                                    onChangePresetSettings={
                                                                        onChangePresetSettings
                                                                    }
                                                                    isProfile="true"
                                                                    defaultValue={{
                                                                        // Check to reset
                                                                        value:
                                                                            selectedSettingDefaultValue
                                                                            && selectedSettingDefaultValue[
                                                                                key
                                                                            ]
                                                                                .default_value
                                                                    }}
                                                                    styleSize={
                                                                        managerType
                                                                            === HEAD_CNC
                                                                        && group.name
                                                                            === 'Carving Tool'
                                                                            ? 'middle'
                                                                            : 'large'
                                                                    }
                                                                    managerType={
                                                                        managerType
                                                                    }
                                                                    officialDefinition={
                                                                        !!definitionForManager?.isDefault
                                                                    }
                                                                />
                                                            );
                                                        } else if (
                                                            type === 'checkbox'
                                                        ) {
                                                            return (
                                                                <CheckboxItem
                                                                    calculateTextIndex={
                                                                        calculateTextIndex
                                                                    }
                                                                    settings={
                                                                        definitionForManager?.settings
                                                                    }
                                                                    defaultValue={includes(
                                                                        customConfigs,
                                                                        key
                                                                    )}
                                                                    definitionKey={
                                                                        key
                                                                    }
                                                                    key={key}
                                                                    isOfficialDefinitionKey={
                                                                        isOfficialDefinitionKey
                                                                    }
                                                                    onChangePresetSettings={
                                                                        onChangePresetSettings
                                                                    }
                                                                />
                                                            );
                                                        } else {
                                                            return null;
                                                        }
                                                    })}
                                            </div>
                                            {managerType === HEAD_CNC
                                                && group.name === 'Carving Tool'
                                                && definitionForManager?.settings
                                                    ?.tool_type
                                                    ?.default_value && (
                                                <div>
                                                    <img
                                                        style={{
                                                            width: 80,
                                                            height: 203,
                                                            marginLeft: 20
                                                        }}
                                                        src={`/resources/images/cnc/tool-type-${definitionForManager?.settings?.tool_type?.default_value}.jpg`}
                                                        alt=""
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
}
ConfigValueBox.propTypes = {
    definitionForManager: PropTypes.object.isRequired,
    optionConfigGroup: PropTypes.array.isRequired,
    isCategorySelected: PropTypes.bool,
    customConfigs: PropTypes.array,
    type: PropTypes.string,
    calculateTextIndex: PropTypes.func,
    isOfficialDefinitionKey: PropTypes.func,
    onChangePresetSettings: PropTypes.func.isRequired,
    selectedSettingDefaultValue: PropTypes.object,
    showMiddle: PropTypes.bool,
    hideMiniTitle: PropTypes.bool,
    managerType: PropTypes.string
};

export default React.memo(ConfigValueBox);
