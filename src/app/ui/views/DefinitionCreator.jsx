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
            createCategoryDescribe = i18n._('key-Printing/ToolManger/ProfileCreatorCategory-Create Material Category');
            createCategorySubDescribe = i18n._('key-Printing/ToolManger/ProfileCreatorCategory-Enter material category name');
            createItemDescribe = i18n._('key-Printing/ToolManger/ProfileCreator-Create Material');
            createItemSubDescribe = i18n._('key-Printing/ToolManger/ProfileCreator-Enter material name');
            selectCategory = i18n._('key-Printing/ToolManger/ProfileCreator-Select material Category name');
            categoryName = i18n._('key-default_category-Default Material Category');
            itemName = i18n._('key-default_category-Default Material');
            break;
        case PRINTING_MANAGER_TYPE_QUALITY:
            createCategoryDescribe = i18n._('key-Printing/ToolManger/ProfileCreatorQualityCategory-Create Quality Category');
            createCategorySubDescribe = i18n._('key-Printing/ToolManger/ProfileCreatorQualityCategory-Enter quality category name');
            createItemDescribe = i18n._('key-Printing/ToolManger/ProfileCreator-Create Quality');
            createItemSubDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Enter Profile Name');
            selectCategory = i18n._('key-Printing/ToolManger/ProfileCreator-Select Quality Category name');
            categoryName = i18n._('key-default_category-Default Quality Category');
            itemName = i18n._('key-default_category-Default Quality');
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
    managerType, isCreate, copyType, copyCategoryName, copyCategoryI18n, copyItemName, materialOptions
}, ref) => {
    const [displayDescribe] = useState(describeCreator(managerType));

    const [state, setState] = useState({
        createType: 'Category',
        categoryName: '',
        categoryI18n: '',
        itemName: '',
    });
    useEffect(() => {
        setState((pre) => {
            return {
                ...pre,
                itemName: copyItemName || displayDescribe.itemName,
                categoryName: copyCategoryName || displayDescribe.categoryName,
                categoryI18n: copyCategoryI18n
            };
        });
    }, [managerType, copyItemName, copyCategoryName, displayDescribe.categoryName, displayDescribe.itemName, copyCategoryI18n]);

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
                                setState({
                                    ...state,
                                    categoryName: option.label,
                                    categoryI18n: option.i18n
                                });
                            }}
                        />
                    </>

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
    copyType: PropTypes.string,
    copyCategoryName: PropTypes.string,
    copyCategoryI18n: PropTypes.string,
    copyItemName: PropTypes.string,
    materialOptions: PropTypes.array
};
export default forwardRef(DefinitionCreator);
