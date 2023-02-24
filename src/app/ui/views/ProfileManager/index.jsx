import { Menu, Tooltip } from 'antd';
import classNames from 'classnames';
import { cloneDeep, findIndex, isUndefined, orderBy, uniqWith } from 'lodash';
import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';

import {
    MATERIAL_TYPE_OPTIONS,
    PRINTING_MANAGER_TYPE_MATERIAL,
    PRINTING_MANAGER_TYPE_QUALITY
} from '../../../constants';
import log from '../../../lib/log';
import useSetState from '../../../lib/hooks/set-state';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import Dropdown from '../../components/Dropdown';
import Modal from '../../components/Modal';
import Notifications from '../../components/Notifications';

import SvgIcon from '../../components/SvgIcon';

import AddMaterialModel from '../../pages/MachineMaterialSettings/addMaterialModel';

import { MaterialWithColor } from '../../widgets/PrintingMaterial/MaterialWithColor';

import DefinitionCreator from '../DefinitionCreator';
import PresetContent from './PresetContent';
import styles from './styles.styl';

/**
 * Do category fields in different types of profiles have values, and multilingual support
 * @fields                  category | i18nCategory
 *
 * @DefaultType                 √    |     √
 * @CopyType from default       √    |     √
 * @CustomType                  √    |     ×
 * @CopyType from custom        √    |     x
 * @ImportType                  ×    |     ×
 *
 * @ExportType                  ×    |     ×
 */
const DEFAULT_DISPLAY_TYPE = 'key-default_category-Default';
const MATERIAL_TYPE_ARRAY = MATERIAL_TYPE_OPTIONS.map(d => d.category);
export const materialCategoryRank = [
    'PLA',
    'Support',
    'ABS',
    'PETG',
    'TPE',
    'TPU',
    'PVA',
    'ASA',
    'PC',
    'Nylon',
    'Other'
];

function creatCateArray(optionList, managerType) {
    let cates = [];
    optionList.forEach(option => {
        // Make sure that the copied description file is displayed in the correct position after switching the language
        const cateItem = cates.find((cate) => {
            return cate.category === option.category;
        });
        if (cateItem) {
            cateItem.items.push(option);
        } else {
            const eachCate = { items: [] };
            eachCate.category = option.category;
            eachCate.i18nCategory = option.i18nCategory;
            eachCate.items.push(option);
            if (managerType === PRINTING_MANAGER_TYPE_MATERIAL) {
                eachCate.rank = findIndex(materialCategoryRank, arr => {
                    return arr === option.category;
                });
            } else {
                if (option.category === 'Default') {
                    eachCate.rank = 1;
                } else {
                    eachCate.rank = 0;
                }
            }
            cates.push(eachCate);
        }
    });
    cates = orderBy(cates, ['rank'], [`${managerType === PRINTING_MANAGER_TYPE_MATERIAL ? 'asc' : 'desc'}`]);
    return cates;
}

