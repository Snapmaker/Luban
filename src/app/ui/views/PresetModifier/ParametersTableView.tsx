import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { isNil, throttle } from 'lodash';
import i18next from 'i18next';
import ReactMarkdown from 'react-markdown';

import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import api from '../../../api';
import styles from './styles.styl';
import ParameterValueItem from './ParameterValueItem';


/**
 * You can either render parameters in tree view or list view.
 *
 * 1. Tree View: Render parameters in hierarchy, you only need to specify
 *    top level parameter keys.
 *
 * 2. List View: Render parameters in a flatten list view, you will need
 *    to specify all the keys in a category.
 */
enum ParametersViewType {
    TreeView,
    ListView,
}

/**
 * Display Config for parameters in tree hierarchy.
 */
interface DisplayConfig {
    key: string;
    children?: DisplayConfig[];
}

/**
 * Calculate display configs for keys and their children. (tree view)
 *
 * @param keys
 * @param settings
 * @param filters
 */
function calculateDisplayConfigsForKeys(keys: string[], settings: { [key: string]: any }, filters: string[]): DisplayConfig[] {
    const displayConfigs = [];
    for (const key of keys) {
        const settingItem = settings[key];

        // check visible
        if (!isNil(settingItem.visible) && (!settingItem.visible || settingItem.visible === 'false')) {
            continue;
        }

        // check filters
        let bypassFilter = true;
        for (const filter of filters) {
            if (!settingItem.filter.includes(filter)) {
                bypassFilter = false;
                break;
            }
        }
        if (!bypassFilter) {
            continue;
        }

        const displayConfig: DisplayConfig = {
            key,
        };

        if (settingItem.childKey) {
            displayConfig.children = calculateDisplayConfigsForKeys(settingItem.childKey, settings, filters);
        }

        displayConfigs.push(displayConfig);
    }

    return displayConfigs;
}

function calculateDisplayConfigsGroups(
    viewType = ParametersViewType.ListView,
    optionConfigGroup: { [category: string]: string[] },
    settings: { [key: string]: any },
    filters: string[] = [],
): { [category: string]: DisplayConfig[] } {
    const groups = {};
    if (viewType === ParametersViewType.ListView) {
        for (const category of Object.keys(optionConfigGroup)) {
            const group: DisplayConfig[] = [];
            for (const key of optionConfigGroup[category]) {
                group.push({ key });
            }

            groups[category] = group;
        }
    } else {
        for (const category of Object.keys(optionConfigGroup)) {
            groups[category] = calculateDisplayConfigsForKeys(optionConfigGroup[category], settings, filters);
        }
    }

    return groups;
}

declare type ParameterItemListProps = {
    displayConfigs: DisplayConfig[];
    settings: { [key: string]: any };
    isDefaultDefinition: boolean;
    onChangePresetSettings: () => void;
    selectedSettingDefaultValue: { [key: string]: any };
    officialDefinition: boolean;
    handleUpdateProfileKey: (category: string, key: string) => void;
    categoryKey: string;
    definitionCategory: string;
    onChangeMaterialType: () => void;
    indent?: number,
};

const ParameterItemList: React.FC<ParameterItemListProps> = (props) => {
    const {
        displayConfigs,
        settings,
        isDefaultDefinition,
        onChangePresetSettings,
        selectedSettingDefaultValue,
        officialDefinition,
        handleUpdateProfileKey,
        categoryKey,
        definitionCategory,
        onChangeMaterialType,
        indent = 0,
    } = props;

    return (
        <>
            {
                displayConfigs.map((displayConfig) => {
                    const { key, children = null } = displayConfig;

                    const defaultSetting = selectedSettingDefaultValue && selectedSettingDefaultValue[key];

                    return (
                        <div key={key} className={`margin-left-${indent * 16}`}>
                            <ParameterValueItem
                                settings={settings}
                                definitionKey={key}
                                key={key}
                                isDefaultDefinition={isDefaultDefinition}
                                onChangePresetSettings={onChangePresetSettings}
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
                                children && (
                                    <ParameterItemList
                                        displayConfigs={children}
                                        settings={settings}
                                        isDefaultDefinition={isDefaultDefinition}
                                        onChangePresetSettings={onChangePresetSettings}
                                        selectedSettingDefaultValue={selectedSettingDefaultValue}
                                        officialDefinition={officialDefinition}
                                        handleUpdateProfileKey={handleUpdateProfileKey}
                                        categoryKey={categoryKey}
                                        definitionCategory={definitionCategory}
                                        onChangeMaterialType={onChangeMaterialType}
                                        indent={indent + 1}
                                    />
                                )
                            }
                        </div>
                    );
                })
            }
        </>
    );
};

