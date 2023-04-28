import React, { useEffect, useState, useMemo } from 'react';
import { Divider } from 'antd';

import { PRESET_CATEGORY_CUSTOM, PRESET_CATEGORY_DEFAULT } from '../../../../constants/preset';
import i18n from '../../../../lib/i18n';
import { TextInput } from '../../../components/Input';
import Select from '../../../components/Select';
import SvgIcon from '../../../components/SvgIcon';
import { Button } from '../../../components/Buttons';
import { ModalHOC } from '../../../../lib/modal';

import type { QualityPresetModel } from '../../../../preset-model';
import { PresetActionsType } from '../usePresetActions';


declare type CreatePresetModalProps = {
    createOrCopy: 'create' | 'copy';

    presetModel: QualityPresetModel;

    // existing categories
    categories: string[];

    presetActions: PresetActionsType;

    onClose: () => void;
};

/**
 * Show modal for creating preset.
 */
const CreatePresetModal: React.FC<CreatePresetModalProps> = (props) => {
    const { createOrCopy, presetModel, categories, presetActions, onClose } = props;

    const [presetName, setPresetName] = useState('');

    const [availableCategories, setAvailableCategories] = useState([]);
    const [presetCategory, setPresetCategory] = useState(PRESET_CATEGORY_CUSTOM);
    // allow user to create new category
    const [newCategory, setNewCategory] = useState('');

    useEffect(() => {
        if (presetModel) {
            const newPresetName = createOrCopy === 'create' ? i18n._('key-default_category-New Profile') : `#${presetModel.name}`;
            setPresetName(newPresetName);

            const newPresetCategory = presetModel.category !== PRESET_CATEGORY_DEFAULT ? presetModel.category : PRESET_CATEGORY_CUSTOM;
            setPresetCategory(newPresetCategory);
        } else {
            setPresetName('New Profile');
            setPresetCategory(PRESET_CATEGORY_CUSTOM);
        }
    }, [presetModel, createOrCopy]);

    useEffect(() => {
        const newCategories = categories.filter(c => c !== PRESET_CATEGORY_DEFAULT);
        if (!newCategories.includes(PRESET_CATEGORY_CUSTOM)) {
            newCategories.push(PRESET_CATEGORY_CUSTOM);
        }
        setAvailableCategories(newCategories);
    }, [categories]);

    const categoryOptions = useMemo(() => {
        return availableCategories.map(category => {
            return {
                label: category,
                value: category,
            };
        });
    }, [availableCategories]);

    // popup
    let title;
    if (createOrCopy === 'create') {
        title = i18n._('key-Printing/ProfileManager-Create Profile');
    } else {
        title = i18n._('key-Printing/ProfileManager-Copy Profile');
    }
    const presetNamePrompt = i18n._('key-Cnc/ToolManger/ProfileCreator-Enter Profile Name');
    const presetCategoryPrompt = i18n._('key-Printing/ToolManger/ProfileCreator-Select Quality Category name');

    return (
        <ModalHOC
            title={title}
            removeContainer={onClose}
            body={(
                <div>
                    <div className="font-size-base display-block margin-bottom-8">{presetNamePrompt}</div>
                    <TextInput
                        size="432px"
                        onChange={(event) => {
                            setPresetName(event.target.value);
                        }}
                        value={presetName}
                    />
                    <div className="margin-top-16 font-size-base margin-bottom-8">{presetCategoryPrompt}</div>
                    <Select
                        size="432px"
                        backspaceRemoves={false}
                        clearable={false}
                        options={categoryOptions}
                        placeholder={i18n._('key-Cnc/ToolManger/ProfileCreator-Choose font')}
                        value={presetCategory}
                        onChange={(option) => setPresetCategory(option.value)}
                        dropdownRender={menu => (
                            <>
                                {menu}
                                <Divider style={{ margin: '0' }} />
                                <TextInput
                                    value={newCategory}
                                    bordered={false}
                                    placeholder={i18n._('key-Printing/PrintingConfigurations-Add Item')}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                />
                                {!!newCategory && (
                                    <SvgIcon
                                        className="margin-top-2"
                                        color="#1890FF"
                                        name="CameraCaptureExtract"
                                        onClick={() => {
                                            if (!availableCategories.includes(newCategory)) {
                                                const newAvailableCategories = [...availableCategories, newCategory];

                                                setAvailableCategories(newAvailableCategories);
                                            }

                                            setPresetCategory(newCategory);
                                            setNewCategory(''); // clear
                                        }}
                                    />
                                )}
                            </>
                        )}
                    />
                </div>
            )}
            footer={(
                // @ts-ignore
                <Button
                    priority="level-two"
                    className="margin-left-8"
                    width="96px"
                    onClick={async () => {
                        /*
                        const newDefinitionForManager = cloneDeep(presetModel.getSerializableDefinition());
                        newDefinitionForManager.category = presetCategory;
                        newDefinitionForManager.name = presetName;

                        const newPresetModel = await presetActions.onCreateManagerDefinition(newDefinitionForManager);
                        */

                        const clonedPresetModel = presetModel.clone();
                        clonedPresetModel.name = presetName;
                        clonedPresetModel.category = presetCategory;

                        const newPresetModel = await presetActions.onCreateManagerDefinition(clonedPresetModel);

                        onClose();

                        // Select newly created preset
                        // TODO: This is a temporary solution,
                        setTimeout(() => {
                            presetActions.onSelectDefinitionById(newPresetModel.definitionId);
                        }, 50);
                    }}
                >
                    {i18n._('key-Printing/ProfileManager-Save')}
                </Button>
            )}
        />
    );
};

export default CreatePresetModal;