export function useGetDefinitions(allDefinitions, activeDefinitionID, getDefaultDefinition, managerType) {
    const [definitionState, setDefinitionState] = useSetState({
        activeDefinitionID,
        definitionForManager: allDefinitions.find(d => d.definitionId === activeDefinitionID) || null,
        selectedSettingDefaultValue: getDefaultDefinition(activeDefinitionID),
        definitionOptions: [],
        selectedName: '',
        isCategorySelected: false,
        renamingStatus: false,
        cates: []
    });

    useEffect(() => {
        const definitionOptions = allDefinitions.map(d => {
            let actualCategory = d.category, actualColor = null;
            if (managerType === PRINTING_MANAGER_TYPE_MATERIAL && !(MATERIAL_TYPE_ARRAY.includes(d.category))) {
                actualCategory = 'Other';
            }
            if (managerType === PRINTING_MANAGER_TYPE_MATERIAL) {
                actualColor = d.settings.color ? d.settings.color.default_value : '#000000';
            }
            return {
                label: i18n._(d.i18nName || d.name),
                value: d.definitionId,
                i18nCategory: d.i18nCategory,
                isHidden: !d.settings || Object.keys(d.settings).length === 0,
                isDefault: !!d.isDefault,
                color: actualColor,
                category: actualCategory
            };
        });

        setDefinitionState((prev) => {
            let definitionForManager;
            let selectedSettingDefaultValue;
            if (prev.definitionForManager === definitionState.definitionForManager?.definitionId) {
                definitionForManager = prev.definitionForManager;
                selectedSettingDefaultValue = prev.selectedSettingDefaultValue;
            } else {
                definitionForManager = allDefinitions.find(d => d.definitionId === (definitionState.definitionForManager?.definitionId || activeDefinitionID));
                if (!definitionForManager) {
                    definitionForManager = allDefinitions[0];
                    log.debug('Preset does not exist. Select first preset instead:', definitionForManager.definitionId);
                    console.log('Preset does not exist. Select first preset instead:', definitionForManager.definitionId);
                }
                selectedSettingDefaultValue = getDefaultDefinition(definitionForManager?.definitionId);
            }

            return {
                definitionOptions,
                cates: creatCateArray(definitionOptions, managerType),
                definitionForManager,
                selectedSettingDefaultValue
            };
        });
    }, [allDefinitions, activeDefinitionID]);

    return [definitionState, setDefinitionState];
}