type TProps = {
    optionConfigGroup: any;
    settings: any;
    definitionForManager: any;
    selectedSettingDefaultValue: any;
    onChangePresetSettings: any;
    onChangeMaterialType?: any; // TODO: refactor
    filters: string[];
    flatten: boolean;
};

/**
 * A 3-column view showing parameters and parameter description.
 *
 * *----------------------------------------------------------*
 * | Categories | Parameter Tree View | Parameter Description |
 * *----------------------------------------------------------*
 *
 * Note: This component will take 100% width and height of its parent.
 */
const ParametersTableView: React.FC<TProps> = (props) => {
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

    // Category anchors
    const [activeCateId, setActiveCateId] = useState(2);

    const scrollDom = useRef(null);
    const fieldsDom = useRef([]);

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

    // For displaying parameter description
    const [selectProfile, setSelectProfile] = useState('');
    const [selectCategory, setSelectCategory] = useState('');
    const [mdContent, setMdContent] = useState('');
    const [imgPath, setImgPath] = useState('');

    const handleUpdateProfileKey = (category: string, profileKey: string) => {
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
                const res = await api.getProfileDocs({
                    lang,
                    selectCategory,
                    selectProfile,
                });
                setMdContent(res.body?.content);
                setImgPath(res.body?.imagePath);
            } catch (e) {
                console.warn(e);
                setMdContent('');
            }
        }
    }, [selectCategory, selectProfile]);

    const displayConfigsGroups = calculateDisplayConfigsGroups(
        flatten ? ParametersViewType.ListView : ParametersViewType.TreeView,
        optionConfigGroup,
        settings,
        filters,
    );

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
                            Object.keys(displayConfigsGroups).map((category, index) => {
                                const displayConfigs = displayConfigsGroups[category];

                                if (!displayConfigs.length) {
                                    return null;
                                }

                                return (
                                    <div key={category}>
                                        {/* {*/}
                                        {/* fieldsDom.current[index]?.clientHeight > 0 && (*/}
                                        {/* TODO: Pre-check optionConfigGroup before rendering */}
                                        <div className="border-bottom-normal padding-bottom-8 margin-vertical-16">
                                            <SvgIcon
                                                name="TitleSetting"
                                                type={['static']}
                                            />
                                            <span className="margin-left-2">
                                                {i18n._(`key-Definition/Catagory-${category}`)}
                                            </span>
                                        </div>
                                        {/* )*/}
                                        {/* }*/}
                                        <div
                                            ref={(el) => {
                                                fieldsDom.current[index] = el;
                                            }}
                                        >
                                            <ParameterItemList
                                                displayConfigs={displayConfigs}
                                                settings={settings}
                                                isDefaultDefinition={definitionForManager?.isRecommended}
                                                onChangePresetSettings={onChangePresetSettings}
                                                selectedSettingDefaultValue={selectedSettingDefaultValue}
                                                officialDefinition={!!definitionForManager?.isDefault}
                                                handleUpdateProfileKey={handleUpdateProfileKey}
                                                categoryKey={category}
                                                definitionCategory={definitionForManager.category}
                                                onChangeMaterialType={onChangeMaterialType}
                                            />
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

export default ParametersTableView;
