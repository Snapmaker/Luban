import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import { Radio } from '../components/Radio';
import Select from '../components/Select';
import { TextInput as Input } from '../components/Input';
import { PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MANAGER_TYPE_QUALITY, HEAD_CNC, HEAD_LASER } from '../../constants';

import i18n from '../../lib/i18n';

/**
 * relationship between UI and placeholder
 * @relationship
<Radio> $createCategoryDescribe
    <span> $createCategorySubDescribe
<Radio> $createItemDescribe
    <span> $createItemSubDescribe
    <span> $selectCategory
 */
const describeCreator = (managerType) => {
    let createCategoryDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Create Material');
    let createCategorySubDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Enter material name');
    let createItemDescribe;
    let createItemSubDescribe;
    let selectCategory;
    let creatorTitle;
    let categoryName;
    let itemName;

    switch (managerType) {
        case HEAD_LASER:
            selectCategory = i18n._('key-Cnc/ToolManger/ProfileCreator-Select material type');
            createItemDescribe = i18n._('key-Laser/PresetManager/ProfileCreator-Create Preset');
            categoryName = i18n._('key-default_category-Default Material');
            itemName = i18n._('key-default_category-Default Preset');
            createItemSubDescribe = i18n._('key-Laser/PresetManager/ProfileCreator-Enter Preset name');
            break;
        case HEAD_CNC:
            selectCategory = i18n._('key-Laser/ToolManger/ProfileCreator-Select material type');
            createItemDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Create Carving Tool');
            categoryName = i18n._('key-default_category-Default Material');
            itemName = i18n._('key-default_category-Default Tool');
            createItemSubDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Enter tool name');
            break;
        case PRINTING_MANAGER_TYPE_MATERIAL:
            createCategoryDescribe = i18n._('key-Printing/ToolManger/ProfileCreatorCategory-Create Material Category'); // '创建材料类目_';
            createCategorySubDescribe = i18n._('key-Printing/ToolManger/ProfileCreatorCategory-Enter material category name'); // '输入材料类目名称_';
            createItemDescribe = i18n._('key-Printing/ToolManger/ProfileCreator-Create Material'); // '创建材料配置_'
            createItemSubDescribe = i18n._('key-Printing/ToolManger/ProfileCreator-Enter material name'); // '输入材料配置名称_'
            selectCategory = i18n._('key-Printing/ToolManger/ProfileCreator-Select material Category name'); // '选择材料类目_
            categoryName = i18n._('key-default_category-Default Material Category'); // '新材料类目名称_
            itemName = i18n._('key-default_category-Default Material'); // '新材料配置名称_
            break;
        case PRINTING_MANAGER_TYPE_QUALITY:
            createCategoryDescribe = i18n._('key-Printing/ToolManger/ProfileCreatorQualityCategory-Create Quality Category'); // '创建材料类目_';
            createCategorySubDescribe = i18n._('key-Printing/ToolManger/ProfileCreatorQualityCategory-Enter quality category name'); // '输入材料类目名称_';
            createItemDescribe = i18n._('key-Printing/ToolManger/ProfileCreator-Create Quality'); // '创建材料配置_'
            createItemSubDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Enter Profile Name'); // '输入材料配置名称_'
            selectCategory = i18n._('key-Printing/ToolManger/ProfileCreator-Select Quality Category name'); // '选择材料类目_
            categoryName = i18n._('key-default_category-Default Quality Category'); // '新材料类目名称_
            itemName = i18n._('key-default_category-Default Quality'); // '新材料配置名称_

            // createCategoryDescribe = '创建打印设置类目_';
            // createCategorySubDescribe = '输入打印设置类目名称_';
            // createItemDescribe = '创建打印设置_';
            // createItemSubDescribe = '输入打印设置名称_';
            // selectCategory = '选择打印设置类目_';
            // categoryName = '新打印设置类目名称_';
            // itemName = '新打印设置名称_';
            break;
        default:
            break;
    }
    return {
        createCategoryDescribe,
        createCategorySubDescribe,
        createItemDescribe,
        createItemSubDescribe,
        creatorTitle,
        selectCategory,
        categoryName,
        itemName
    };
};

const DefinitionCreator = ({
    managerType, isCreate, disableCategory = true, copyType, copyCategoryName, copyItemName, materialOptions
}, ref) => {
    const [displayDescribe] = useState(describeCreator(managerType));

    const [state, setState] = useState({
        createType: 'Category',
        categoryName: '',
        itemName: '',
    });
    useEffect(() => {
        setState((pre) => {
            return {
                ...pre,
                itemName: copyItemName || displayDescribe.itemName,
                categoryName: copyCategoryName || displayDescribe.categoryName
            };
        });
    }, [managerType, copyItemName, copyCategoryName, displayDescribe.categoryName, displayDescribe.itemName]);

    useImperativeHandle(ref, () => ({
        getData: () => {
            return state;
        }
    }));

    const renderCategoryCreate = () => {
        return (
            <div>
                <span className="font-size-base display-block margin-bottom-8">{displayDescribe.createCategorySubDescribe}</span>
                <Input
                    size="432px"
                    onChange={(event) => {
                        const categoryName = event.target.value;
                        setState({ ...state, categoryName });
                    }}
                    value={state.categoryName}
                />
            </div>
        );
    };

    const renderItemCreate = () => {
        return (
            <div>
                <div>
                    <span className="font-size-base display-block margin-bottom-8">{displayDescribe.createItemSubDescribe}</span>
                    <Input
                        size="432px"
                        onChange={(event) => {
                            const itemName = event.target.value;
                            setState({ ...state, itemName });
                        }}
                        value={state.itemName}
                    />

                    {!disableCategory && (
                        <>
                            <p className="margin-top-16 font-size-base margin-bottom-8">
                                {displayDescribe.selectCategory}
                            </p>

                            <Select
                                size="432px"
                                backspaceRemoves={false}
                                clearable={false}
                                options={materialOptions}
                                placeholder={i18n._('key-Cnc/ToolManger/ProfileCreator-Choose font')}
                                value={state.categoryName}
                                onChange={(option) => {
                                    const categoryName = option.label;
                                    setState({ ...state, categoryName });
                                }}
                            />
                        </>
                    )}

                </div>

            </div>
        );
    };

    if (isCreate) {
        return (
            <Radio.Group
                name="comic"
                value={state.createType}
                onChange={(event) => {
                    const value = event.target.value;
                    setState({ ...state, createType: value });
                }}
            >
                <div>
                    <Radio value="Category" className="height-24">{displayDescribe.createCategoryDescribe}</Radio>
                    {state.createType === 'Category' && renderCategoryCreate()}
                </div>

                <div className="margin-top-16">
                    <Radio value="Item" className="height-24">{displayDescribe.createItemDescribe}</Radio>
                    {state.createType === 'Item' && renderItemCreate()}
                </div>

            </Radio.Group>
        );
    } else {
        if (copyType === 'Category') {
            return renderCategoryCreate();
        } else {
            return renderItemCreate();
        }
    }
};

DefinitionCreator.propTypes = {
    managerType: PropTypes.string.isRequired,
    isCreate: PropTypes.bool,
    disableCategory: PropTypes.bool,
    copyType: PropTypes.string,
    copyCategoryName: PropTypes.string,
    copyItemName: PropTypes.string,
    materialOptions: PropTypes.array
};
export default forwardRef(DefinitionCreator);