function ProfileManager(
    {
        optionConfigGroup,
        managerTitle,
        activeDefinitionID,
        allDefinitions,
        outsideActions,
        isOfficialDefinition,
        managerType,
        customConfig,
        onChangeCustomConfig
    }
) {
    const [definitionState, setDefinitionState] = useGetDefinitions(allDefinitions, activeDefinitionID, outsideActions.getDefaultDefinition, managerType);
    const [showCreateMaterialModal, setShowCreateMaterialModal] = useState(false);
    const currentDefinitions = useRef(allDefinitions);
    currentDefinitions.current = allDefinitions;

    const [configExpanded, setConfigExpanded] = useState({});
    const [notificationMessage, setNotificationMessage] = useState('');
    const refs = {
        fileInput: useRef(null),
        renameInput: useRef(null),
        refCreateModal: useRef(null)
    };

    const actions = {
        isCategorySelectedNow: (category) => {
            const { definitionForManager, isCategorySelected } = definitionState;
            if (!isCategorySelected) {
                return false;
            }

            return definitionForManager.category === category;
        },
        setRenamingStatus: (status) => {
            const currentDefinition = definitionState?.definitionForManager;
            if (isOfficialDefinition(currentDefinition)) {
                return;
            } else if (!status) {
                setDefinitionState({
                    renamingStatus: status
                });
                return;
            }
            if (status) {
                const title = definitionState.isCategorySelected ? currentDefinition.category : currentDefinition.name;
                setDefinitionState({
                    selectedName: title,
                    renamingStatus: status
                });

                setTimeout(() => {
                    refs.renameInput.current.focus();
                }, 0);
            }
        },
        // onSelectedQualityDefinition
        onSelectDefinitionById: (definitionId, name) => {
            const { definitionForManager, isCategorySelected } = definitionState;
            if (!isCategorySelected && definitionId === definitionForManager.definitionId) {
                return;
            }
            let selected;
            if (!name) {
                selected = currentDefinitions.current.find(d => d.definitionId === definitionId);
            } else {
                selected = currentDefinitions.current.find(d => d.definitionId === definitionId && d.name === name);
            }

            if (definitionState?.renamingStatus) {
                actions.setRenamingStatus(false);
            }
            if (selected) {
                const selectedSettingDefaultValue = outsideActions.getDefaultDefinition(selected.definitionId);
                setDefinitionState({
                    definitionForManager: selected,
                    isCategorySelected: false,
                    selectedName: selected.name,
                    selectedSettingDefaultValue: selectedSettingDefaultValue
                });
            }
        },
        onSelectCategory: (category) => {
            const { definitionForManager, isCategorySelected, renamingStatus } = definitionState;
            if (isCategorySelected && category === definitionForManager.category) {
                return;
            }
            if (renamingStatus) {
                actions.setRenamingStatus(false);
            }
            const activeToolCategory = currentDefinitions.current.find(d => {
                return d.category === category;
            });
            const selectedSettingDefaultValue = outsideActions.getDefaultDefinition(activeToolCategory.definitionId);
            setDefinitionState({
                definitionForManager: activeToolCategory,
                selectedName: activeToolCategory.category,
                isCategorySelected: true,
                selectedSettingDefaultValue: selectedSettingDefaultValue
            });
        },
        foldCategory: (category) => {
            configExpanded[category] = !configExpanded[category];
            setConfigExpanded(JSON.parse(JSON.stringify(configExpanded)));
        },
        onRemoveManagerDefinition: async (definition, isCategorySelected) => {
            if (isOfficialDefinition(definitionState.definitionForManager)) {
                return;
            }
            const deleteName = isCategorySelected ? definition.category : definition.name;
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
                            setDefinitionState({
                                activeDefinitionID: '',
                                isCategorySelected: false
                            });

                            if (!isCategorySelected) {
                                await outsideActions.removeManagerDefinition(definition);
                            } else if (isCategorySelected && outsideActions.removeCategoryDefinition) {
                                await outsideActions.removeCategoryDefinition(definition);
                            }
                            popupActions.close();
                        }}
                    >
                        {i18n._('key-Printing/ProfileManager-Delete')}
                    </Button>
                )
            });
        },
        showNewModal: () => {
            actions.showInputModal({
                isCreate: true
            });
        },
        showDuplicateModal: () => {
            actions.showInputModal({
                isCreate: false
            });
        },
        showInputModal: ({ isCreate }) => {
            const definitionForManager = definitionState?.definitionForManager;
            const isCategorySelected = definitionState?.isCategorySelected;
            let title = i18n._('key-Printing/ProfileManager-Create Profile');
            let copyType = '', copyCategoryName = '', copyItemName = '';

            if (!isCreate) {
                title = i18n._('key-Printing/ProfileManager-Copy Profile');
                copyType = isCategorySelected ? 'Category' : 'Item';
                if (!isCategorySelected) {
                    copyItemName = definitionForManager.name;
                }
            } else {
                title = i18n._('key-Printing/ProfileManager-Create Profile');
                copyType = 'Item';
                copyItemName = i18n._('key-default_category-New Profile');
            }
            copyCategoryName = definitionForManager.category;

            let materialOptions = definitionState?.definitionOptions.map(option => {
                return {
                    label: option.i18nCategory || option.category,
                    value: option.category,
                    i18n: option.i18nCategory
                };
            });
            if (managerType === PRINTING_MANAGER_TYPE_QUALITY) {
                copyCategoryName = (definitionForManager.category !== i18n._(DEFAULT_DISPLAY_TYPE)) ? definitionForManager.category : '';
                materialOptions = materialOptions.filter((option) => {
                    return option.value !== i18n._(DEFAULT_DISPLAY_TYPE);
                });
                if (materialOptions.length === 0) {
                    materialOptions.push({
                        label: i18n._('key-default_category-Custom'),
                        value: i18n._('key-default_category-Custom'),
                        i18n: 'key-default_category-Custom'
                    });
                }
            }
            materialOptions = uniqWith(materialOptions, (a, b) => {
                return a.label === b.label;
            });

            const popupActions = modal({
                title: title,
                body: (
                    <React.Fragment>
                        <DefinitionCreator
                            managerType={managerType}
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
                            if (definitionState.definitionForManager.getSerializableDefinition) {
                                newDefinitionForManager = cloneDeep(definitionState.definitionForManager.getSerializableDefinition());
                            } else {
                                newDefinitionForManager = cloneDeep(definitionState.definitionForManager);
                            }

                            let newName = '';
                            popupActions.close();
                            if (!isCreate) {
                                if (isCategorySelected) {
                                    newName = data.categoryName;
                                    const newDefinition = await outsideActions.onCreateManagerDefinition(newDefinitionForManager, newName, isCategorySelected);
                                    actions.onSelectCategory(newDefinition.category);
                                } else {
                                    newDefinitionForManager.category = data.categoryName;
                                    newName = data.itemName;
                                    const newDefinition = await outsideActions.onCreateManagerDefinition(newDefinitionForManager, newName, isCategorySelected);
                                    setTimeout(() => {
                                        actions.onSelectDefinitionById(newDefinition.definitionId, newDefinition.name);
                                    }, 50);
                                }
                            } else {
                                if (data.createType === 'Category') {
                                    newDefinitionForManager.category = data.categoryName;
                                    newName = data.categoryName;
                                    newDefinitionForManager.settings = {};
                                    const newDefinition = await outsideActions.onCreateManagerDefinition(newDefinitionForManager, newName, data.createType === 'Category', isCreate);
                                    actions.onSelectCategory(newDefinition.category);
                                } else {
                                    newDefinitionForManager.category = data.categoryName;
                                    newName = data.itemName;
                                    if (Object.keys(newDefinitionForManager.settings).length === 0) {
                                        newDefinitionForManager.settings = cloneDeep(allDefinitions[0].settings);
                                    }
                                    const newDefinition = await outsideActions.onCreateManagerDefinition(newDefinitionForManager, newName, data.createType === 'Category', isCreate);
                                    setTimeout(() => {
                                        actions.onSelectDefinitionById(newDefinition.definitionId, newDefinition.name);
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
        onChangeSelectedName: (event) => {
            setDefinitionState({
                selectedName: event.target.value
            });
        },
        updateDefinitionName: async () => {
            const definition = definitionState?.definitionForManager;
            const selectedName = definitionState.selectedName;
            if (selectedName !== definition.name) { // changed
                try {
                    await outsideActions.updateDefinitionName(definition, selectedName);
                } catch (err) {
                    actions.showNotification(err);
                }
            }
        },
        updateCategoryName: async () => {
            const definition = definitionState?.definitionForManager;
            const selectedName = definitionState.selectedName;
            if (selectedName !== definition.category) { // changed
                try {
                    await outsideActions.updateCategoryName(definition, selectedName);
                } catch (err) {
                    actions.showNotification(err);
                }
            }
        },
        showNotification: (msg) => {
            setNotificationMessage(msg);
        },
        clearNotification: () => {
            setNotificationMessage('');
        },
        importFile: (ref) => {
            ref.current.value = null;
            ref.current.click();
        },
        onChangePresetSettings: (key, value) => {
            const { definitionForManager } = definitionState;

            outsideActions.onSaveDefinitionForManager(
                definitionForManager,
                [[key, value]],
                definitionForManager.definitionId === activeDefinitionID,
            );
        },
        resetDefinition: (definitionId) => {
            const newDefinitionForManager = outsideActions.resetDefinitionById(definitionId, definitionId === activeDefinitionID);
            setDefinitionState({
                definitionForManager: newDefinitionForManager
            });
        },
        checkDefault: (configList, definitionForManager, selectedSettingDefaultValue, _lastStatus = true) => {
            let lastStatus = _lastStatus;
            for (const key of configList) {
                if (definitionForManager.settings[key].default_value !== selectedSettingDefaultValue[key].default_value) {
                    lastStatus = false;
                    break;
                }
                if (definitionForManager.settings[key]?.childKey?.length > 0) {
                    actions.checkDefault(definitionForManager.settings[key].childKey, definitionForManager, selectedSettingDefaultValue, lastStatus);
                }
            }
            return lastStatus;
        },
        checkIsAllDefault: (configList, definitionForManager, selectedSettingDefaultValue) => {
            let result = true;
            Object.keys(configList).forEach(key => {
                result = result && actions.checkDefault(configList[key], definitionForManager, selectedSettingDefaultValue);
            });
            return result;
        },
        handleAddMaterial: async (data) => {
            const newDefinitionForManager = cloneDeep(definitionState.definitionForManager);
            newDefinitionForManager.category = data.type;
            newDefinitionForManager.name = data.name;
            if (Object.keys(newDefinitionForManager.settings).length === 0) {
                newDefinitionForManager.settings = cloneDeep(allDefinitions[0].settings);
            }

            setShowCreateMaterialModal(false);
            const newDefinition = await outsideActions.onCreateManagerDefinition(newDefinitionForManager, data.name, false, true);
            actions.onSelectDefinitionById(newDefinition.definitionId, newDefinition.name);

            outsideActions.onUpdatePreset(newDefinition, [
                ['color', data.color],
                ['material_print_temperature', data.printingTemperature],
                ['material_bed_temperature', data.buildPlateTemperature],
                ['cool_fan_speed', data.openFan ? 100 : 0],
            ]);
        }
    };

    return (
        <React.Fragment>
            {definitionState?.definitionForManager && (
                <Modal
                    size="lg-profile-manager"
                    className={classNames(styles['manager-body'])}
                    style={{ minWidth: '700px' }}
                    onClose={outsideActions.closeManager}
                >
                    <Modal.Header>
                        <div className={classNames('heading-3')}>
                            {managerTitle}
                        </div>
                    </Modal.Header>
                    <Modal.Body>
                        <div className={classNames(styles['manager-content'], 'sm-flex', 'background-grey-3')}>
                            <div className={classNames(styles['manager-name'], 'border-radius-8')}>
                                {
                                    notificationMessage && (
                                        <Notifications bsStyle="danger" onDismiss={actions.clearNotification} className="Notifications">
                                            {notificationMessage}
                                        </Notifications>
                                    )
                                }
                                <ul className={classNames(styles['manager-name-wrapper'])}>
                                    <div className={classNames(styles['manager-list'])}>
                                        {
                                            definitionState.cates.map((cate) => {
                                                const isCategorySelected = cate.category === definitionState?.definitionForManager.category;
                                                return !!cate.items.length && (
                                                    <li key={`${cate.category}`} className={classNames(styles['category-li'])}>
                                                        <Anchor
                                                            className={classNames(styles['manager-btn'], { [styles.selected]: actions.isCategorySelectedNow(cate.category) })}
                                                            onClick={() => actions.onSelectCategory(cate.category)}
                                                            onDoubleClick={() => actions.setRenamingStatus(true)}
                                                        >
                                                            <div className={classNames('sm-flex', 'align-center', 'width-248')}>
                                                                <SvgIcon
                                                                    name="DropdownOpen"
                                                                    className={classNames(
                                                                        'margin-horizontal-4',
                                                                        'padding-horizontal-4',
                                                                        configExpanded[cate.category] ? 'rotate270' : ''
                                                                    )}
                                                                    onClick={() => {
                                                                        actions.foldCategory(cate.category);
                                                                    }}
                                                                    type={['static']}
                                                                />
                                                                {(definitionState?.isCategorySelected && isCategorySelected && definitionState?.renamingStatus)
                                                                    ? (
                                                                        <input
                                                                            ref={refs.renameInput}
                                                                            className="sm-parameter-row__input"
                                                                            value={definitionState?.selectedName}
                                                                            onChange={actions.onChangeSelectedName}
                                                                            onKeyPress={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    e.preventDefault();
                                                                                    actions.setRenamingStatus(false);
                                                                                    actions.updateCategoryName();
                                                                                }
                                                                            }}
                                                                            onBlur={() => {
                                                                                actions.setRenamingStatus(false);
                                                                                actions.updateCategoryName();
                                                                            }}
                                                                        />
                                                                    )
                                                                    : <span className="text-overflow-ellipsis">{cate.category}</span>}
                                                            </div>
                                                            {!isOfficialDefinition(definitionState.definitionForManager) && managerType !== PRINTING_MANAGER_TYPE_MATERIAL && (
                                                                <div className={classNames(styles['manager-action'])}>
                                                                    <Dropdown
                                                                        placement="bottomRight"
                                                                        overlay={(
                                                                            <Menu>
                                                                                <Menu.Item>
                                                                                    <Anchor onClick={() => {
                                                                                        actions.setRenamingStatus(true);
                                                                                    }}
                                                                                    >
                                                                                        <div className="width-120 text-overflow-ellipsis">{i18n._('key-App/Menu-Rename')}</div>
                                                                                    </Anchor>
                                                                                </Menu.Item>
                                                                                <Menu.Item>
                                                                                    <Anchor onClick={() => actions.onRemoveManagerDefinition(definitionState.definitionForManager, definitionState.isCategorySelected)}>
                                                                                        <div>{i18n._('key-Printing/ProfileManager-Delete')}</div>
                                                                                    </Anchor>
                                                                                </Menu.Item>
                                                                            </Menu>
                                                                        )}
                                                                    >
                                                                        <SvgIcon
                                                                            name="More"
                                                                            size={24}
                                                                            className="margin-left-n-30"
                                                                        />
                                                                    </Dropdown>
                                                                </div>
                                                            )}
                                                        </Anchor>
                                                        {!configExpanded[cate.category] && (
                                                            <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
                                                                {(cate.items.map((currentOption) => {
                                                                    const definitionForManager = definitionState?.definitionForManager;
                                                                    const displayName = (
                                                                        <div className="display-inherit width-196 margin-left-4">
                                                                            <MaterialWithColor name={currentOption.label} color={currentOption.color} />
                                                                        </div>
                                                                    );
                                                                    const isSelected = (
                                                                        !definitionState.isCategorySelected
                                                                        && currentOption.value === definitionForManager.definitionId
                                                                    );
                                                                    let isAllValueDefault = true;
                                                                    if (isSelected && currentOption.isDefault && definitionState?.selectedSettingDefaultValue) {
                                                                        const selectedSettingDefaultValue = definitionState?.selectedSettingDefaultValue;
                                                                        isAllValueDefault = actions.checkIsAllDefault(optionConfigGroup, definitionForManager, selectedSettingDefaultValue);
                                                                    }
                                                                    if (isUndefined(currentOption.label) || currentOption.isHidden) {
                                                                        return null;
                                                                    } else {
                                                                        return (
                                                                            <li key={`${currentOption.value}${currentOption.label}`} className={classNames(styles['profile-li'])}>
                                                                                <div className="sm-flex align-center justify-space-between">
                                                                                    <Anchor
                                                                                        className={classNames(styles['manager-btn'], { [styles.selected]: isSelected })}
                                                                                        style={{ paddingLeft: '42px' }}
                                                                                        title={currentOption.label}
                                                                                        onClick={() => actions.onSelectDefinitionById(
                                                                                            currentOption.value,
                                                                                            currentOption.label
                                                                                        )}
                                                                                        onDoubleClick={() => actions.setRenamingStatus(true)}
                                                                                    >
                                                                                        {(isSelected && definitionState.renamingStatus)
                                                                                            ? (
                                                                                                <input
                                                                                                    ref={refs.renameInput}
                                                                                                    className="sm-parameter-row__input"
                                                                                                    value={definitionState.selectedName}
                                                                                                    onChange={actions.onChangeSelectedName}
                                                                                                    onKeyPress={(e) => {
                                                                                                        if (e.key === 'Enter') {
                                                                                                            e.preventDefault();
                                                                                                            actions.setRenamingStatus(false);
                                                                                                            actions.updateDefinitionName();
                                                                                                        }
                                                                                                    }}
                                                                                                    onBlur={() => {
                                                                                                        actions.setRenamingStatus(false);
                                                                                                        actions.updateDefinitionName();
                                                                                                    }}
                                                                                                />
                                                                                            )
                                                                                            : <span className="text-overflow-ellipsis">{displayName}</span>}
                                                                                        {!(isSelected && definitionState.renamingStatus) && (
                                                                                            <div className={classNames(styles['manager-action'])}>
                                                                                                <Dropdown
                                                                                                    placement="bottomRight"
                                                                                                    overlay={(
                                                                                                        <Menu>
                                                                                                            {!isOfficialDefinition(definitionState.definitionForManager) && (
                                                                                                                <Menu.Item>
                                                                                                                    <Anchor onClick={() => {
                                                                                                                        actions.setRenamingStatus(true);
                                                                                                                    }}
                                                                                                                    >
                                                                                                                        <div className="width-120 text-overflow-ellipsis">{i18n._('key-App/Menu-Rename')}</div>
                                                                                                                    </Anchor>
                                                                                                                </Menu.Item>
                                                                                                            )}
                                                                                                            <Menu.Item>
                                                                                                                <Anchor onClick={() => {
                                                                                                                    actions.showDuplicateModal();
                                                                                                                }}
                                                                                                                >
                                                                                                                    <div className="width-120 text-overflow-ellipsis">{i18n._('key-App/Menu-Copy')}</div>
                                                                                                                </Anchor>
                                                                                                            </Menu.Item>
                                                                                                            {!isAllValueDefault && (
                                                                                                                <Menu.Item>
                                                                                                                    <Anchor
                                                                                                                        onClick={() => actions.resetDefinition(currentOption.value)}
                                                                                                                    >
                                                                                                                        <div className="width-120 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Reset')}</div>
                                                                                                                    </Anchor>
                                                                                                                </Menu.Item>
                                                                                                            )}
                                                                                                            <Menu.Item>
                                                                                                                <Anchor onClick={() => outsideActions.exportConfigFile(definitionState.definitionForManager)}>
                                                                                                                    <div className="width-120 text-overflow-ellipsis">{i18n._('key-Printing/ProfileManager-Export')}</div>
                                                                                                                </Anchor>
                                                                                                            </Menu.Item>
                                                                                                            {!isOfficialDefinition(definitionState.definitionForManager) && (
                                                                                                                <Menu.Item>
                                                                                                                    <Anchor onClick={() => actions.onRemoveManagerDefinition(definitionState.definitionForManager, definitionState.isCategorySelected)}>
                                                                                                                        <div>{i18n._('key-Printing/ProfileManager-Delete')}</div>
                                                                                                                    </Anchor>
                                                                                                                </Menu.Item>
                                                                                                            )}
                                                                                                        </Menu>
                                                                                                    )}
                                                                                                >
                                                                                                    <SvgIcon
                                                                                                        name="More"
                                                                                                        size={24}
                                                                                                        className="margin-left-n-30"
                                                                                                    />
                                                                                                </Dropdown>
                                                                                            </div>
                                                                                        )}
                                                                                    </Anchor>
                                                                                </div>
                                                                            </li>
                                                                        );
                                                                    }
                                                                }))}
                                                            </ul>

                                                        )}
                                                    </li>
                                                );
                                            })
                                        }
                                    </div>
                                    <div>
                                        <input
                                            ref={refs.fileInput}
                                            type="file"
                                            accept=".json"
                                            style={{ display: 'none' }}
                                            multiple={false}
                                            onChange={async (e) => {
                                                const definition = await outsideActions.onChangeFileForManager(e);
                                                setTimeout(() => {
                                                    actions.onSelectDefinitionById(
                                                        definition.definitionId,
                                                        definition.name
                                                    );
                                                }, 50);
                                            }}
                                        />
                                        <Dropdown
                                            trigger={['click']}
                                            placement="top"
                                            overlayClassName="horizontal-menu"
                                            overlay={(
                                                <Menu>
                                                    <Menu.Item>
                                                        <Tooltip title={managerType === PRINTING_MANAGER_TYPE_MATERIAL ? i18n._('key-Settings/Create Material Tips') : null} placement="top">
                                                            <Anchor onClick={() => {
                                                                if (managerType === PRINTING_MANAGER_TYPE_MATERIAL) {
                                                                    setShowCreateMaterialModal(true);
                                                                } else {
                                                                    actions.showNewModal();
                                                                }
                                                            }}
                                                            >
                                                                <div className="width-112 height-88 sm-flex sm-flex-direction-c align-center margin-right-8">
                                                                    <SvgIcon
                                                                        name="PresetQuickCreate"
                                                                        className="margin-bottom-8"
                                                                        size={48}
                                                                    />
                                                                    <span className="display-inline width-percent-100 text-overflow-ellipsis align-c">{i18n._('key-Printing/ProfileManager-Quick Create')}</span>
                                                                </div>
                                                            </Anchor>
                                                        </Tooltip>
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        <Anchor onClick={() => actions.importFile(refs.fileInput)}>
                                                            <div className="width-112 height-88 sm-flex sm-flex-direction-c align-center">
                                                                <SvgIcon
                                                                    name="PresetLocal"
                                                                    className="margin-bottom-8"
                                                                    size={48}
                                                                />
                                                                <span className="display-inline width-percent-100 text-overflow-ellipsis align-c">{i18n._('key-Printing/ProfileManager-Local Import')}</span>
                                                            </div>
                                                        </Anchor>
                                                    </Menu.Item>
                                                </Menu>
                                            )}
                                        >
                                            <Button
                                                width="230px"
                                                type="default"
                                                priority="level-two"
                                                className="margin-left-16"
                                            >
                                                {i18n._('key-ProfileManager/Add Profile')}
                                            </Button>
                                        </Dropdown>
                                    </div>
                                </ul>
                            </div>
                            {/* Preset Content on the right side */}
                            <PresetContent
                                definitionForManager={definitionState.definitionForManager}
                                showParameters={!definitionState.isCategorySelected}
                                optionConfigGroup={optionConfigGroup}
                                isOfficialDefinition={isOfficialDefinition}
                                onChangePresetSettings={actions.onChangePresetSettings}
                                selectedSettingDefaultValue={definitionState?.selectedSettingDefaultValue}
                                showMiddle={managerType === PRINTING_MANAGER_TYPE_MATERIAL || managerType === PRINTING_MANAGER_TYPE_QUALITY}
                                hideMiniTitle={false}
                                managerType={managerType}
                                customConfigs={customConfig}
                                onChangeCustomConfig={onChangeCustomConfig}
                            />
                            {
                                managerType === PRINTING_MANAGER_TYPE_MATERIAL && showCreateMaterialModal && (
                                    <AddMaterialModel
                                        setShowCreateMaterialModal={setShowCreateMaterialModal}
                                        onSubmit={(data) => actions.handleAddMaterial(data)}
                                    />
                                )
                            }
                        </div>

                    </Modal.Body>
                </Modal>
            )}
        </React.Fragment>
    );
}

ProfileManager.propTypes = {
    outsideActions: PropTypes.object.isRequired,
    activeDefinitionID: PropTypes.string.isRequired,
    managerTitle: PropTypes.string.isRequired,
    optionConfigGroup: PropTypes.object.isRequired,
    allDefinitions: PropTypes.array.isRequired,
    isOfficialDefinition: PropTypes.func.isRequired,
    managerType: PropTypes.string,
    customConfig: PropTypes.object,
    onChangeCustomConfig: PropTypes.func
};

export default ProfileManager;
