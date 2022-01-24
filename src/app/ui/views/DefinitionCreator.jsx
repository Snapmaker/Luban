import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import { Radio } from '../components/Radio';
import Select from '../components/Select';
import { TextInput as Input } from '../components/Input';
import { HEAD_LASER, HEAD_CNC, HEAD_PRINTING } from '../../constants';

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
const describeCreator = (headType) => {
    let createCategoryDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Create Material');
    let createCategorySubDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Enter material name');
    let createItemDescribe;

    let createItemSubDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Enter Profile Name');
    let selectCategory;
    let creatorTitle;
    let categoryName = i18n._('key-default_category-Default Material');
    let itemName = i18n._('key-default_category-Default Preset');

    switch (headType) {
        case HEAD_LASER:
            selectCategory = i18n._('key-Cnc/ToolManger/ProfileCreator-Select material type');
            createItemDescribe = i18n._('key-Laser/PresetManager/ProfileCreator-Create Preset');
            categoryName = i18n._('key-default_category-Default Material');
            itemName = i18n._('key-default_category-Default Preset');
            break;
        case HEAD_CNC:
            selectCategory = i18n._('key-Laser/ToolManger/ProfileCreator-Select material type');
            createItemDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Create Carving Tool');
            categoryName = i18n._('key-default_category-Default Material');
            itemName = i18n._('key-default_category-Default Tool');
            break;
        case HEAD_PRINTING:
            // selectCategory = i18n._('key-Laser/ToolManger/ProfileCreator-Select material type');
            // createItemDescribe = i18n._('key-Cnc/ToolManger/ProfileCreator-Create Carving Tool');
            createCategoryDescribe = '创建材料类目_';
            createCategorySubDescribe = '输入材料类目名称_';
            createItemDescribe = '创建材料配置_';
            createItemSubDescribe = '输入材料配置名称_';
            selectCategory = '选择材料类目_';
            categoryName = '新材料类目名称_';
            itemName = '新材料配置名称_';
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
    headType, isCreate, disableCategory = true, copyType, copyCategoryName, copyItemName, materialOptions
}, ref) => {
    const [displayDescribe] = useState(describeCreator(headType));

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
    }, [headType, copyItemName, copyCategoryName, displayDescribe.categoryName, displayDescribe.itemName]);

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
    headType: PropTypes.string.isRequired,
    isCreate: PropTypes.bool,
    disableCategory: PropTypes.bool,
    copyType: PropTypes.string,
    copyCategoryName: PropTypes.string,
    copyItemName: PropTypes.string,
    materialOptions: PropTypes.array
};
export default forwardRef(DefinitionCreator);
