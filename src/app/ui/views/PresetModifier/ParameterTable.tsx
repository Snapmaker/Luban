import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { throttle } from 'lodash';
import i18next from 'i18next';
import ReactMarkdown from 'react-markdown';

import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import styles from './styles.styl';
import ParameterValueItem from './ParameterValueItem';
import api from '../../../api';


// TODO: Refactor this
const renderSettingItemList = (
    {
        settings,
        renderList,
        isDefaultDefinition,
        onChangePresetSettings: _onChangeCustomConfig,
        officialDefinition,
        categoryKey,
        definitionCategory,
        selectedSettingDefaultValue,
        handleUpdateProfileKey,
        onChangeMaterialType,
        filters,
        flatten,
    }
) => {
    return renderList && renderList.map(profileKey => {
        // const isCustom = selectParamsType === 'custom';
        // const parameterVisibleTypeIncluded = includes((settings[profileKey].filter || []).concat('all'), selectParamsType);
        // const parameterDetailVisibleTypeIncluded = (managerType !== PRINTING_MANAGER_TYPE_QUALITY || selectQualityDetailType === NO_LIMIT || includes(settings[profileKey].filter || [], selectQualityDetailType));

        const setting = settings[profileKey];
        const { childKey, filter } = setting;

        let passFilter = true;
        for (const f of filters) {
            if (!filter.includes(f)) {
                passFilter = false;
                break;
            }
        }

        const defaultSetting = selectedSettingDefaultValue && selectedSettingDefaultValue[profileKey];
        if (passFilter) {
            return (
                <div key={profileKey} className={flatten ? '' : `margin-left-${(settings[profileKey].zIndex - 1) * 16}`}>
                    <ParameterValueItem
                        settings={settings}
                        definitionKey={profileKey}
                        key={profileKey}
                        isDefaultDefinition={isDefaultDefinition}
                        onChangePresetSettings={_onChangeCustomConfig}
                        defaultValue={{
                            value: defaultSetting && defaultSetting.default_value
                        }}
                        styleSize="large"
                        officialDefinition={officialDefinition}
                        onClick={handleUpdateProfileKey}
                        categoryKey={categoryKey}
                        definitionCategory={definitionCategory}
                        onChangeMaterialType={onChangeMaterialType}
                    />
                    {
                        childKey && renderSettingItemList({
                            settings,
                            renderList: childKey,
                            isDefaultDefinition,
                            onChangePresetSettings: _onChangeCustomConfig,
                            definitionCategory,
                            officialDefinition,
                            categoryKey,
                            selectedSettingDefaultValue,
                            handleUpdateProfileKey,
                            onChangeMaterialType,
                            filters,
                            flatten,
                        })
                    }
                </div>
            );
        } else {
            return null;
        }
    });
};

type Props = {
    optionConfigGroup: any;
    settings: any;
    definitionForManager: any;
    selectedSettingDefaultValue: any;
    onChangePresetSettings: any;
    onChangeMaterialType: any;
    filters: string[];
    flatten: boolean;
};

/**
 * A 3-column view showing parameters and parameter description.
 *
 * This component will take 100% width and height of its parent.
 */
const ParameterTable: React.FC<Props> = (props) => {
    const {
        optionConfigGroup,
        settings,
        definitionForManager,
        selectedSettingDefaultValue,
        onChangePresetSettings,
        onChangeMaterialType,
        filters,
        flatten = false,
    } = props;


    const [activeCateId, setActiveCateId] = useState(2);

    const scrollDom = useRef(null);
    const fieldsDom = useRef([]);


    const [selectProfile, setSelectProfile] = useState('');
    const [selectCategory, setSelectCategory] = useState('');
    const [mdContent, setMdContent] = useState('');
    const [imgPath, setImgPath] = useState('');


    const handleUpdateProfileKey = (category, profileKey) => {
        setSelectCategory(category);
        setSelectProfile(profileKey);
    };

    useEffect(() => {
        setSelectCategory('');
        setSelectProfile('');
    }, [filters]);

    // Fetch description of parameter
    // @ts-ignore
    useEffect(async () => {
        const lang = i18next.language;
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
    }, [selectCategory, selectProfile]);

    function setActiveCate(cateId?: number) {
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

    return (
        <div className="sm-flex width-percent-100 height-percent-100">
            <div
                className={classNames(
                    styles['manager-grouplist'],
                    'padding-vertical-4',
                    'padding-horizontal-8',
                )}
            >
                {
                    Object.keys(optionConfigGroup).map((category, index) => {
                        const keys = optionConfigGroup[category];

                        if (keys.length) {
                            return (
                                <div key={category} className="margin-vertical-4">
                                    <Anchor
                                        className={classNames(styles.item, {
                                            [styles.selected]:
                                            index === activeCateId
                                        })}
                                        onClick={() => {
                                            setActiveCate(index);
                                        }}
                                    >
                                        <span className="sm-parameter-header__title">{i18n._(`key-Definition/Catagory-${category}`)}</span>
                                    </Anchor>
                                </div>
                            );
                        } else {
                            return null;
                        }
                    })
                }
            </div>
            <div
                className={classNames(
                    styles['manager-detail-and-docs'],
                    'sm-flex',
                    'justify-space-between',
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
                            Object.keys(optionConfigGroup).map((category, index) => {
                                return (
                                    <div key={category}>
                                        {
                                            fieldsDom.current[index]?.clientHeight > 0 && (
                                                <div className="border-bottom-normal padding-bottom-8 margin-vertical-16">
                                                    <SvgIcon
                                                        name="TitleSetting"
                                                        type={['static']}
                                                    />
                                                    <span className="margin-left-2">
                                                        {i18n._(`key-Definition/Catagory-${category}`)}
                                                    </span>
                                                </div>
                                            )
                                        }
                                        <div>
                                            <div
                                                ref={(el) => {
                                                    fieldsDom.current[index] = el;
                                                }}
                                            >
                                                {
                                                    renderSettingItemList({
                                                        renderList: optionConfigGroup[category],
                                                        settings,
                                                        isDefaultDefinition: definitionForManager?.isRecommended,
                                                        onChangePresetSettings: onChangePresetSettings,
                                                        officialDefinition: !!definitionForManager?.isDefault,
                                                        categoryKey: category,
                                                        definitionCategory: definitionForManager.category,
                                                        selectedSettingDefaultValue,
                                                        handleUpdateProfileKey,
                                                        onChangeMaterialType,
                                                        filters,
                                                        flatten,
                                                    })
                                                }
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
                <div className={classNames(styles['manager-params-docs'], styles['open-params-profile'], 'width-percent-40 background-grey-3 border-radius-16 position-re margin-right-12')}>
                    <div className={classNames(styles['manager-params-docs-content'], 'padding-vertical-16 padding-horizontal-16 overflow-y-auto height-percent-100')}>
                        <ReactMarkdown transformImageUri={(input) => (`atom:///${imgPath}/${input.slice(3)}`)}>
                            {mdContent}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParameterTable;
