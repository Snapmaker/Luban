import { Menu } from 'antd';
import classNames from 'classnames';
import { includes, remove, cloneDeep } from 'lodash';
import PropTypes from 'prop-types';
import React, { useRef, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { HEAD_PRINTING, LEFT_EXTRUDER, RIGHT_EXTRUDER, PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import { getMachineSeriesWithToolhead, isDualExtruder } from '../../../constants/machines';
import { PRESET_CATEGORY_DEFAULT } from '../../../constants/preset';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import Dropdown from '../../components/Dropdown';
import SvgIcon from '../../components/SvgIcon';
import { getPresetOptions } from '../../utils/profileManager';
import DefinitionCreator from '../DefinitionCreator';
import styles from './styles.styl';

/**
 * Stack and preset selector.
 *
 * Select a stack, and then select a preset for it.
 *
 * @param selectedStackId
 * @param selectedPresetId
 * @param onSelectStack
 * @param onSelectPreset
 * @returns {*}
 * @constructor
 */
const StackPresetSelector = ({ selectedStackId, selectedPresetId, onSelectStack, onSelectPreset }) => {
    const dispatch = useDispatch();
    const { series, toolHead, toolHead: { printingToolhead } } = useSelector(state => state?.machine);
    // quality
    const {
        qualityDefinitions,
        qualityDefinitionsRight,
        materialDefinitions,
        defaultMaterialId,
        defaultMaterialIdRight,
    } = useSelector(state => state?.printing);

    const [presetModel, setPresetModel] = useState(null);
    const [presetOptionsObj, setPresetOptionsObj] = useState(null);

    // expanded categories, only for displaying
    const [expandedPresetCategories, setExpandedPresetCategories] = useState([PRESET_CATEGORY_DEFAULT]);

    useEffect(() => {
        const presetModels = selectedStackId === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight;

        const materialPresetId = selectedStackId === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight;
        const materialPreset = materialDefinitions.find(p => p.definitionId === materialPresetId);

        const newPresetOptionsObj = getPresetOptions(presetModels, materialPreset);
        setPresetOptionsObj(newPresetOptionsObj);

        // set all preset categories expanded
        setExpandedPresetCategories(Object.keys(newPresetOptionsObj));
    }, [selectedStackId, defaultMaterialId, defaultMaterialIdRight, qualityDefinitions, qualityDefinitionsRight]);

    // Get active preset model
    useEffect(() => {
        const presetModels = selectedStackId === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight;
        const targetPresetModel = presetModels.find(p => p.definitionId === selectedPresetId);
        setPresetModel(targetPresetModel);
    }, [selectedStackId, selectedPresetId]);

    // stackId: LEFT_EXTRUDER or RIGHT_EXTRUDER
    // Maybe support a global stack later
    function selectStack(stackId) {
        onSelectStack(stackId);
    }

    /**
     * Toggle expansion of a preset category.
     *
     * @param presetCategory
     */
    const togglePresetCategoryExpansion = (presetCategory) => {
        const newCategories = [...expandedPresetCategories];
        if (includes(expandedPresetCategories, presetCategory)) {
            remove(newCategories, (item) => {
                return item === presetCategory;
            });
        } else {
            newCategories.push(presetCategory);
        }
        setExpandedPresetCategories(newCategories);
    };

    /**
     * Select preset for selected stack.
     *
     * @param presetId
     */
    function selectPresetByPresetId(presetId) {
        onSelectPreset(presetId);
    }


    const refs = {
        refCreateModal: useRef(null)
    };

    // TODO: actions from PrintingManager.jsx, need refactor
    const actions = {
        onCreateManagerDefinition: async (
            definition,
            name,
            isCategorySelected,
            isCreate
        ) => {
            let result = {};
            if (isCategorySelected) {
                const oldCategoryName = definition.category;
                definition.category = name;
                result = await dispatch(
                    printingActions.duplicateMaterialCategoryDefinitionByType(
                        PRINTING_MANAGER_TYPE_QUALITY,
                        definition,
                        isCreate,
                        oldCategoryName
                    )
                );
            } else {
                definition.name = name;
                result = await dispatch(
                    printingActions.duplicateDefinitionByType(
                        PRINTING_MANAGER_TYPE_QUALITY,
                        definition,
                        undefined,
                        name
                    )
                );
            }
            return result;
        },
        onSelectDefinitionById: (definitionId) => {
            console.log('select preset id =', definitionId);
            if (definitionId === presetModel.definitionId) {
                return;
            }

            selectPresetByPresetId(definitionId);
        },

        onRemoveManagerDefinition: async () => {
            if (presetModel.isRecommended) {
                return;
            }
            const deleteName = presetModel.name;
            const popupActions = modal({
                title: i18n._('key-Printing/ProfileManager-Delete Profile'),
                body: (
                    <React.Fragment>
                        <p>{i18n._('key-ProfileManager-Are you sure to delete profile "{{name}}"?', { name: deleteName })}</p>
                    </React.Fragment>
                ),

                footer: (
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        onClick={async () => {
                            // After deletion, the first item is selected by default
                            // setDefinitionState({
                            //     activeDefinitionID: '',
                            // });

                            // await outsideActions.removeManagerDefinition(definition);
                            await dispatch(
                                printingActions.removeDefinitionByType(
                                    PRINTING_MANAGER_TYPE_QUALITY,
                                    presetModel,
                                )
                            );
                            popupActions.close();
                        }}
                    >
                        {i18n._('key-Printing/ProfileManager-Delete')}
                    </Button>
                )
            });
        },

        showDuplicateModal: () => {
            actions.showInputModal({
                isCreate: false
            });
        },
        showInputModal: ({ isCreate }) => {
            let copyType = '', copyItemName = '';

            let title = i18n._('key-Printing/ProfileManager-Create Profile');
            if (!isCreate) {
                title = i18n._('key-Printing/ProfileManager-Copy Profile');
                copyType = 'Item';
                copyItemName = presetModel.name;
            } else {
                title = i18n._('key-Printing/ProfileManager-Create Profile');
                copyType = 'Item';
                copyItemName = i18n._('key-default_category-New Profile');
            }

            const categories = Object.keys(presetOptionsObj).filter(c => c !== PRESET_CATEGORY_DEFAULT);
            const materialOptions = categories.map(category => {
                return {
                    label: category,
                    value: category,
                    i18n: category,
                };
            });

            const copyCategoryName = presetModel.category !== PRESET_CATEGORY_DEFAULT ? presetModel.category : categories[0];

            const popupActions = modal({
                title: title,
                body: (
                    <React.Fragment>
                        <DefinitionCreator
                            managerType={PRINTING_MANAGER_TYPE_QUALITY}
                            showRadio={false}
                            isCreate={isCreate}
                            ref={refs.refCreateModal}
                            materialOptions={materialOptions}
                            copyType={copyType}
                            copyCategoryName={copyCategoryName}
                            copyItemName={copyItemName}
                        />
                    </React.Fragment>
                ),
                footer: (
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        onClick={async () => {
                            const data = refs.refCreateModal.current.getData();
                            let newDefinitionForManager;
                            if (presetModel.getSerializableDefinition) {
                                newDefinitionForManager = cloneDeep(presetModel.getSerializableDefinition());
                            } else {
                                newDefinitionForManager = cloneDeep(presetModel);
                            }

                            let newName = '';
                            popupActions.close();
                            if (!isCreate) {
                                // if (isCategorySelected) {
                                //     newName = data.categoryName;
                                //     const newDefinition = await outsideActions.onCreateManagerDefinition(newDefinitionForManager, newName, isCategorySelected);
                                //     actions.onSelectCategory(newDefinition.category);
                                // } else {
                                newDefinitionForManager.category = data.categoryName;
                                newName = data.itemName;
                                const newDefinition = await actions.onCreateManagerDefinition(newDefinitionForManager, newName, false);
                                setTimeout(() => {
                                    actions.onSelectDefinitionById(newDefinition.definitionId);
                                }, 50);
                                // }
                            } else {
                                if (data.createType === 'Category') {
                                    newDefinitionForManager.category = data.categoryName;
                                    newName = data.categoryName;
                                    newDefinitionForManager.settings = {};
                                    const newDefinition = await actions.onCreateManagerDefinition(newDefinitionForManager, newName, data.createType === 'Category', isCreate);
                                    actions.onSelectCategory(newDefinition.category);
                                } else {
                                    newDefinitionForManager.category = data.categoryName;
                                    newName = data.itemName;
                                    // if (Object.keys(newDefinitionForManager.settings).length === 0) {
                                    //     newDefinitionForManager.settings = cloneDeep(allDefinitions[0].settings);
                                    // }
                                    const newDefinition = await actions.onCreateManagerDefinition(newDefinitionForManager, newName, data.createType === 'Category', isCreate);
                                    setTimeout(() => {
                                        actions.onSelectDefinitionById(newDefinition.definitionId);
                                    }, 50);
                                }
                            }
                        }}
                    >
                        {i18n._('key-Printing/ProfileManager-Save')}
                    </Button>
                )
            });
        },
        exportConfigFile: (presetId) => {
            if (!presetModel) {
                return;
            }

            const targetFile = `${presetId}.def.json`;
            const currentMachine = getMachineSeriesWithToolhead(
                series,
                toolHead
            );

            dispatch(
                projectActions.exportConfigFile(
                    targetFile,
                    `${HEAD_PRINTING}/${currentMachine.configPathname[HEAD_PRINTING]}`,
                    `${presetModel.name}.def.json`
                )
            );
        }
    };

    return (
        <div
            className="width-264 min-width-264 background-color-white height-percent-100 sm-flex sm-flex-direction-c"
            style={{
                minWidth: '264px'
            }}
        >
            <div className="height-60 border-bottom-normal">
                <div className="sm-flex height-percent-100 height-percent-100 unit-text padding-horizontal-16">
                    <Anchor
                        className={classNames('padding-horizontal-3', `${selectedStackId === LEFT_EXTRUDER ? 'border-bottom-black-3' : ''}`)}
                        onClick={() => selectStack(LEFT_EXTRUDER)}
                    >
                        <span className={classNames('font-size-middle line-height-32 display-inline', `${selectedStackId === LEFT_EXTRUDER ? 'font-weight-bold color-black-2' : 'font-weight-normal color-black-4'}`)}>
                            {i18n._('Left Extruder')}
                        </span>
                    </Anchor>
                    <Anchor
                        className={classNames('padding-horizontal-3', `${selectedStackId === RIGHT_EXTRUDER ? 'border-bottom-black-3' : ''}`)}
                        onClick={() => selectStack(RIGHT_EXTRUDER)}
                        disabled={!isDualExtruder(printingToolhead)}
                    >
                        <span className={classNames('font-size-middle line-height-32 display-inline', `${selectedStackId === RIGHT_EXTRUDER ? 'font-weight-bold color-black-2' : 'font-weight-normal color-black-4'}`)}>
                            {i18n._('Right Extruder')}
                        </span>
                    </Anchor>
                </div>
            </div>
            <div className="flex-grow-1">
                {
                    presetModel && presetOptionsObj && Object.keys(presetOptionsObj).map((presetCategory) => {
                        const expanded = includes(expandedPresetCategories, presetCategory);
                        return (
                            <li key={presetCategory}>
                                <Anchor onClick={() => togglePresetCategoryExpansion(presetCategory)}>
                                    <div className={classNames('width-percent-100')}>
                                        <SvgIcon
                                            name="DropdownOpen"
                                            type={['static']}
                                            className={classNames({ 'rotate270': !expanded })}
                                        />
                                        <span>{presetOptionsObj[presetCategory].category}</span>
                                    </div>
                                </Anchor>
                                <ul style={{ listStyle: 'none', padding: '0' }}>
                                    {
                                        presetOptionsObj[presetCategory].options && presetOptionsObj[presetCategory].options.map(option => {
                                            const isSelected = selectedPresetId === option.definitionId;
                                            return (
                                                <li
                                                    key={option.definitionId}
                                                    className={classNames('display-block height-32', {
                                                        'display-block': expanded,
                                                        'display-none': !expanded,
                                                    })}
                                                >
                                                    <Anchor
                                                        key={option.definitionId}
                                                        className={classNames(
                                                            styles['manager-btn'],
                                                            'width-percent-100',
                                                            'text-overflow-ellipsis',
                                                            'sm-flex',
                                                            'justify-flex-end',
                                                            {
                                                                [styles.selected]: isSelected,
                                                                'background-color-blue': isSelected,
                                                            },
                                                        )}
                                                        onClick={() => selectPresetByPresetId(option.definitionId)}
                                                    >
                                                        <span className="flex-grow-1 border-radius-4 height-32 padding-horizontal-24 ">
                                                            {option.label}
                                                        </span>
                                                        {
                                                            isSelected && (
                                                                <div className={classNames('width-32 height-32', styles['manager-action'])}>
                                                                    <Dropdown
                                                                        placement="bottomRight"
                                                                        overlay={(
                                                                            <Menu>
                                                                                <Menu.Item>
                                                                                    <Anchor onClick={actions.showDuplicateModal}>
                                                                                        <div className="width-120 text-overflow-ellipsis">{i18n._('key-App/Menu-Copy')}</div>
                                                                                    </Anchor>
                                                                                </Menu.Item>
                                                                                <Menu.Item>
                                                                                    <Anchor onClick={() => actions.exportConfigFile(selectedPresetId)}>
                                                                                        <div className="width-120 text-overflow-ellipsis">{i18n._('key-Printing/ProfileManager-Export')}</div>
                                                                                    </Anchor>
                                                                                </Menu.Item>
                                                                                {
                                                                                    !presetModel.isRecommended && (
                                                                                        <Menu.Item>
                                                                                            <Anchor onClick={() => actions.onRemoveManagerDefinition()}>
                                                                                                <div>{i18n._('key-Printing/ProfileManager-Delete')}</div>
                                                                                            </Anchor>
                                                                                        </Menu.Item>
                                                                                    )
                                                                                }
                                                                            </Menu>
                                                                        )}
                                                                    >
                                                                        <SvgIcon
                                                                            name="More"
                                                                            size={24}
                                                                            hoversize={24}
                                                                            type={['static']}
                                                                        />
                                                                    </Dropdown>
                                                                </div>
                                                            )
                                                        }
                                                    </Anchor>
                                                </li>
                                            );
                                        })
                                    }
                                </ul>
                            </li>
                        );
                    })
                }
            </div>
            <div className="margin-bottom-16" />
        </div>
    );
};

StackPresetSelector.propTypes = {
    selectedStackId: PropTypes.string.isRequired,
    selectedPresetId: PropTypes.string.isRequired,
    onSelectStack: PropTypes.func.isRequired,
    onSelectPreset: PropTypes.func.isRequired
};

export default StackPresetSelector;
